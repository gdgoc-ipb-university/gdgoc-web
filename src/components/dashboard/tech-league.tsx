"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { readableError } from "@/lib/draft-session";
import { importLimits, parseDelimited } from "@/lib/enrolment-import";
import { NO_COLUMN, guessRegistrationColumns, planRegistrations, registrationBatch, type RegistrationColumns } from "@/lib/league-import";
import { leagueTeamSize, leagueTracks, registrationLabels, registrationState, standingLabels, teamsCsv, teamsFileName, type RegistrationState, type TeamStanding } from "@/lib/league-team";
import { LoadingPanel } from "../appreciation/shared";
import { PixelIcon } from "../pixel-icons";
import { Select } from "../select";
import { StaffOnly } from "./assignments";
import { DashboardDialog, DialogContent, DialogFooter } from "./data-table";
import { isStaff, useDashboardViewer } from "./viewer";

export const techLeaguePath = "/dashboard/tech-league";

type Team = FunctionReturnType<typeof api.league.staffTeams>[number];
const standingTone: Record<TeamStanding, string> = { complete: "done", forming: "missing", flagged: "late" };
const registrationTone: Record<RegistrationState, string> = { paid: "done", unpaid: "missing", none: "closed" };

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Staff: every Tech League team of the season by track and status, with the captain as contact and a CSV of all of them. */
export function TechLeagueTeams() {
  const viewer = useDashboardViewer();
  const teams = useQuery(api.league.staffTeams, isStaff(viewer) ? {} : "skip");
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("all");
  const [standing, setStanding] = useState<"all" | TeamStanding>("all");
  const [registration, setRegistration] = useState<"all" | RegistrationState>("all");
  const [importing, setImporting] = useState(false);
  if (!isStaff(viewer)) return <StaffOnly />;
  if (teams === undefined) return <LoadingPanel label="Memuat tim Tech League…" />;
  const needle = search.trim().toLowerCase();
  const shown = teams
    .filter((team) => (track === "all" || team.track === track) && (standing === "all" || team.standing === standing) && (registration === "all" || registrationState(team.registration) === registration))
    .filter((team) => !needle || [team.name, team.code, team.captain?.name ?? "", team.captain?.email ?? "", ...team.members.map((member) => member.name)].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => a.trackName.localeCompare(b.trackName) || a.name.localeCompare(b.name, "id", { numeric: true }));
  const people = teams.reduce((sum, team) => sum + team.members.length, 0);

  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · TECH LEAGUE</p><h1>Tech League.</h1>
      <p>{teams.length} tim, {people} peserta. Tim dibentuk member di halaman Tech League; ukuran tim {leagueTeamSize.min}–{leagueTeamSize.max} orang. Kapten satu-satunya kontak tim untuk panitia.</p></div>
      <div className="dash-roster-actions">
        <button type="button" className="button button-quiet" disabled={!teams.length} onClick={() => download(teamsCsv(teams), teamsFileName(Date.now()))}><PixelIcon name="download" size={18} />Unduh CSV</button>
        <button type="button" className="button button-blue" disabled={!teams.length} onClick={() => setImporting(true)}><PixelIcon name="upload" size={18} />Impor pendaftaran</button>
      </div>
    </div>

    <ul className="dash-league-tracks" aria-label="Tim per kategori">{leagueTracks.map((item) => {
      const inTrack = teams.filter((team) => team.track === item.key);
      return <li key={item.key} className="app-panel"><span className="app-small">{item.name}</span><strong>{inTrack.length}</strong>
        <span className="app-small">{inTrack.filter((team) => team.registration?.paid).length} lunas · {inTrack.filter((team) => team.standing === "forming").length} belum lengkap</span></li>;
    })}</ul>

    <div className="dash-toolbar dash-roster-toolbar" role="search" aria-label="Cari dan saring tim">
      <div className="dash-search-control"><PixelIcon name="search" size={18} />
        <input type="search" aria-label="Cari tim, kode, atau anggota" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tim, kode, atau anggota" autoComplete="off" />
      </div>
      <Select variant="inline" label="Kategori" value={track} onChange={setTrack} options={[{ value: "all", label: "Semua" }, ...leagueTracks.map((item) => ({ value: item.key, label: item.name }))]} />
      <Select variant="inline" label="Status" value={standing} onChange={setStanding} options={[{ value: "all", label: "Semua" }, ...(Object.keys(standingLabels) as TeamStanding[]).map((key) => ({ value: key, label: standingLabels[key] }))]} />
      <Select variant="inline" label="Pendaftaran" value={registration} onChange={setRegistration} options={[{ value: "all", label: "Semua" }, ...(Object.keys(registrationLabels) as RegistrationState[]).map((key) => ({ value: key, label: registrationLabels[key] }))]} />
    </div>

    {!teams.length ? <div className="app-empty"><h2>Belum ada tim.</h2><p>Tim muncul di sini begitu member membentuknya di halaman Daftar Tech League.</p></div>
      : !shown.length ? <div className="app-empty"><h2>Tidak ada tim yang cocok.</h2><p>Ubah pencarian atau filternya.</p></div>
      : <div className="dash-table-wrap" role="region" aria-labelledby="league-caption" tabIndex={0}>
        <table className="dash-table">
          <caption id="league-caption" className="sr-only">Tim Tech League, {shown.length} dari {teams.length}</caption>
          <thead><tr><th scope="col">Tim</th><th scope="col">Kategori</th><th scope="col">Anggota</th><th scope="col">Kapten</th><th scope="col">Status</th></tr></thead>
          <tbody>{shown.map((team) => <TeamRow key={team._id} team={team} />)}</tbody>
        </table>
      </div>}

    <DashboardDialog open={importing} onClose={() => setImporting(false)} title="Impor pendaftaran Tech League" wide>
      <ImportRegistrations teams={teams} onDone={() => setImporting(false)} />
    </DashboardDialog>
  </>;
}

function TeamRow({ team }: { team: Team }) {
  const state = registrationState(team.registration);
  return <tr>
    <th scope="row" className="dash-table-member"><span className="dash-table-stack">{team.name}<small className="dash-league-code">{team.code}</small></span></th>
    <td>{team.trackName}</td>
    <td><span className="dash-table-stack">{team.members.length} dari {leagueTeamSize.max}
      <small>{team.members.map((member, index) => <span key={member.ownerId}>{index > 0 && ", "}<Link href={`/dashboard/anggota/${encodeURIComponent(member.ownerId)}`}>{member.name}</Link></span>)}</small></span></td>
    <td>{team.captain ? <span className="dash-table-stack">{team.captain.name}{team.captain.email && <small title={team.captain.email}>{team.captain.email}</small>}</span> : <span className="app-small">Tanpa kapten</span>}</td>
    <td><span className="dash-league-badges">
      <span className="app-status dash-status" data-status={standingTone[team.standing]}>{standingLabels[team.standing]}</span>
      <span className="app-status dash-status" data-status={registrationTone[state]}>{registrationLabels[state]}</span>
    </span></td>
  </tr>;
}

/**
 * Program & Development's registration results into teams (#183): paste or upload, pick the captain-email and payment
 * columns, see each row matched to a team or listed as unmatched, then save. Nothing is written before "Simpan".
 */
function ImportRegistrations({ teams, onDone }: { teams: Team[]; onDone: () => void }) {
  const importRows = useMutation(api.league.importRegistrations);
  const [text, setText] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [columns, setColumns] = useState<RegistrationColumns>({ email: NO_COLUMN, payment: NO_COLUMN });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ registered: number; updated: number; unmatched: string[] } | null>(null);
  const headers = table?.[0] ?? [];
  const byCaptain = useMemo(() => teams.map((team) => ({ code: team.code, name: team.name, captainEmail: team.captain?.email ?? null, registration: team.registration })), [teams]);
  const plan = useMemo(() => table && columns.email !== NO_COLUMN ? planRegistrations(table.slice(1), columns, byCaptain) : null, [table, columns, byCaptain]);
  const changes = plan?.matched.filter((row) => row.change !== "same") ?? [];

  function read(source: string) {
    const parsed = parseDelimited(source);
    if (parsed.length < 2) { setError("Butuh baris judul dan setidaknya satu baris pendaftar."); return; }
    if (parsed.length - 1 > importLimits.rows) { setError(`Maksimal ${importLimits.rows} baris sekali impor.`); return; }
    setError(""); setTable(parsed); setColumns(guessRegistrationColumns(parsed[0]));
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    try { const content = await file.text(); setText(content); read(content); } catch { setError("File tidak bisa dibaca. Simpan ulang sebagai CSV lalu coba lagi."); }
  }
  async function submit() {
    setBusy(true); setError("");
    const total = { registered: 0, updated: 0, unmatched: [] as string[] };
    try {
      for (let start = 0; start < changes.length; start += registrationBatch) {
        const done = await importRows({ rows: changes.slice(start, start + registrationBatch).map((row) => ({ email: row.email, ...(columns.payment === NO_COLUMN ? {} : { paid: row.paid }) })) });
        total.registered += done.registered; total.updated += done.updated; total.unmatched.push(...done.unmatched);
      }
      setResult(total);
    } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }

  if (result) return <>
    <DialogContent><p className="dash-dialog-body" role="status">Impor selesai: {result.registered} tim baru terdaftar, {result.updated} diperbarui.{result.unmatched.length ? ` ${result.unmatched.length} email tidak lagi cocok dengan kapten mana pun: ${result.unmatched.join(", ")}.` : ""}</p></DialogContent>
    <DialogFooter><button className="dash-dialog-button" data-primary type="button" onClick={onDone}>Selesai</button></DialogFooter>
  </>;

  const columnOptions = (none: string) => [{ value: NO_COLUMN, label: none }, ...headers.map((header, index) => ({ value: index, label: header || `Kolom ${index + 1}` }))];
  return <>
    <DialogContent>
      {!table ? <div className="dash-import-source">
        <p className="dash-dialog-body">Pakai hasil form pendaftaran Program &amp; Development dengan baris judul. Setiap baris dicocokkan ke tim lewat email kapten; tim yang cocok ditandai terdaftar. Belum ada yang disimpan sebelum kamu melihat pratinjaunya.</p>
        <div className="app-field"><label htmlFor="league-import-file">File CSV</label>
          <input id="league-import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" disabled={busy} onChange={(event) => void readFile(event.target.files?.[0])} /></div>
        <div className="app-field"><label htmlFor="league-import-paste">Atau tempel sel dari Google Sheets</label>
          <textarea id="league-import-paste" data-lenis-prevent rows={6} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} placeholder={"Email Ketua\tStatus Pembayaran\nrania@gmail.com\tLunas"} /></div>
      </div> : <div className="dash-import-map">
        <p className="dash-dialog-body">{table.length - 1} baris terbaca. Pilih kolom email kapten dan, kalau ada, status pembayaran. Jawaban seperti “Lunas”, “Sudah”, atau “Terverifikasi” dibaca lunas.</p>
        <fieldset className="dash-import-columns"><legend>Kolom</legend>
          <Select id="league-import-email" label="Email kapten" value={columns.email} onChange={(index) => setColumns({ ...columns, email: index })} options={columnOptions("Pilih kolom")} disabled={busy} />
          <Select id="league-import-payment" label="Status pembayaran" value={columns.payment} onChange={(index) => setColumns({ ...columns, payment: index })} options={columnOptions("Tidak ada (status tetap)")} disabled={busy} />
        </fieldset>
        {plan && <div className="dash-import-summary" role="status">
          <p><strong>{plan.matched.filter((row) => row.change === "register").length}</strong> tim baru terdaftar · <strong>{plan.matched.filter((row) => row.change === "update").length}</strong> diperbarui · <strong>{plan.matched.filter((row) => row.change === "same").length}</strong> sudah sama · <strong>{plan.unmatched.length}</strong> tidak cocok</p>
          {plan.matched.length > 0 && <ul className="dash-league-preview">{plan.matched.map((row) => <li key={row.line}><span className="dash-league-code">{row.code}</span> {row.team} <span className="app-small">· baris {row.line} · {row.paid ? "lunas" : "belum lunas"}{row.change === "same" ? " · tidak berubah" : ""}</span></li>)}</ul>}
          {plan.unmatched.length > 0 && <><h3 className="dash-league-unmatched">Tidak cocok ({plan.unmatched.length})</h3>
            <ul className="dash-league-preview">{plan.unmatched.map((row) => <li key={row.line}>Baris {row.line}{row.email && `, ${row.email}`}: {row.reason}</li>)}</ul>
            <p className="app-small">Baris ini tidak disimpan. Biasanya pendaftar memakai email lain dari akun kaptennya, atau timnya belum dibentuk di halaman Tech League.</p></>}
        </div>}
      </div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </DialogContent>
    <DialogFooter>
      <button className="dash-dialog-button" type="button" disabled={busy} onClick={table ? () => { setTable(null); setError(""); } : onDone}>{table ? "Ganti data" : "Batal"}</button>
      {table ? <button className="dash-dialog-button" data-primary type="button" disabled={busy || !changes.length} onClick={() => void submit()}>{busy ? "Menyimpan…" : changes.length ? `Simpan ${changes.length} tim` : "Tidak ada perubahan"}</button>
        : <button className="dash-dialog-button" data-primary type="button" disabled={busy || !text.trim()} onClick={() => read(text)}>Baca data</button>}
    </DialogFooter>
  </>;
}
