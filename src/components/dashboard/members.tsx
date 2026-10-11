"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "react-aria-components/Button";
import { Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Separator, Text } from "react-aria-components/Menu";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { divisions, memberTagLabel, memberTypeLabels, type MemberType } from "@/lib/onboarding";
import { readableError } from "@/lib/draft-session";
import { membersCsv, membersFileName, type MemberExportRow } from "@/lib/member-export";
import { listQueryString, memberFilterLabels, memberFilters, readListState, type MemberFilter, type MemberListState, type MemberSort } from "@/lib/member-table";
import { PixelIcon, type PixelIconName } from "../pixel-icons";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { StaffOnly } from "./assignments";
import { ConfirmDialog, DashboardDialog, IconLink, Pagination, SortHeader, useKeptResult } from "./data-table";
import { isStaff, useDashboardViewer, type DashboardViewer } from "./viewer";

type Row = FunctionReturnType<typeof api.dashboard.members>["rows"][number];
type Stats = FunctionReturnType<typeof api.dashboard.stats>;
const statKey: Record<MemberFilter, keyof Stats> = { all: "members", admin: "admins", reviewer: "reviewers", core: "core", bod: "bod", deactivated: "deactivated" };

export const memberPath = (ownerId: string) => `/dashboard/anggota/${encodeURIComponent(ownerId)}`;

// The list's query string, kept for the session so "Semua anggota" on a member's page returns to the same page and filter.
const LIST_KEY = "dashboard:anggota:list";
const readListKey = () => { try { return sessionStorage.getItem(LIST_KEY) ?? ""; } catch { return ""; } };
const noStore = () => () => {};
/** Where "Semua anggota" goes: the members list as the viewer last left it in this tab. */
export function useMembersListHref() {
  return `/dashboard/anggota${useSyncExternalStore(noStore, readListKey, () => "")}`;
}

export function MembersPage() {
  const viewer = useDashboardViewer();
  if (!isStaff(viewer)) return <StaffOnly />;
  return <Members viewer={viewer} />;
}

function Members({ viewer }: { viewer: DashboardViewer }) {
  const pathname = usePathname();
  const state = readListState(useSearchParams());
  const tableRef = useRef<HTMLDivElement>(null);
  // The URL is the list state: back and forward move between pages and filters, and a reload keeps them.
  function go(next: Partial<MemberListState>, how: "push" | "replace" = "push") {
    const url = `${pathname}${listQueryString({ ...state, ...next })}`;
    if (how === "push") window.history.pushState(null, "", url); else window.history.replaceState(null, "", url);
  }
  function turnPage(page: number) {
    go({ page });
    const top = tableRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) tableRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // Typing waits 300 ms before it searches, and replaces the history entry rather than adding one per keystroke.
  const [input, setInput] = useState(state.search);
  const [urlSearch, setUrlSearch] = useState(state.search);
  if (urlSearch !== state.search) { setUrlSearch(state.search); if (input.trim() !== state.search) setInput(state.search); }
  const searchUrl = input.trim() !== state.search ? `${pathname}${listQueryString({ ...state, search: input.trim(), page: 1 })}` : null;
  useEffect(() => {
    if (!searchUrl) return;
    const timer = setTimeout(() => window.history.replaceState(null, "", searchUrl), 300);
    return () => clearTimeout(timer);
  }, [searchUrl]);

  const stats = useQuery(api.dashboard.stats);
  const { data, reloading } = useKeptResult(useQuery(api.dashboard.members, { search: state.search, filter: state.filter, sort: state.sort, page: state.page, pageSize: state.pageSize }));
  // The server pulls a page past the end back to the last one (e.g. after a deactivation emptied it); the URL follows.
  const pageUrl = data && !reloading && data.page !== state.page ? `${pathname}${listQueryString({ ...state, page: data.page })}` : null;
  useEffect(() => { if (pageUrl) window.history.replaceState(null, "", pageUrl); }, [pageUrl]);
  const listQuery = listQueryString(state);
  useEffect(() => { try { sessionStorage.setItem(LIST_KEY, listQuery); } catch { /* storage blocked: the link falls back to page 1 */ } }, [listQuery]);

  const sortBy = (column: "name" | "joined") => {
    const next: MemberSort = column === "name" ? (state.sort === "name-asc" ? "name-desc" : "name-asc") : (state.sort === "joined-desc" ? "joined-asc" : "joined-desc");
    go({ sort: next, page: 1 });
  };
  const direction = (column: "name" | "joined") => state.sort.startsWith(column) ? (state.sort.endsWith("asc") ? "ascending" as const : "descending" as const) : undefined;

  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · ANGGOTA</p><h1>Anggota.</h1>
      <p>Member yang sudah menyelesaikan perkenalan. {viewer.role === "owner" ? "Sebagai pemilik, kamu bisa menjadikan member sebagai admin atau peninjau apresiasi." : "Pemilik dapat mengubah peran admin dan peninjau apresiasi."} Member nonaktif tidak bisa membuka tugas. Pemilik diatur lewat konfigurasi server.</p></div>
      {viewer.role === "owner" && <OwnerTools />}
    </div>

    <div className="dash-toolbar">
      <div className="app-field dash-search"><label htmlFor="member-search">Cari nama</label>
        <div className="dash-search-control"><PixelIcon name="search" size={18} />
          <input id="member-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nama member" autoComplete="off" />
        </div>
      </div>
      <div className="review-filters dash-filters" role="group" aria-label="Saring anggota">{memberFilters.map((filter) => <button key={filter} type="button" aria-pressed={state.filter === filter} onClick={() => go({ filter, page: 1 })}>
        {memberFilterLabels[filter]}{stats && <span className="dash-filter-count">{stats[statKey[filter]]}</span>}
      </button>)}</div>
    </div>

    {!data ? <LoadingPanel label="Memuat anggota…" /> : !data.total ? <div className="app-empty"><h2>Tidak ada anggota di sini.</h2><p>{state.search ? `Tidak ada nama yang cocok dengan “${state.search}”.` : "Anggota yang sesuai filter ini akan muncul di sini."}</p>
      {(state.search || state.filter !== "all") && <button type="button" className="button button-quiet" onClick={() => { setInput(""); go({ search: "", filter: "all", page: 1 }); }}>Hapus pencarian dan filter</button>}</div>
      : <>
        <div ref={tableRef} className="dash-table-wrap" role="region" aria-labelledby="members-caption" tabIndex={0}>
          <table className="dash-table" aria-busy={reloading}>
            <caption id="members-caption" className="sr-only">Daftar anggota, halaman {data.page} dari {data.pageCount}</caption>
            <thead><tr>
              <SortHeader label="Anggota" direction={direction("name")} onSort={() => sortBy("name")} />
              <th scope="col">Kampus</th>
              <th scope="col">Akses</th>
              <th scope="col">Komunitas</th>
              <th scope="col">Status</th>
              <SortHeader label="Bergabung" direction={direction("joined")} onSort={() => sortBy("joined")} />
              <th scope="col" className="dash-table-actions"><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>{data.rows.map((row) => <MemberTableRow key={row.ownerId} row={row} viewer={viewer} />)}</tbody>
          </table>
        </div>
        <Pagination label="Halaman anggota" noun="anggota" page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total}
          onPage={turnPage} onPageSize={(pageSize) => go({ pageSize, page: 1 })} />
      </>}
  </>;
}

const dayLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

function MemberTableRow({ row, viewer }: { row: Row; viewer: DashboardViewer }) {
  const self = row.ownerId === viewer.id;
  return <tr data-active={row.active}>
    <th scope="row" className="dash-table-member"><div className="dash-table-person">
      <span className="account-avatar" aria-hidden="true">{initial(row.fullName)}</span>
      <span><span><Link href={memberPath(row.ownerId)}>{row.fullName}</Link>{self && <span className="app-small"> (kamu)</span>}</span><small>{row.email}</small></span>
    </div></th>
    <td><span className="dash-table-stack">{row.campus || "—"}{row.studyProgram && <small>{row.studyProgram}</small>}</span></td>
    <td><AccessBadges row={row} /></td>
    <td><CommunityBadge row={row} /></td>
    <td><ActiveBadge active={row.active} /></td>
    <td className="dash-table-date"><time dateTime={new Date(row.joinedAt).toISOString()} title={dateLabel(row.joinedAt)}>{dayLabel.format(row.joinedAt)}</time></td>
    <td className="dash-table-actions"><div className="dash-row-actions">
      <IconLink icon="eye" label={`Lihat detail ${row.fullName}`} href={memberPath(row.ownerId)} />
      <MemberActions row={row} viewer={viewer} />
    </div></td>
  </tr>;
}

export const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();

export function AccessBadges({ row }: { row: Pick<Row, "role" | "reviewer" | "reviewsByTag"> }) {
  return <span className="dash-badges"><span className="dash-role" data-role={row.role}>{roleLabels[row.role]}</span>
    {(row.reviewer || row.reviewsByTag) && row.role === "member" && <span className="dash-role" data-role="reviewer">Peninjau Apresiasi</span>}</span>;
}

export function CommunityBadge({ row }: { row: Pick<Row, "memberType" | "division" | "tagConfirmed"> }) {
  if (!row.memberType) return <span className="app-small">—</span>;
  return <span className="dash-badges"><span className="dash-role" data-role={row.memberType}>{row.memberType === "core" ? `Core · ${row.division ?? "—"}` : memberTagLabel(row.memberType, row.division)}</span>
    {row.memberType !== "member" && !row.tagConfirmed && <span className="dash-unconfirmed">belum dikonfirmasi</span>}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className="dash-active" data-active={active}>{active ? "Aktif" : "Nonaktif"}</span>;
}

/** Owners: the members CSV and the access log, beside the page title. */
function OwnerTools() {
  const convex = useConvex();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Owners download every onboarded member as CSV, read page by page. Personal data, so admins do not get it.
  async function download() {
    setBusy(true); setError("");
    try {
      const rows: MemberExportRow[] = [];
      let cursor: string | null = null;
      for (;;) {
        const page: FunctionReturnType<typeof api.dashboard.exportMembers> = await convex.query(api.dashboard.exportMembers, { paginationOpts: { numItems: 100, cursor } });
        rows.push(...page.page);
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const url = URL.createObjectURL(new Blob([membersCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = membersFileName(Date.now());
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }
  return <div className="dash-owner-tools">
    <div className="dash-owner-buttons" role="group" aria-label="Alat pemilik">
      <Link className="dash-tool-button" href="/dashboard/anggota/riwayat"><PixelIcon name="clock" size={18} />Riwayat akses</Link>
      <button type="button" className="dash-tool-button" disabled={busy} onClick={() => void download()}><PixelIcon name="download" size={18} />{busy ? "Menyiapkan CSV…" : "Unduh CSV"}</button>
    </div>
    {error && <small role="alert">{error}</small>}
  </div>;
}

type Action = { key: string; group: "access" | "community" | "status"; icon: PixelIconName; label: string; confirm: string; danger?: boolean; run: () => Promise<unknown> };
const groupLabels = { access: "Akses", community: "Komunitas", status: "Status" } as const;

/**
 * The actions the viewer may take on one member, grouped in a menu: access (owners), community tag, and status.
 * Each change asks first in a dialog. `labelled` shows "Kelola" beside the icon, for the member's own page.
 */
export function MemberActions({ row, viewer, labelled = false }: { row: Pick<Row, keyof Row>; viewer: DashboardViewer; labelled?: boolean }) {
  const setRole = useMutation(api.dashboard.setRole);
  const setReviewer = useMutation(api.dashboard.setReviewer);
  const setActive = useMutation(api.dashboard.setActive);
  const setMemberType = useMutation(api.dashboard.setMemberType);
  const [pending, setPending] = useState<Action | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const self = row.ownerId === viewer.id;
  const owner = viewer.role === "owner";
  const actions: Action[] = [];
  if (!self && owner && row.role === "member" && row.active) actions.push({ key: "promote", group: "access", icon: "shield", label: "Jadikan admin", confirm: `Jadikan ${row.fullName} admin? Admin bisa mengelola tugas, melihat semua kiriman, meninjau apresiasi, dan menonaktifkan member.`, run: () => setRole({ ownerId: row.ownerId, role: "admin" }) });
  if (!self && owner && row.role === "admin") actions.push({ key: "demote", group: "access", icon: "user-minus", label: "Turunkan jadi member", confirm: `Cabut akses admin ${row.fullName}?`, run: () => setRole({ ownerId: row.ownerId, role: "member" }) });
  // Admins review by role and confirmed Media & Creative tags by tag, so the grant is offered for other members only.
  if (!self && owner && row.role === "member" && row.active && (row.reviewer || !row.reviewsByTag)) actions.push(row.reviewer
    ? { key: "unreview", group: "access", icon: "user-x", label: "Cabut peninjau apresiasi", confirm: `Cabut akses tinjau apresiasi ${row.fullName}? Kiriman pribadinya tetap bisa dibuka.`, run: () => setReviewer({ ownerId: row.ownerId, reviewer: false }) }
    : { key: "review", group: "access", icon: "user-plus", label: "Jadikan peninjau apresiasi", confirm: `Jadikan ${row.fullName} peninjau apresiasi? Ia bisa membuka antrean tinjauan, memberi catatan, dan mencatat link post.`, run: () => setReviewer({ ownerId: row.ownerId, reviewer: true }) });
  const mediaTag = row.division === "Media & Creative";
  // A self-declared Core Team or BoD tag counts once staff confirm it; for Media & Creative that also grants Apresiasi review.
  if (row.memberType && row.memberType !== "member" && !row.tagConfirmed) actions.push({
    key: "confirm-tag", group: "community", icon: "check-double", label: "Konfirmasi peran komunitas",
    confirm: `Konfirmasi ${row.fullName} sebagai ${memberTagLabel(row.memberType, row.division)}?${mediaTag ? " Core Team dan BoD Media & Creative yang terkonfirmasi bisa meninjau apresiasi." : ""}`,
    run: () => setMemberType({ ownerId: row.ownerId, memberType: row.memberType!, division: row.division ?? "" }),
  });
  if (!self && row.role === "member") actions.push(row.active
    ? { key: "deactivate", group: "status", icon: "lock", label: "Nonaktifkan", danger: true, confirm: `Nonaktifkan ${row.fullName}? Ia tidak bisa membuka tugas sampai diaktifkan kembali. Kirimannya tetap tersimpan.`, run: () => setActive({ ownerId: row.ownerId, active: false }) }
    : { key: "activate", group: "status", icon: "check", label: "Aktifkan kembali", confirm: `Aktifkan kembali ${row.fullName}?`, run: () => setActive({ ownerId: row.ownerId, active: true }) });

  async function confirm() {
    if (!pending) return;
    setBusy(true); setError("");
    try { await pending.run(); setPending(null); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  function choose(key: string) {
    setError("");
    if (key === "edit-tag") setEditing(true);
    else setPending(actions.find((action) => action.key === key) ?? null);
  }
  const item = (action: Pick<Action, "key" | "icon" | "label" | "danger">) => <MenuItem key={action.key} id={action.key} className="dash-menu-item" textValue={action.label} data-tone={action.danger ? "danger" : undefined}>
    <PixelIcon name={action.icon} size={18} /><Text slot="label">{action.label}</Text>
  </MenuItem>;
  const section = (group: Action["group"], extra?: React.ReactNode) => {
    const items = actions.filter((action) => action.group === group);
    if (!items.length && !extra) return null;
    return <MenuSection className="dash-menu-section"><Header className="dash-menu-heading">{groupLabels[group]}</Header>{items.map(item)}{extra}</MenuSection>;
  };
  const status = section("status");
  const menuLabel = `Kelola ${row.fullName}`;

  return <>
    <MenuTrigger>
      <Button className={labelled ? "dash-tool-button" : "icon-button"} aria-label={labelled ? undefined : menuLabel} data-tip={labelled ? undefined : "Kelola"}>
        <PixelIcon name="more-vertical" size={labelled ? 18 : 24} />{labelled && "Kelola anggota"}
      </Button>
      <Popover className="dash-menu-popover" placement="bottom end">
        <Menu className="dash-menu" aria-label={menuLabel} onAction={(key) => choose(String(key))}>
          {section("access")}
          {section("community", item({ key: "edit-tag", icon: "label", label: "Ubah peran komunitas" }))}
          {status && <Separator className="dash-menu-separator" />}
          {status}
        </Menu>
      </Popover>
    </MenuTrigger>
    <ConfirmDialog open={pending !== null} title={pending ? `${pending.label}?` : ""} message={pending?.confirm} confirmLabel={pending ? `Ya, ${pending.label.toLowerCase()}` : ""}
      danger={pending?.danger} busy={busy} error={error} onConfirm={() => void confirm()} onClose={() => { setPending(null); setError(""); }} />
    <DashboardDialog open={editing} onClose={() => setEditing(false)} title={`Peran komunitas ${row.fullName}`}>
      <CommunityRoleEditor row={row} onDone={() => setEditing(false)} />
    </DashboardDialog>
  </>;
}

function CommunityRoleEditor({ row, onDone }: { row: Pick<Row, "ownerId" | "fullName" | "memberType" | "division">; onDone: () => void }) {
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
  return <form className="dash-role-editor" onSubmit={save}>
    <p className="dash-dialog-body">Menyimpan dari sini juga mengonfirmasi peran yang dipilih member sendiri.</p>
    <div className="app-field"><label htmlFor={`${id}-type`}>Peran</label><select id={`${id}-type`} value={memberType} disabled={busy} onChange={(event) => setType(event.target.value as MemberType)}><option value="member">{memberTypeLabels.member}</option><option value="core">{memberTypeLabels.core}</option><option value="bod">{memberTypeLabels.bod} (Board of Directors)</option></select></div>
    {memberType !== "member" && <div className="app-field"><label htmlFor={`${id}-division`}>Divisi{memberType === "bod" && " (opsional)"}</label><select id={`${id}-division`} value={division} disabled={busy} onChange={(event) => setDivision(event.target.value)}><option value="">{memberType === "bod" ? "Tanpa divisi" : "Pilih divisi"}</option>{divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="dash-dialog-actions"><button className="dash-dialog-button" type="button" disabled={busy} onClick={onDone}>Batal</button><button className="dash-dialog-button" data-primary type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button></div>
  </form>;
}
