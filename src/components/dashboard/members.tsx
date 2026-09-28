"use client";

import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { StaffOnly } from "./assignments";
import { isStaff, useDashboardViewer, type DashboardViewer } from "./shell";

type Filter = "all" | "admin" | "deactivated";
type Row = FunctionReturnType<typeof api.dashboard.members>["page"][number];
const filters: { value: Filter; label: string }[] = [{ value: "all", label: "Semua" }, { value: "admin", label: "Admin" }, { value: "deactivated", label: "Nonaktif" }];

export function MembersPage() {
  const viewer = useDashboardViewer();
  if (!isStaff(viewer)) return <StaffOnly />;
  return <Members viewer={viewer} />;
}

function Members({ viewer }: { viewer: DashboardViewer }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const stats = useQuery(api.dashboard.stats);
  const list = usePaginatedQuery(api.dashboard.members, { search, filter }, { initialNumItems: 25 });
  return <>
    <div className="dash-intro"><p className="eyebrow">ADMIN · ANGGOTA</p><h1>Anggota.</h1>
      <p>Member yang sudah menyelesaikan perkenalan. {viewer.role === "owner" ? "Sebagai pemilik, kamu bisa menjadikan member sebagai admin." : "Pemilik dapat mengubah peran admin."} Member nonaktif tidak bisa membuka tugas.</p></div>
    {stats && <p className="app-small dash-count">{stats.members} member · {stats.admins} admin · {stats.deactivated} nonaktif. Pemilik diatur lewat konfigurasi server.</p>}
    <div className="dash-toolbar">
      <div className="app-field dash-search"><label htmlFor="member-search">Cari nama</label><input id="member-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nama member" autoComplete="off" /></div>
      <div className="review-filters" role="group" aria-label="Saring anggota">{filters.map((item) => <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
    </div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat anggota…" /> : !list.results.length ? <div className="app-empty"><h2>Tidak ada anggota di sini.</h2><p>{search ? `Tidak ada nama yang cocok dengan “${search}”.` : "Anggota yang sesuai filter ini akan muncul di sini."}</p></div>
      : <ul className="dash-members">{list.results.map((row) => <MemberRow key={row.ownerId} row={row} viewer={viewer} />)}</ul>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(25)}>Muat anggota lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat anggota…</p>}
  </>;
}

type Action = { key: string; label: string; confirm: string; danger?: boolean; run: () => Promise<unknown> };

function MemberRow({ row, viewer }: { row: Row; viewer: DashboardViewer }) {
  const setRole = useMutation(api.dashboard.setRole);
  const setActive = useMutation(api.dashboard.setActive);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const self = row.ownerId === viewer.id;
  const actions: Action[] = [];
  if (!self && viewer.role === "owner" && row.role === "member" && row.active) actions.push({ key: "promote", label: "Jadikan admin", confirm: `Jadikan ${row.fullName} admin? Admin bisa mengelola tugas, melihat semua kiriman, dan menonaktifkan member.`, run: () => setRole({ ownerId: row.ownerId, role: "admin" }) });
  if (!self && viewer.role === "owner" && row.role === "admin") actions.push({ key: "demote", label: "Turunkan jadi member", confirm: `Cabut akses admin ${row.fullName}?`, run: () => setRole({ ownerId: row.ownerId, role: "member" }) });
  if (!self && row.role === "member") actions.push(row.active
    ? { key: "deactivate", label: "Nonaktifkan", danger: true, confirm: `Nonaktifkan ${row.fullName}? Ia tidak bisa membuka tugas sampai diaktifkan kembali. Kirimannya tetap tersimpan.`, run: () => setActive({ ownerId: row.ownerId, active: false }) }
    : { key: "activate", label: "Aktifkan kembali", confirm: `Aktifkan kembali ${row.fullName}?`, run: () => setActive({ ownerId: row.ownerId, active: true }) });
  async function confirm() {
    if (!pending) return;
    setBusy(true); setError("");
    try { await pending.run(); setPending(null); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  return <li className="dash-member" data-active={row.active}>
    <span className="account-avatar" aria-hidden="true">{row.fullName.trim().slice(0, 1).toUpperCase()}</span>
    <div className="dash-member-identity"><strong>{row.fullName}{self && <span className="app-small"> (kamu)</span>}</strong><span>{row.email}</span><span>{[row.campus, row.studyProgram].filter(Boolean).join(" · ")}</span></div>
    <div className="dash-member-meta"><span className="dash-role" data-role={row.role}>{roleLabels[row.role]}</span>{!row.active && <span className="app-status dash-status" data-status="missing">Nonaktif</span>}<span className="app-small">Bergabung {dateLabel(row.joinedAt)}</span></div>
    <div className="dash-member-actions">
      {pending ? <div className="dash-confirm" role="group" aria-label={pending.label}><p>{pending.confirm}</p><button className={`text-button ${pending.danger ? "text-danger" : ""}`} disabled={busy} onClick={() => void confirm()}>{busy ? "Menyimpan…" : `Ya, ${pending.label.toLowerCase()}`}</button><button className="text-button" disabled={busy} onClick={() => { setPending(null); setError(""); }}>Batal</button></div>
        : actions.map((action) => <button key={action.key} className={`text-button ${action.danger ? "text-danger" : ""}`} onClick={() => { setPending(action); setError(""); }}>{action.label}</button>)}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </li>;
}
