"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { audienceGroups, audienceLabels, toJakartaInput, type AudienceGroup } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { checkInsCsv, checkInsFileName, clockLabel, gatheringLimits, gatheringStatusLabels, gatheringTimeLabel, maxHelpers, normalizeGathering, validateGathering, type GatheringErrors, type GatheringValues } from "@/lib/gathering";
import { memberTagLabel } from "@/lib/onboarding";
import { PixelIcon } from "../pixel-icons";
import { LoadingPanel } from "../appreciation/shared";
import { StaffOnly } from "./assignments";
import { ConfirmDialog, DashboardDialog, DialogContent } from "./data-table";
import { AudienceBadge } from "./shared";
import { isStaff, useDashboardViewer } from "./viewer";

type Detail = NonNullable<FunctionReturnType<typeof api.gatherings.get>>;
const gatheringPath = (id: string) => `/dashboard/kehadiran/${id}`;

/** Tomorrow 19.00–21.00 WIB, a typical evening meeting, for staff to adjust. */
function blankValues(): GatheringValues {
  const day = toJakartaInput(Date.now() + 24 * 3600000).slice(0, 10);
  return { title: "", venue: "", startsAt: `${day}T19:00`, endsAt: `${day}T21:00`, audience: ["member", "core", "bod"] };
}

function GatheringForm({ initial, submitLabel, onSave, onCancel }: { initial: GatheringValues; submitLabel: string; onSave: (values: GatheringValues) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<GatheringErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (field: Exclude<keyof GatheringValues, "audience">, value: string) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const toggle = (group: AudienceGroup, on: boolean) => { setValues((current) => ({ ...current, audience: audienceGroups.filter((item) => item === group ? on : current.audience.includes(item)) })); setErrors((current) => ({ ...current, audience: undefined })); };
  const field = (name: "title" | "venue", label: string, placeholder: string) => <div className="app-field">
    <label htmlFor={`gathering-${name}`}>{label} <span className="field-required" aria-hidden="true">*</span></label>
    <input id={`gathering-${name}`} required maxLength={gatheringLimits[name]} value={values[name]} placeholder={placeholder} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `gathering-${name}-error` : undefined} />
    {errors[name] && <p className="field-error" id={`gathering-${name}-error`}>{errors[name]}</p>}
  </div>;
  const time = (name: "startsAt" | "endsAt", label: string) => <div className="app-field">
    <label htmlFor={`gathering-${name}`}>{label} <span className="field-required" aria-hidden="true">*</span></label>
    <input id={`gathering-${name}`} type="datetime-local" required value={values[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `gathering-${name}-error` : undefined} />
    {errors[name] && <p className="field-error" id={`gathering-${name}-error`}>{errors[name]}</p>}
  </div>;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeGathering(values), found = validateGathering(clean);
    setErrors(found); setError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try { await onSave(clean); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  return <form className="dash-gathering-form" onSubmit={(event) => void submit(event)} noValidate>
    <DialogContent>
      <fieldset disabled={busy}>
        {field("title", "Nama kegiatan", "Contoh: Kumpul member November")}
        {field("venue", "Tempat", "Contoh: Javano Coffee, Private Room 2")}
        <div className="app-field-grid">{time("startsAt", "Mulai (WIB)")}{time("endsAt", "Selesai (WIB)")}</div>
        <fieldset className="dash-audience-editor" aria-describedby="gathering-audience-hint">
          <legend>Untuk siapa <span className="field-required" aria-hidden="true">*</span></legend>
          <p className="field-hint" id="gathering-audience-hint">Yang belum datang dihitung dari kelompok ini. Anggota di luar kelompok tetap bisa dicatat hadir setelah peringatan.</p>
          <div className="dash-audience-options">{audienceGroups.map((group) => <label className="dash-audience-option" key={group}><input type="checkbox" checked={values.audience.includes(group)} onChange={(event) => toggle(group, event.target.checked)} aria-invalid={Boolean(errors.audience)} />{audienceLabels[group]}</label>)}</div>
          {errors.audience && <p className="field-error">{errors.audience}</p>}
        </fieldset>
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
    </DialogContent>
    <div className="dash-dialog-footer">
      <button type="button" className="dash-dialog-button" disabled={busy} onClick={onCancel}>Batal</button>
      <button type="submit" className="dash-dialog-button" data-primary disabled={busy}>{busy ? "Menyimpan…" : submitLabel}</button>
    </div>
  </form>;
}

export function GatheringsPage() {
  const viewer = useDashboardViewer();
  const router = useRouter();
  const staff = isStaff(viewer);
  const rows = useQuery(api.gatherings.list, staff || viewer.doorHelper ? {} : "skip");
  const create = useMutation(api.gatherings.create);
  const [creating, setCreating] = useState(false);
  if (!staff && !viewer.doorHelper) return <StaffOnly />;
  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">{staff ? "ADMIN · KEHADIRAN" : "KEHADIRAN"}</p><h1>Kehadiran.</h1>
      <p>Rapat dan kumpul member yang mencatat kehadiran dengan kartu anggota. Pindai QR kartu dengan kamera HP saat check-in dibuka. Event publik tetap memakai RSVP di Bevy.</p></div>
      {staff && <button type="button" className="button button-blue" onClick={() => setCreating(true)}><PixelIcon name="plus" size={18} />Buat kegiatan</button>}
    </div>
    {rows === undefined ? <LoadingPanel label="Memuat kegiatan…" />
      : !rows.length ? <div className="app-empty"><h2>Belum ada kegiatan.</h2><p>Buat kegiatan, buka check-in di hari H, lalu pindai kartu anggota yang datang.</p></div>
      : <ul className="dash-program-list">{rows.map((row) => <li key={row._id}><Link className="app-panel dash-program-card" href={gatheringPath(row._id)}>
        <span className="dash-badges"><span className="dash-role" data-status={row.status}>{gatheringStatusLabels[row.status]}</span><AudienceBadge audience={row.audience} /></span>
        <h2>{row.title}</h2>
        <p className="app-small">{gatheringTimeLabel(row)} · {row.venue}</p>
        <p>{row.checkIns} hadir dari {row.audienceSize} anggota sasaran</p>
      </Link></li>)}</ul>}
    <DashboardDialog open={creating} onClose={() => setCreating(false)} title="Buat kegiatan" wide>
      <GatheringForm initial={blankValues()} submitLabel="Simpan sebagai draft" onCancel={() => setCreating(false)}
        onSave={async (values) => { const id = await create({ values }); setCreating(false); router.push(gatheringPath(id)); }} />
    </DashboardDialog>
  </>;
}

function StatusControls({ gathering }: { gathering: Detail }) {
  const router = useRouter();
  const setStatus = useMutation(api.gatherings.setStatus);
  const update = useMutation(api.gatherings.update);
  const remove = useMutation(api.gatherings.remove);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = gathering._id;
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  const hint = { draft: "Draft belum bisa dipakai untuk check-in.", open: "Kartu yang dipindai hari ini menampilkan tombol Catat hadir untuk kegiatan ini.", closed: "Daftar hadir sudah dikunci. Buka lagi jika masih ada yang perlu dicatat." }[gathering.status];
  return <section className="dash-controls" aria-label="Kelola kegiatan">
    <p className="app-small">{hint}</p>
    <div className="app-inline-actions">
      {gathering.status !== "open" && <button type="button" className="button button-blue" disabled={busy} onClick={() => void run(() => setStatus({ id, status: "open" }))}>{gathering.status === "draft" ? "Buka check-in" : "Buka lagi"}</button>}
      {gathering.status === "open" && <button type="button" className="button button-quiet" disabled={busy} onClick={() => void run(() => setStatus({ id, status: "closed" }))}>Tutup check-in</button>}
      <button type="button" className="text-button" onClick={() => setEditing(true)}>Ubah kegiatan</button>
      {gathering.status === "draft" && <button type="button" className="text-button text-danger" onClick={() => setDeleting(true)}>Hapus draft</button>}
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
    <DashboardDialog open={editing} onClose={() => setEditing(false)} title="Ubah kegiatan" wide>
      <GatheringForm submitLabel="Simpan" onCancel={() => setEditing(false)}
        initial={{ title: gathering.title, venue: gathering.venue, startsAt: toJakartaInput(gathering.startsAt), endsAt: toJakartaInput(gathering.endsAt), audience: gathering.audience }}
        onSave={async (values) => { await update({ id, values }); setEditing(false); }} />
    </DashboardDialog>
    <ConfirmDialog open={deleting} title="Hapus draft?" message={`Hapus “${gathering.title}”? Draft ini belum punya daftar hadir.`} confirmLabel="Hapus" danger busy={busy} error={error}
      onClose={() => setDeleting(false)} onConfirm={() => void run(async () => { await remove({ id }); router.push("/dashboard/kehadiran"); })} />
  </section>;
}

/** Staff choose members who run the door of this gathering, e.g. Sekben, without admin rights. */
function DoorHelpers({ gathering }: { gathering: Detail }) {
  const setHelper = useMutation(api.gatherings.setHelper);
  const [search, setSearch] = useState("");
  const term = search.trim();
  const found = useQuery(api.dashboard.members, term.length >= 2 ? { search: term, filters: {}, page: 1, pageSize: 6 } : "skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(ownerId: string, helper: boolean) {
    setBusy(true); setError("");
    try { await setHelper({ id: gathering._id, ownerId, helper }); if (helper) setSearch(""); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  const candidates = (found?.rows ?? []).filter((row) => row.role === "member" && row.active && !gathering.helpers.some((helper) => helper.ownerId === row.ownerId));
  return <section className="dash-reviewers" aria-labelledby="helpers-title">
    <div className="app-section-heading"><div><p className="eyebrow">PENJAGA PINTU</p><h2 id="helpers-title">Penjaga pintu</h2></div><span className="app-small">Admin dan pemilik selalu bisa mencatat kehadiran.</span></div>
    <p className="app-small">Penjaga pintu bisa memindai kartu dan mencatat kehadiran untuk kegiatan ini saja, tanpa akses admin. Maksimal {maxHelpers} orang.</p>
    {gathering.helpers.length > 0 && <ul className="dash-reviewer-list">{gathering.helpers.map((helper) => <li key={helper.ownerId}><span>{helper.name}</span><button type="button" className="text-button text-danger" disabled={busy} onClick={() => void change(helper.ownerId, false)} aria-label={`Hapus ${helper.name} dari penjaga pintu`}>Hapus</button></li>)}</ul>}
    <div className="app-field"><label htmlFor="helper-search">Tambah penjaga pintu</label><input id="helper-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama member" /></div>
    {term.length >= 2 && (found === undefined ? <p className="app-small" role="status">Mencari…</p> : !candidates.length ? <p className="app-small">Tidak ada member aktif yang cocok.</p>
      : <ul className="dash-reviewer-list">{candidates.map((row) => <li key={row.ownerId}><span>{row.fullName}<small className="app-small"> · {row.campus}</small></span><button type="button" className="text-button" disabled={busy} onClick={() => void change(row.ownerId, true)}>Tambahkan</button></li>)}</ul>)}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}

function downloadCsv(gathering: Detail) {
  const csv = checkInsCsv([...gathering.checkIns].sort((a, b) => a.checkedInAt - b.checkedInAt));
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: checkInsFileName(gathering) });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function GatheringDetail({ id }: { id: string }) {
  const viewer = useDashboardViewer();
  const staff = isStaff(viewer);
  const data = useQuery(api.gatherings.get, staff || viewer.doorHelper ? { id } : "skip");
  const checkIn = useMutation(api.gatherings.checkIn);
  const removeCheckIn = useMutation(api.gatherings.removeCheckIn);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const back = <Link className="text-button app-back" href="/dashboard/kehadiran"><PixelIcon name="arrow-left" size={24} />Semua kegiatan</Link>;
  if (!staff && !viewer.doorHelper) return <StaffOnly />;
  if (data === undefined) return <LoadingPanel label="Memuat kegiatan…" />;
  if (data === null) return <>{back}<div className="app-empty"><h1>Kegiatan tidak ditemukan.</h1><p>Periksa kembali link-nya.</p></div></>;
  const open = data.status === "open";
  const needle = search.trim().toLowerCase();
  const absent = data.absent.filter((row) => !needle || row.name.toLowerCase().includes(needle));
  async function run(key: string, action: () => Promise<string>) {
    setBusy(key); setError(""); setNotice("");
    try { setNotice(await action()); } catch (cause) { setError(readableError(cause)); } finally { setBusy(""); }
  }
  return <>
    {back}
    <div className="dash-intro"><p className="eyebrow">KEHADIRAN</p><h1>{data.title}</h1>
      <p>{gatheringTimeLabel(data)} · {data.venue}</p>
      <span className="dash-badges"><span className="dash-role" data-status={data.status}>{gatheringStatusLabels[data.status]}</span><AudienceBadge audience={data.audience} /></span></div>
    {staff && <StatusControls gathering={data} />}
    <p className="app-small dash-door-hint"><PixelIcon name="id-card" size={18} />Di pintu: pindai QR kartu anggota dengan kamera HP. Halaman yang terbuka menampilkan tombol <strong>Catat hadir</strong> selama check-in dibuka hari ini.</p>
    {(notice || error) && <p className={error ? "field-error" : "app-small"} role={error ? "alert" : "status"}>{error || notice}</p>}

    <section className="dash-submissions-section" aria-labelledby="came-title">
      <div className="app-section-heading"><div><p className="eyebrow">HADIR</p><h2 id="came-title">{data.checkIns.length} hadir</h2></div>
        {staff && data.checkIns.length > 0 && <button type="button" className="button button-quiet" onClick={() => downloadCsv(data)}><PixelIcon name="download" size={18} />Unduh CSV</button>}</div>
      {!data.checkIns.length ? <div className="app-empty"><h3>Belum ada yang tercatat hadir.</h3><p>{open ? "Kehadiran muncul di sini begitu kartu dipindai." : "Buka check-in di hari H untuk mulai mencatat."}</p></div>
        : <div className="dash-table-wrap" tabIndex={0} role="region" aria-label="Daftar hadir"><table className="dash-table">
          <thead><tr><th scope="col">Nama</th><th scope="col">Peran komunitas</th><th scope="col">Waktu</th><th scope="col">Cara</th><th scope="col">Dicatat oleh</th>{staff && open && <th scope="col"><span className="sr-only">Aksi</span></th>}</tr></thead>
          <tbody>{data.checkIns.map((row) => <tr key={row._id}>
            <td><strong>{row.name}</strong>{row.outsideAudience && <small className="app-small"> · di luar sasaran</small>}</td>
            <td>{row.memberType ? memberTagLabel(row.memberType, row.division) : "—"}</td>
            <td>{clockLabel(row.checkedInAt)}</td>
            <td>{row.method === "scan" ? "Pindai kartu" : "Manual"}</td>
            <td>{row.by ?? "—"}</td>
            {staff && open && <td><button type="button" className="text-button text-danger" disabled={Boolean(busy)} aria-label={`Batalkan kehadiran ${row.name}`}
              onClick={() => void run(row._id, async () => { await removeCheckIn({ id: row._id }); return `Kehadiran ${row.name} dibatalkan.`; })}>Batalkan</button></td>}
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="dash-submissions-section" aria-labelledby="absent-title">
      <div className="app-section-heading"><div><p className="eyebrow">BELUM HADIR</p><h2 id="absent-title">{data.absent.length} anggota sasaran belum hadir</h2></div></div>
      {open && <p className="app-small">Untuk anggota yang tidak membawa HP, cari namanya lalu catat hadir dari sini.</p>}
      {data.absent.length > 0 && <div className="app-field"><label htmlFor="absent-search">Cari nama</label><input id="absent-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama anggota" /></div>}
      {absent.length > 0 && <ul className="dash-reviewer-list">{absent.slice(0, 50).map((row) => <li key={row.ownerId}>
        <span>{row.name}<small className="app-small"> · {row.memberType ? memberTagLabel(row.memberType, row.division) : row.campus}</small></span>
        {open && <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void run(row.ownerId, async () => {
          const result = await checkIn({ id: data._id, ownerId: row.ownerId });
          return result.result === "already" ? `${result.name} sudah tercatat hadir pukul ${clockLabel(result.checkedInAt)}.` : `${row.name} tercatat hadir.`;
        })}>Catat hadir</button>}
      </li>)}</ul>}
      {absent.length > 50 && <p className="app-small">Menampilkan 50 dari {absent.length}. Cari nama untuk mempersempit.</p>}
    </section>

    {staff && <DoorHelpers gathering={data} />}
  </>;
}
