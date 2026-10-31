"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Menu, MenuItem, MenuTrigger, Popover, Text } from "react-aria-components/Menu";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { bevyConsentNote, bevyCsv, bevyFileName } from "@/lib/bevy-export";
import { programPath, type CohortRole } from "@/lib/cohort";
import { readableError } from "@/lib/draft-session";
import { SKIP, guessColumns, guessRoles, importBatch, importLimits, parseDelimited, planImport, type ColumnMap } from "@/lib/enrolment-import";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { PixelIcon, type PixelIconName } from "../pixel-icons";
import { Select } from "../select";
import { StaffOnly } from "./assignments";
import { ConfirmDialog, CopyIconButton, DashboardDialog, DialogContent, DialogFooter } from "./data-table";
import { isStaff, useDashboardViewer } from "./viewer";

type Roster = NonNullable<FunctionReturnType<typeof api.cohorts.roster>>;
type Row = Roster["rows"][number];
type Status = "all" | "claimed" | "unclaimed" | "withdrawn";

const statusLabels: Record<Exclude<Status, "all">, string> = { claimed: "Sudah masuk", unclaimed: "Belum masuk", withdrawn: "Mengundurkan diri" };
const cohortStatusLabels = { setup: "Persiapan", active: "Berjalan", ended: "Selesai" } as const;
const statusOf = (row: Pick<Row, "status" | "ownerId">): Exclude<Status, "all"> => row.status === "withdrawn" ? "withdrawn" : row.ownerId ? "claimed" : "unclaimed";
const roleName = (roles: CohortRole[], key: string) => roles.find((role) => role.key === key)?.name ?? key;
const dayLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

/** Staff: every cohort, e.g. GDGoC Catalyst 2026/27, with its participant counts. */
export function ProgramsPage() {
  const viewer = useDashboardViewer();
  const cohorts = useQuery(api.cohorts.list, isStaff(viewer) ? {} : "skip");
  if (!isStaff(viewer)) return <StaffOnly />;
  return <>
    <div className="dash-intro"><p className="eyebrow">ADMIN · PROGRAM</p><h1>Program.</h1>
      <p>Peserta program dengan pendaftaran sendiri, seperti GDGoC Catalyst. Impor daftar peserta yang diterima dari hasil oprec; peserta terhubung ke akunnya saat masuk dengan email yang sama.</p></div>
    {cohorts === undefined ? <LoadingPanel label="Memuat program…" />
      : !cohorts.length ? <div className="app-empty"><h2>Belum ada program.</h2><p>Program dibuat lewat konfigurasi server, misalnya <code>npx convex run cohorts:seedCatalyst</code>.</p></div>
      : <ul className="dash-program-list">{cohorts.map((cohort) => <li key={cohort._id}><Link className="app-panel dash-program-card" href={programPath(cohort.slug)}>
        <span className="dash-badges"><span className="dash-role">{cohortStatusLabels[cohort.status]}</span></span>
        <h2>{cohort.name}</h2>
        <p className="app-small">{cohort.roles.map((role) => role.name).join(" · ")}</p>
        <p>{cohort.active} peserta aktif · {cohort.claimed} sudah masuk{cohort.withdrawn ? ` · ${cohort.withdrawn} mengundurkan diri` : ""}</p>
      </Link></li>)}</ul>}
  </>;
}

/** Staff: one cohort's participants, filtered by role and status, with the import and per-participant fixes. */
export function ProgramRoster({ slug }: { slug: string }) {
  const viewer = useDashboardViewer();
  const data = useQuery(api.cohorts.roster, isStaff(viewer) ? { slug } : "skip");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const back = <Link className="text-button app-back" href="/dashboard/program"><PixelIcon name="arrow-left" size={24} />Semua program</Link>;
  if (!isStaff(viewer)) return <StaffOnly />;
  if (data === undefined) return <LoadingPanel label="Memuat peserta…" />;
  if (data === null) return <>{back}<div className="app-empty"><h1>Program tidak ditemukan.</h1><p>Periksa kembali link-nya.</p></div></>;
  const { cohort, rows } = data;
  const needle = search.trim().toLowerCase();
  const shown = rows
    .filter((row) => (role === "all" || row.role === role) && (status === "all" || statusOf(row) === status))
    .filter((row) => !needle || [row.fullName ?? "", row.name, row.email].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name, "id"));
  const active = rows.filter((row) => row.status === "active");

  return <>
    {back}
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · PROGRAM</p><h1>{cohort.name}</h1>
      <p>{active.length} peserta aktif, {active.filter((row) => row.ownerId).length} sudah masuk ke dashboard. Peserta yang belum masuk terhubung otomatis saat masuk dengan email Google yang terdaftar.</p></div>
      <div className="dash-roster-actions">
        {viewer.role === "owner" && <button type="button" className="button button-quiet" disabled={!active.length} onClick={() => setExporting(true)}><PixelIcon name="download" size={18} />CSV untuk Bevy</button>}
        <button type="button" className="button button-blue" onClick={() => setImporting(true)}><PixelIcon name="upload" size={18} />Impor peserta</button>
      </div>
    </div>

    <div className="dash-toolbar dash-roster-toolbar" role="search" aria-label="Cari dan saring peserta">
      <div className="dash-search-control"><PixelIcon name="search" size={18} />
        <input type="search" aria-label="Cari nama atau email peserta" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email" autoComplete="off" />
      </div>
      <Select variant="inline" label="Peran" value={role} onChange={setRole} options={[{ value: "all", label: "Semua" }, ...cohort.roles.map((item) => ({ value: item.key, label: item.name }))]} />
      <Select variant="inline" label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Semua" }, ...(Object.keys(statusLabels) as Exclude<Status, "all">[]).map((key) => ({ value: key, label: statusLabels[key] }))]} />
    </div>

    {!rows.length ? <div className="app-empty"><h2>Belum ada peserta.</h2><p>Impor daftar peserta yang diterima dari hasil oprec: file CSV atau sel yang disalin dari Google Sheets.</p></div>
      : !shown.length ? <div className="app-empty"><h2>Tidak ada peserta yang cocok.</h2><p>Ubah pencarian atau filternya.</p></div>
      : <div className="dash-table-wrap" role="region" aria-labelledby="roster-caption" tabIndex={0}>
        <table className="dash-table">
          <caption id="roster-caption" className="sr-only">Peserta {cohort.name}, {shown.length} dari {rows.length}</caption>
          <thead><tr><th scope="col">Peserta</th><th scope="col">Peran</th><th scope="col">Status</th><th scope="col">Diimpor</th><th scope="col" className="dash-table-actions"><span className="sr-only">Aksi</span></th></tr></thead>
          <tbody>{shown.map((row) => <tr key={row._id} data-active={row.status === "active"}>
            <th scope="row" className="dash-table-member"><span className="dash-table-stack">
              {row.ownerId ? <Link href={`/dashboard/anggota/${encodeURIComponent(row.ownerId)}`}>{row.fullName ?? row.name}</Link> : row.name}
              <small title={row.email}>{row.email}</small>
              {row.fullName && row.fullName !== row.name && <small>Di form: {row.name}</small>}
            </span></th>
            <td><span className="dash-role">{roleName(cohort.roles, row.role)}</span></td>
            <td><span className="dash-enrolment" data-status={statusOf(row)}>{statusLabels[statusOf(row)]}</span></td>
            <td className="dash-table-date"><time dateTime={new Date(row.importedAt).toISOString()} title={dateLabel(row.importedAt)}>{dayLabel.format(row.importedAt)}</time></td>
            <td className="dash-table-actions"><EnrolmentActions row={row} roles={cohort.roles} /></td>
          </tr>)}</tbody>
        </table>
      </div>}

    <DashboardDialog open={exporting} onClose={() => setExporting(false)} title="CSV untuk Bevy">
      <BevyExport cohort={cohort} count={active.length} onDone={() => setExporting(false)} />
    </DashboardDialog>
    <DashboardDialog open={importing} onClose={() => setImporting(false)} title={`Impor peserta ${cohort.name}`} wide>
      <ImportForm cohortId={cohort._id} roles={cohort.roles} roster={rows} onDone={() => setImporting(false)} />
    </DashboardDialog>
  </>;
}

/**
 * Owners: the active participants in Bevy's member import template (email, first_name, last_name), for adding them as
 * members of the chapter on gdg.community.dev. Bevy asks the importer to confirm consent, so the dialog says where it comes from.
 */
function BevyExport({ cohort, count, onDone }: { cohort: Roster["cohort"]; count: number; onDone: () => void }) {
  const convex = useConvex();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const note = bevyConsentNote(cohort.name);
  async function download() {
    setBusy(true); setError("");
    try {
      const rows = await convex.query(api.cohorts.exportBevy, { cohortId: cohort._id });
      const url = URL.createObjectURL(new Blob([bevyCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = bevyFileName(cohort.slug, Date.now());
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onDone();
    } catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }
  return <>
    <DialogContent>
      <p className="dash-dialog-body">Berisi email dan nama {count} peserta aktif dalam format template Bevy (<code>email</code>, <code>first_name</code>, <code>last_name</code>). Unggah di halaman chapter gdg.community.dev lewat <strong>Import members</strong>. Kata pertama nama menjadi nama depan; nama satu kata tidak punya nama belakang.</p>
      <p className="dash-dialog-body">Bevy meminta konfirmasi bahwa peserta menyetujui pendaftarannya. Centang hanya jika form oprec menanyakan persetujuan itu. Untuk “How did they consent?”, tulis misalnya:</p>
      <div className="dash-bevy-note"><span>{note}</span><CopyIconButton text={note} label="Salin teks persetujuan" /></div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </DialogContent>
    <DialogFooter>
      <button className="dash-dialog-button" type="button" disabled={busy} onClick={onDone}>Batal</button>
      <button className="dash-dialog-button" data-primary type="button" disabled={busy} onClick={() => void download()}>{busy ? "Menyiapkan CSV…" : "Unduh CSV"}</button>
    </DialogFooter>
  </>;
}

type Pending = { key: string; label: string; icon: PixelIconName; danger?: boolean };

/** Role, email, and withdrawal for one participant; each change asks first and goes to the access log. */
function EnrolmentActions({ row, roles }: { row: Row; roles: CohortRole[] }) {
  const setRole = useMutation(api.cohorts.setRole);
  const setStatus = useMutation(api.cohorts.setStatus);
  const setEmail = useMutation(api.cohorts.setEmail);
  const [open, setOpen] = useState<string | null>(null);
  const [role, setRoleValue] = useState(row.role);
  const [email, setEmailValue] = useState(row.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = row.fullName ?? row.name;
  const withdrawn = row.status === "withdrawn";
  const actions: Pending[] = [
    { key: "role", label: "Ubah peran", icon: "label" },
    { key: "email", label: "Perbaiki email", icon: "mail" },
    withdrawn ? { key: "restore", label: "Aktifkan kembali", icon: "check" } : { key: "withdraw", label: "Catat mengundurkan diri", icon: "user-x", danger: true },
  ];
  function choose(key: string) { setError(""); setRoleValue(row.role); setEmailValue(row.email); setOpen(key); }
  async function run(change: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await change(); setOpen(null); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  const close = () => { if (!busy) setOpen(null); };
  const footer = (label: string) => <DialogFooter><button className="dash-dialog-button" type="button" disabled={busy} onClick={close}>Batal</button><button className="dash-dialog-button" data-primary type="submit" disabled={busy}>{busy ? "Menyimpan…" : label}</button></DialogFooter>;

  return <>
    <MenuTrigger>
      <Button className="icon-button" aria-label={`Kelola ${name}`} data-tip="Kelola"><PixelIcon name="more-vertical" size={24} /></Button>
      <Popover className="dash-menu-popover" placement="bottom end" data-lenis-prevent>
        <Menu className="dash-menu" aria-label={`Kelola ${name}`} onAction={(key) => choose(String(key))}>
          {actions.map((action) => <MenuItem key={action.key} id={action.key} className="dash-menu-item" textValue={action.label} data-tone={action.danger ? "danger" : undefined}>
            <PixelIcon name={action.icon} size={18} /><Text slot="label">{action.label}</Text>
          </MenuItem>)}
        </Menu>
      </Popover>
    </MenuTrigger>
    <DashboardDialog open={open === "role"} onClose={close} busy={busy} title={`Peran ${name}`}>
      <form className="dash-dialog-form" onSubmit={(event) => { event.preventDefault(); void run(() => setRole({ id: row._id, role })); }}>
        <DialogContent>
          <p className="dash-dialog-body">Tugas untuk peran baru langsung muncul untuknya; tugas peran lama tidak lagi.</p>
          <Select id={`role-${row._id}`} label="Peran" value={role} disabled={busy} onChange={setRoleValue} options={roles.map((item) => ({ value: item.key, label: item.name }))} />
          {error && <p className="field-error" role="alert">{error}</p>}
        </DialogContent>
        {footer("Simpan peran")}
      </form>
    </DashboardDialog>
    <DashboardDialog open={open === "email"} onClose={close} busy={busy} title={`Email ${name}`}>
      <form className="dash-dialog-form" onSubmit={(event) => { event.preventDefault(); void run(() => setEmail({ id: row._id, email })); }}>
        <DialogContent>
          <p className="dash-dialog-body">Pakai email Google yang dipakai peserta untuk masuk. Jika akun dengan email itu sudah ada, peserta langsung terhubung; jika belum, ia terhubung saat pertama kali masuk.</p>
          <div className="app-field"><label htmlFor={`email-${row._id}`}>Email</label>
            <input id={`email-${row._id}`} type="email" required value={email} disabled={busy} onChange={(event) => setEmailValue(event.target.value)} autoComplete="off" /></div>
          {error && <p className="field-error" role="alert">{error}</p>}
        </DialogContent>
        {footer("Simpan email")}
      </form>
    </DashboardDialog>
    <ConfirmDialog open={open === "withdraw" || open === "restore"} busy={busy} error={error} danger={open === "withdraw"}
      title={open === "withdraw" ? "Catat mengundurkan diri?" : "Aktifkan kembali?"}
      message={open === "withdraw" ? `${name} tidak lagi mendapat tugas ${roleName(roles, row.role)}. Kiriman dan nilainya tetap tersimpan, dan ia bisa diaktifkan kembali.` : `${name} kembali mendapat tugas untuk perannya.`}
      confirmLabel={open === "withdraw" ? "Ya, catat mengundurkan diri" : "Ya, aktifkan kembali"}
      onConfirm={() => void run(() => setStatus({ id: row._id, status: open === "withdraw" ? "withdrawn" : "active" }))} onClose={close} />
  </>;
}

const NONE = -1;

/**
 * Reads the accepted list from a CSV file or cells pasted from Google Sheets (with the header row), lets staff say which
 * columns hold the email, name and role and which answers mean which role, shows what would change, then imports.
 */
function ImportForm({ cohortId, roles, roster, onDone }: { cohortId: Id<"cohorts">; roles: CohortRole[]; roster: Row[]; onDone: () => void }) {
  const importRows = useMutation(api.cohorts.importEnrolments);
  const [text, setText] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [columns, setColumns] = useState<ColumnMap>({ email: NONE, name: NONE, role: NONE });
  const [roleOf, setRoleOf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; updated: number; unchanged: number; linked: number } | null>(null);

  const headers = table?.[0] ?? [];
  const body = useMemo(() => table?.slice(1) ?? [], [table]);
  const answers = useMemo(() => columns.role === NONE ? [] : [...new Set(body.map((cells) => (cells[columns.role] ?? "").trim()).filter(Boolean))], [body, columns.role]);
  const mapped = columns.email !== NONE && columns.name !== NONE && columns.role !== NONE;
  const plan = useMemo(() => mapped ? planImport(body, columns, roleOf, roles, roster) : null, [mapped, body, columns, roleOf, roles, roster]);
  const changes = plan?.planned.filter((row) => row.change !== "same") ?? [];

  function read(source: string) {
    const parsed = parseDelimited(source);
    if (parsed.length < 2) { setError("Butuh baris judul dan setidaknya satu baris peserta."); return; }
    if (parsed.length - 1 > importLimits.rows) { setError(`Maksimal ${importLimits.rows} peserta sekali impor.`); return; }
    const guessed = guessColumns(parsed[0]);
    setError(""); setTable(parsed); setColumns(guessed);
    setRoleOf(guessed.role === NONE ? {} : guessRoles(parsed.slice(1).map((cells) => cells[guessed.role] ?? ""), roles));
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    try { const content = await file.text(); setText(content); read(content); } catch { setError("File tidak bisa dibaca. Simpan ulang sebagai CSV lalu coba lagi."); }
  }
  function pickColumn(field: keyof ColumnMap, index: number) {
    const next = { ...columns, [field]: index };
    setColumns(next);
    if (field === "role") setRoleOf(guessRoles(body.map((cells) => cells[index] ?? ""), roles));
  }
  async function submit() {
    setBusy(true); setError("");
    const total = { added: 0, updated: 0, unchanged: 0, linked: 0 };
    try {
      for (let start = 0; start < changes.length; start += importBatch) {
        setProgress(`Mengimpor ${Math.min(start + importBatch, changes.length)} dari ${changes.length}…`);
        const done = await importRows({ cohortId, rows: changes.slice(start, start + importBatch).map(({ email, name, role }) => ({ email, name, role })) });
        total.added += done.added; total.updated += done.updated; total.unchanged += done.unchanged; total.linked += done.linked;
      }
      setResult(total);
    } catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); setProgress(""); }
  }

  if (result) return <>
    <DialogContent><p className="dash-dialog-body" role="status">Impor selesai: {result.added} peserta ditambahkan{result.linked ? ` (${result.linked} langsung terhubung ke akunnya)` : ""}, {result.updated} diperbarui.</p></DialogContent>
    <DialogFooter><button className="dash-dialog-button" data-primary type="button" onClick={onDone}>Selesai</button></DialogFooter>
  </>;

  const columnOptions = [{ value: NONE, label: "Pilih kolom" }, ...headers.map((header, index) => ({ value: index, label: header || `Kolom ${index + 1}` }))];
  const count = (change: "add" | "update" | "same") => plan?.planned.filter((row) => row.change === change).length ?? 0;
  return <>
    <DialogContent>
      {!table ? <div className="dash-import-source">
        <p className="dash-dialog-body">Pakai daftar peserta yang diterima dari hasil oprec, dengan baris judul. Setiap peserta butuh email, nama, dan peran. Email yang sudah terdaftar diperbarui, bukan ditambah lagi.</p>
        <div className="app-field"><label htmlFor="import-file">File CSV</label>
          <input id="import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" disabled={busy} onChange={(event) => void readFile(event.target.files?.[0])} /></div>
        <div className="app-field"><label htmlFor="import-paste">Atau tempel sel dari Google Sheets</label>
          <textarea id="import-paste" data-lenis-prevent rows={6} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} placeholder={"Email\tNama\tPeran\nrania@gmail.com\tRania Putri\tHacker"} /></div>
      </div> : <div className="dash-import-map">
        <p className="dash-dialog-body">{body.length} baris terbaca. Pastikan kolom dan perannya sudah benar.</p>
        <fieldset className="dash-import-columns"><legend>Kolom</legend>
          <Select id="import-email" label="Email" value={columns.email} onChange={(index) => pickColumn("email", index)} options={columnOptions} disabled={busy} />
          <Select id="import-name" label="Nama" value={columns.name} onChange={(index) => pickColumn("name", index)} options={columnOptions} disabled={busy} />
          <Select id="import-role" label="Peran" value={columns.role} onChange={(index) => pickColumn("role", index)} options={columnOptions} disabled={busy} />
        </fieldset>
        {answers.length > 0 && <fieldset className="dash-import-roles"><legend>Jawaban peran</legend>
          {answers.map((answer, index) => <Select key={answer} id={`import-answer-${index}`} label={`“${answer}”`} value={roleOf[answer] ?? SKIP} disabled={busy}
            onChange={(key) => setRoleOf({ ...roleOf, [answer]: key })} options={[{ value: SKIP, label: "Jangan impor" }, ...roles.map((item) => ({ value: item.key, label: item.name }))]} />)}
        </fieldset>}
        {plan && <div className="dash-import-summary" role="status">
          <p><strong>{count("add")}</strong> baru · <strong>{count("update")}</strong> diperbarui · <strong>{count("same")}</strong> sudah sama · <strong>{plan.problems.length}</strong> dilewati</p>
          {plan.problems.length > 0 && <details><summary>Lihat baris yang dilewati</summary><ul>{plan.problems.slice(0, 50).map((problem) => <li key={problem.line}>Baris {problem.line}: {problem.reason}</li>)}
            {plan.problems.length > 50 && <li>dan {plan.problems.length - 50} baris lainnya.</li>}</ul></details>}
        </div>}
      </div>}
      {progress && <p className="app-small" role="status">{progress}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </DialogContent>
    <DialogFooter>
      <button className="dash-dialog-button" type="button" disabled={busy} onClick={table ? () => { setTable(null); setError(""); } : onDone}>{table ? "Ganti data" : "Batal"}</button>
      {table ? <button className="dash-dialog-button" data-primary type="button" disabled={busy || !changes.length} onClick={() => void submit()}>{busy ? "Mengimpor…" : changes.length ? `Impor ${changes.length} peserta` : "Tidak ada perubahan"}</button>
        : <button className="dash-dialog-button" data-primary type="button" disabled={busy || !text.trim()} onClick={() => read(text)}>Baca data</button>}
    </DialogFooter>
  </>;
}
