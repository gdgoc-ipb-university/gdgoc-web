"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { readableError } from "@/lib/draft-session";
import { memberTagLabel } from "@/lib/onboarding";
import {
  isOverdue, needsMentor, participationLabels, techSupportLimits, techSupportResponseDays, techSupportStatusLabels, techSupportStatuses,
  techSupportTransitions, workingDaysLabel, workingTime, type TechSupportStatus,
} from "@/lib/tech-support-request";
import { Select } from "../select";
import { PixelIcon } from "../pixel-icons";
import { dateLabel, LoadingPanel } from "../appreciation/shared";
import { CopyIconButton, DashboardDialog, DialogContent, DialogFooter } from "./data-table";
import { useNow } from "./shared";
import { deadlineLabel, TechSupportStatusBadge } from "./tech-support";
import { useDashboardViewer } from "./viewer";

type Request = FunctionReturnType<typeof api.techSupport.queue>["requests"][number];
type Filter = "open" | "all" | TechSupportStatus;
const filters: { value: Filter; label: string }[] = [
  { value: "open", label: "Belum selesai" }, { value: "all", label: "Semua" },
  ...techSupportStatuses.map((status) => ({ value: status as Filter, label: techSupportStatusLabels[status] })),
];

/** Time since the request arrived, in working days against the target; once matched, how long the match took. */
function ResponseClock({ request, now }: { request: Request; now: number }) {
  const overdue = isOverdue(request, now);
  const label = request.matchedAt ? `Dicocokkan dalam ${workingDaysLabel(workingTime(request.submittedAt, request.matchedAt))}`
    : request.status === "new" ? `${overdue ? "Lewat target · " : ""}${workingDaysLabel(workingTime(request.submittedAt, now))} dari ${techSupportResponseDays}`
    : "Ditutup tanpa mentor";
  return <span className="dash-support-clock" data-overdue={overdue}>{label}</span>;
}

function HandleDialog({ request, onClose }: { request: Request; onClose: () => void }) {
  const handle = useMutation(api.techSupport.handle);
  const [status, setStatus] = useState<TechSupportStatus>(request.status);
  const [mentorName, setMentorName] = useState(request.mentorName ?? "");
  const [note, setNote] = useState(request.note ?? "");
  const [mentorError, setMentorError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError(""); setMentorError("");
    if (needsMentor(status) && !mentorName.trim()) { setMentorError("Tulis nama mentornya."); return; }
    setBusy(true);
    try { await handle({ id: request._id, status, mentorName, note }); onClose(); }
    catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  const options = [request.status, ...techSupportTransitions[request.status]].map((value) => ({ value, label: value === request.status ? `${techSupportStatusLabels[value]} (sekarang)` : techSupportStatusLabels[value] }));
  return <form onSubmit={(event) => void save(event)} noValidate>
    <DialogContent>
      <dl className="dash-support-detail">
        <dt>Pemohon</dt><dd>{request.member.name}{request.member.memberType && ` · ${memberTagLabel(request.member.memberType, request.member.division)}`}{request.member.campus && ` · ${request.member.campus}`}</dd>
        {request.member.email && <><dt>Email</dt><dd className="dash-support-email">{request.member.email} <CopyIconButton text={request.member.email} label="Salin email" /></dd></>}
        <dt>Kompetisi</dt><dd><a href={request.competitionUrl} target="_blank" rel="noreferrer">{request.competition}</a>, tenggat {deadlineLabel(request.deadline)}</dd>
        <dt>Ikut sebagai</dt><dd>{request.participation === "team" ? `Tim: ${request.teamName}` : participationLabels.solo}</dd>
        <dt>Bantuan</dt><dd>{request.helpKinds.join(", ")}</dd>
        <dt>Progres</dt><dd>{request.progress}</dd>
      </dl>
      <fieldset disabled={busy} className="dash-support-handle">
        <Select id="support-status" label="Status" value={status} onChange={setStatus} options={options} />
        <div className="app-field"><label htmlFor="support-mentor">Mentor {needsMentor(status) && <span className="field-required" aria-hidden="true">*</span>}</label>
          <input id="support-mentor" maxLength={techSupportLimits.mentorName} value={mentorName} onChange={(event) => { setMentorName(event.target.value); setMentorError(""); }} placeholder="Nama mentor" aria-invalid={Boolean(mentorError)} aria-describedby={mentorError ? "support-mentor-error" : "support-mentor-hint"} />
          {mentorError ? <p className="field-error" id="support-mentor-error">{mentorError}</p> : <p className="field-hint" id="support-mentor-hint">Ditampilkan ke member. Hubungi mentornya di luar dashboard.</p>}</div>
        <div className="app-field"><label htmlFor="support-note">Catatan pengelola</label>
          <textarea data-lenis-prevent id="support-note" rows={3} maxLength={techSupportLimits.note} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Misalnya kapan mentor dihubungi." aria-describedby="support-note-hint" />
          <p className="field-hint" id="support-note-hint">Hanya terlihat oleh pengelola. {note.length}/{techSupportLimits.note} karakter.</p></div>
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
    </DialogContent>
    <DialogFooter>
      <button type="button" className="dash-dialog-button" disabled={busy} onClick={onClose}>Batal</button>
      <button type="submit" className="dash-dialog-button" data-primary disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
    </DialogFooter>
  </form>;
}

/** The handlers' queue: KPI counts, then every request with its response clock and a dialog to move it on. */
export function TechSupportQueue() {
  const viewer = useDashboardViewer();
  const data = useQuery(api.techSupport.queue, viewer.techSupportHandler ? {} : "skip");
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("open");
  const [handling, setHandling] = useState<Request | null>(null);
  if (!viewer.techSupportHandler) {
    return <div className="app-panel"><h2>Khusus pengelola Tech Support.</h2><p>Antrean ini dibuka untuk admin dan anggota yang ditunjuk pemilik sebagai pengelola Tech Support.</p><Link className="button button-blue" href="/dashboard/tech-support">Ke Tech Support</Link></div>;
  }
  if (data === undefined) return <LoadingPanel label="Memuat antrean…" />;
  const overdue = data.requests.filter((request) => isOverdue(request, now)).length;
  const rows = data.requests.filter((request) => filter === "all" || (filter === "open" ? request.status !== "closed" : request.status === filter));
  return <>
    <div className="dash-intro"><p className="eyebrow">KELOLA · TECH SUPPORT</p><h1>Antrean Tech Support.</h1>
      <p>Cocokkan setiap permintaan baru dengan mentor dalam {techSupportResponseDays} hari kerja (Senin sampai Jumat, WIB). Hubungi mentor dan member di luar dashboard, lalu catat statusnya di sini.</p></div>
    <dl className="dash-stats" aria-label="Capaian Tech Support">
      <div><dt>Permintaan difasilitasi</dt><dd>{data.kpis.facilitated}</dd></div>
      <div><dt>Tim didampingi</dt><dd>{data.kpis.teams}</dd></div>
      <div><dt>Baru, lewat target</dt><dd>{overdue}<small className="app-small"> dari {data.kpis.byStatus.new}</small></dd></div>
    </dl>
    <Select className="dash-support-filter" label="Tampilkan" value={filter} onChange={setFilter} options={filters.map((option) => ({ ...option, label: option.value in data.kpis.byStatus ? `${option.label} (${data.kpis.byStatus[option.value as TechSupportStatus]})` : option.label }))} />
    {!rows.length ? <div className="app-empty"><h2>{data.requests.length ? "Tidak ada permintaan dengan status ini." : "Belum ada permintaan."}</h2><p>Permintaan dari form Tech Support di dashboard member muncul di sini.</p></div>
      : <div className="dash-table-wrap" tabIndex={0} role="region" aria-label="Antrean permintaan"><table className="dash-table">
        <thead><tr><th scope="col">Kompetisi</th><th scope="col">Pemohon</th><th scope="col">Masuk</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Aksi</span></th></tr></thead>
        <tbody>{rows.map((request) => <tr key={request._id} data-overdue={isOverdue(request, now) || undefined}>
          <td><a className="dash-support-competition" href={request.competitionUrl} target="_blank" rel="noreferrer"><strong>{request.competition}</strong><PixelIcon name="external-link" size={14} /></a>
            <small className="app-small dash-support-clock">Tenggat {deadlineLabel(request.deadline)} · {request.participation === "team" ? `Tim: ${request.teamName}` : "Sendiri"} · {request.helpKinds.join(", ")}</small></td>
          <td>{request.member.name}<small className="app-small dash-support-clock">{request.member.campus}</small></td>
          <td>{dateLabel(request.submittedAt)}<ResponseClock request={request} now={now} /></td>
          <td><TechSupportStatusBadge status={request.status} />{request.mentorName && <small className="app-small dash-support-clock">Mentor: {request.mentorName}</small>}</td>
          <td><button type="button" className="text-button" onClick={() => setHandling(request)} aria-label={`Kelola permintaan ${request.member.name} untuk ${request.competition}`}>Kelola</button></td>
        </tr>)}</tbody>
      </table></div>}
    <DashboardDialog open={Boolean(handling)} onClose={() => setHandling(null)} title="Kelola permintaan" wide>
      {handling && <HandleDialog key={handling._id} request={handling} onClose={() => setHandling(null)} />}
    </DashboardDialog>
  </>;
}
