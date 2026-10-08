"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { divisions, memberTagLabel, memberTypeLabels, type MemberType } from "@/lib/onboarding";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { StaffOnly } from "./assignments";
import { isStaff, useDashboardViewer, type DashboardViewer } from "./viewer";

type Filter = "all" | "admin" | "reviewer" | "core" | "bod" | "deactivated";
type Row = FunctionReturnType<typeof api.dashboard.members>["page"][number];
const filters: { value: Filter; label: string }[] = [{ value: "all", label: "Semua" }, { value: "admin", label: "Admin" }, { value: "reviewer", label: "Peninjau" }, { value: "core", label: "Core Team" }, { value: "bod", label: "BoD" }, { value: "deactivated", label: "Nonaktif" }];

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
      <p>Member yang sudah menyelesaikan perkenalan. {viewer.role === "owner" ? "Sebagai pemilik, kamu bisa menjadikan member sebagai admin atau peninjau apresiasi." : "Pemilik dapat mengubah peran admin dan peninjau apresiasi."} Member nonaktif tidak bisa membuka tugas.</p></div>
    {stats && <p className="app-small dash-count">{stats.members} anggota · {stats.core} core team · {stats.bod} BoD · {stats.admins} admin · {stats.reviewers} peninjau apresiasi · {stats.deactivated} nonaktif. Pemilik diatur lewat konfigurasi server.</p>}
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

/** One member with the actions the viewer may take. `linked` links the name to the member's detail page. */
export function MemberRow({ row, viewer, linked = true }: { row: Pick<Row, keyof Row>; viewer: DashboardViewer; linked?: boolean }) {
  const setRole = useMutation(api.dashboard.setRole);
  const setReviewer = useMutation(api.dashboard.setReviewer);
  const setActive = useMutation(api.dashboard.setActive);
  const [pending, setPending] = useState<Action | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const self = row.ownerId === viewer.id;
  const actions: Action[] = [];
  if (!self && viewer.role === "owner" && row.role === "member" && row.active) actions.push({ key: "promote", label: "Jadikan admin", confirm: `Jadikan ${row.fullName} admin? Admin bisa mengelola tugas, melihat semua kiriman, meninjau apresiasi, dan menonaktifkan member.`, run: () => setRole({ ownerId: row.ownerId, role: "admin" }) });
  if (!self && viewer.role === "owner" && row.role === "admin") actions.push({ key: "demote", label: "Turunkan jadi member", confirm: `Cabut akses admin ${row.fullName}?`, run: () => setRole({ ownerId: row.ownerId, role: "member" }) });
  // Admins review by role, so the grant is offered for members only.
  if (!self && viewer.role === "owner" && row.role === "member" && row.active) actions.push(row.reviewer
    ? { key: "unreview", label: "Cabut peninjau apresiasi", confirm: `Cabut akses tinjau apresiasi ${row.fullName}? Kiriman pribadinya tetap bisa dibuka.`, run: () => setReviewer({ ownerId: row.ownerId, reviewer: false }) }
    : { key: "review", label: "Jadikan peninjau apresiasi", confirm: `Jadikan ${row.fullName} peninjau apresiasi? Ia bisa membuka antrean tinjauan, memberi catatan, dan mencatat link post.`, run: () => setReviewer({ ownerId: row.ownerId, reviewer: true }) });
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
    <div className="dash-member-identity"><strong>{linked ? <Link href={`/dashboard/anggota/${encodeURIComponent(row.ownerId)}`}>{row.fullName}</Link> : row.fullName}{self && <span className="app-small"> (kamu)</span>}</strong><span>{row.email}</span><span>{[row.campus, row.studyProgram].filter(Boolean).join(" · ")}</span></div>
    <div className="dash-member-meta"><span className="dash-role" data-role={row.role}>{roleLabels[row.role]}</span>{row.reviewer && row.role === "member" && <span className="dash-role" data-role="reviewer">Peninjau Apresiasi</span>}{row.memberType &&<span className="dash-role" data-role={row.memberType}>{row.memberType === "core" ? `Core · ${row.division ?? "—"}` : memberTagLabel(row.memberType, row.division)}</span>}{!row.active && <span className="app-status dash-status" data-status="missing">Nonaktif</span>}<span className="app-small">Bergabung {dateLabel(row.joinedAt)}</span></div>
    <div className="dash-member-actions">
      {editing ? <CommunityRoleEditor row={row} onDone={() => setEditing(false)} /> : pending ? <div className="dash-confirm" role="group" aria-label={pending.label}><p>{pending.confirm}</p><button className={`text-button ${pending.danger ? "text-danger" : ""}`} disabled={busy} onClick={() => void confirm()}>{busy ? "Menyimpan…" : `Ya, ${pending.label.toLowerCase()}`}</button><button className="text-button" disabled={busy} onClick={() => { setPending(null); setError(""); }}>Batal</button></div>
        : <>{actions.map((action) => <button key={action.key} className={`text-button ${action.danger ? "text-danger" : ""}`} onClick={() => { setPending(action); setError(""); }}>{action.label}</button>)}<button className="text-button" onClick={() => { setEditing(true); setError(""); }}>Ubah peran komunitas</button></>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </li>;
}

function CommunityRoleEditor({ row, onDone }: { row: Row; onDone: () => void }) {
  const setMemberType = useMutation(api.dashboard.setMemberType);
  const [memberType, setType] = useState<MemberType>(row.memberType ?? "member");
  const [division, setDivision] = useState(row.division ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberType === "core" && !division) { setError("Pilih divisi untuk Core Team."); return; }
    setBusy(true); setError("");
    try { await setMemberType({ ownerId: row.ownerId, memberType, division: memberType === "member" ? "" : division }); onDone(); }
    catch (cause) { setError(readableError(cause)); setBusy(false); }
  }
  const id = `role-${row.ownerId}`;
  return <form className="dash-role-editor" onSubmit={save} aria-label={`Peran komunitas ${row.fullName}`}>
    <div className="app-field"><label htmlFor={`${id}-type`}>Peran</label><select id={`${id}-type`} value={memberType} disabled={busy} onChange={(event) => setType(event.target.value as MemberType)}><option value="member">{memberTypeLabels.member}</option><option value="core">{memberTypeLabels.core}</option><option value="bod">{memberTypeLabels.bod} (Board of Directors)</option></select></div>
    {memberType !== "member" && <div className="app-field"><label htmlFor={`${id}-division`}>Divisi{memberType === "bod" && " (opsional)"}</label><select id={`${id}-division`} value={division} disabled={busy} onChange={(event) => setDivision(event.target.value)}><option value="">{memberType === "bod" ? "Tanpa divisi" : "Pilih divisi"}</option>{divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
    <div className="dash-role-editor-actions"><button className="text-button" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button><button className="text-button" type="button" disabled={busy} onClick={onDone}>Batal</button></div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </form>;
}
