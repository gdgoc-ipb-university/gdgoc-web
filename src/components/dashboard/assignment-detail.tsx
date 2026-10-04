"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { assignmentLimits, assignmentMaxScore, assignmentPath, scoreLabel } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { Arrow } from "../icons";
import { MissingAssignment } from "./assignments";
import { AssignmentStatusBadge, CopyLinkButton, DueLabel, FileLink, ScoreBadge, SubmissionBadge, useNow } from "./shared";
import { RichTextView } from "../rich-text-view";
import { SubmissionForm, type SubmissionActions } from "./submission-form";
import { PixelIcon } from "../pixel-icons";

/** Posts a file to a Convex upload URL with progress events (fetch has no upload progress). */
function sendFile(url: string, file: File, onProgress: (fraction: number) => void, signal: AbortSignal) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const failed = () => reject(new Error("Unggahan gagal. Periksa koneksi, lalu coba lagi."));
    request.open("POST", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return failed();
      try { resolve((JSON.parse(request.responseText) as { storageId: Id<"_storage"> }).storageId); } catch { failed(); }
    };
    request.onerror = failed;
    request.onabort = () => reject(new DOMException("Unggahan dibatalkan.", "AbortError"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}

type Detail = NonNullable<FunctionReturnType<typeof api.assignments.get>>;

export function AssignmentDetail({ id }: { id: string }) {
  const data = useQuery(api.assignments.get, { id });
  const now = useNow();
  const router = useRouter();
  // Old IDs and renamed slugs land on the current link.
  const slug = data?.assignment.slug;
  useEffect(() => { if (slug && slug !== id) router.replace(`/dashboard/tugas/${slug}`); }, [slug, id, router]);
  if (data === undefined) return <LoadingPanel label="Memuat tugas…" />;
  if (!data) return <MissingAssignment />;
  const { assignment } = data;
  return <>
    <Link className="text-button app-back" href="/dashboard/tugas"><PixelIcon name="arrow-left" size={24} />{data.canManage ? "Kelola tugas" : "Semua tugas"}</Link>
    <article className="dash-assignment" aria-labelledby="assignment-title">
      <div className="app-record-top"><AssignmentStatusBadge status={assignment.status} />{!data.canManage && <SubmissionBadge submittedAt={data.submission?.submittedAt ?? null} late={data.submission?.late ?? false} />}{!data.canManage && data.submission && <ScoreBadge score={data.submission.score} maxScore={assignmentMaxScore(assignment)} reviewedAt={data.submission.reviewedAt} stale={data.submission.stale} />}</div>
      <h1 id="assignment-title">{assignment.title}</h1>
      <div className="dash-assignment-meta"><DueLabel dueAt={assignment.dueAt} now={now} open={assignment.status === "published"} /><CopyLinkButton path={assignmentPath(assignment)} /></div>
      <div className="dash-instructions">{assignment.description}</div>
    </article>
    {data.canManage ? <><StaffControls assignment={assignment} /><SubmissionList assignment={assignment} now={now} />{assignment.status !== "draft" && <MissingList assignment={assignment} />}</> : <MemberSubmission data={data} now={now} />}
  </>;
}

function MemberSubmission({ data, now }: { data: Detail; now: number }) {
  const { assignment, submission, files } = data;
  const generateUploadUrl = useMutation(api.assignments.generateUploadUrl);
  const attachFile = useMutation(api.assignments.attachFile);
  const removeFile = useMutation(api.assignments.removeFile);
  const submit = useMutation(api.assignments.submit);
  const actions: SubmissionActions = {
    async upload(file, { onProgress, signal }) {
      const url = await generateUploadUrl({ assignmentId: assignment._id });
      const storageId = await sendFile(url, file, onProgress, signal);
      return attachFile({ assignmentId: assignment._id, storageId, name: file.name });
    },
    removeFile: (fileId) => removeFile({ fileId }),
    submit: (args) => submit({ assignmentId: assignment._id, ...args }),
  };
  const result = submission?.reviewedAt ? <ReviewResult submission={submission} maxScore={assignmentMaxScore(assignment)} /> : null;
  if (assignment.status === "closed") {
    return <>{result}<section className="app-form-section dash-closed" aria-labelledby="closed-title"><h2 id="closed-title">Pengumpulan sudah ditutup.</h2>
      {submission ? <><p>Kamu mengirim pada {dateLabel(submission.submittedAt)}{submission.late ? " (terlambat)" : ""}.</p>{submission.answer && <RichTextView className="dash-answer" json={submission.answerDoc} text={submission.answer} />}<ul className="dash-file-list">{files.filter((file) => file.attached).map((file) => <li key={file._id}><FileLink file={file} /></li>)}</ul></>
        : <p>Kamu belum mengirim tugas ini sebelum pengumpulan ditutup.</p>}
    </section></>;
  }
  return <>{result}<SubmissionForm key={assignment._id} submission={submission} files={files} dueAt={assignment.dueAt} now={now} actions={actions} /></>;
}

type Reviewed = { score: number | null; feedback: string | null; reviewedAt: number | null; reviewerName: string | null; stale: boolean };

/** What the member sees once a reviewer has scored or commented. */
function ReviewResult({ submission, maxScore }: { submission: Reviewed; maxScore: number }) {
  return <section className="app-panel dash-result" aria-labelledby="result-title">
    <p className="eyebrow">HASIL PENILAIAN</p>
    <h2 id="result-title">{submission.score === null ? "Ada umpan balik untukmu." : "Kirimanmu sudah dinilai."}</h2>
    {submission.score !== null && <p className="dash-score">{submission.score}<small>dari {maxScore}</small></p>}
    {submission.feedback && <p className="dash-feedback">{submission.feedback}</p>}
    <p className="app-small">Dinilai {submission.reviewedAt ? dateLabel(submission.reviewedAt) : ""}{submission.reviewerName ? ` oleh ${submission.reviewerName}` : ""}.</p>
    {submission.stale && <p className="app-notice">Kamu memperbarui kiriman setelah penilaian ini. Nilai di atas berlaku untuk versi sebelumnya sampai ditinjau lagi.</p>}
  </section>;
}

function StaffControls({ assignment }: { assignment: Doc<"assignments"> }) {
  const router = useRouter();
  const setStatus = useMutation(api.assignments.setStatus);
  const remove = useMutation(api.assignments.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  const change = (status: Doc<"assignments">["status"]) => run(() => setStatus({ id: assignment._id, revision: assignment.revision, status }));
  const hint = { draft: "Draft hanya terlihat oleh admin.", published: "Member aktif bisa melihat dan mengumpulkan tugas ini.", closed: "Member bisa melihat tugas dan kirimannya, tetapi tidak bisa mengirim lagi." }[assignment.status];
  return <section className="dash-controls" aria-label="Kelola tugas">
    <p className="app-small">{hint}</p>
    <div className="app-inline-actions">
      {assignment.status !== "published" && <button className="button button-blue" disabled={busy} onClick={() => void change("published")}>{assignment.status === "draft" ? "Buka untuk member" : "Buka kembali"}</button>}
      {assignment.status === "published" && <button className="button button-quiet" disabled={busy} onClick={() => void change("closed")}>Tutup pengumpulan</button>}
      {assignment.status === "published" && <button className="text-button" disabled={busy} onClick={() => void change("draft")}>Kembalikan ke draft</button>}
      <Link className="text-button" href={`${assignmentPath(assignment)}/ubah`}>Ubah tugas <Arrow /></Link>
      {assignment.status === "draft" && (confirmDelete
        ? <span className="dash-confirm" role="group" aria-label="Konfirmasi hapus"><span>Hapus tugas ini?</span><button className="text-button text-danger" disabled={busy} onClick={() => void run(async () => { await remove({ id: assignment._id, revision: assignment.revision }); router.push("/dashboard/tugas"); })}>Ya, hapus</button><button className="text-button" onClick={() => setConfirmDelete(false)}>Batal</button></span>
        : <button className="text-button text-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Hapus draft</button>)}
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
  </section>;
}

type SubmissionRow = FunctionReturnType<typeof api.assignments.submissions>["page"][number];

function SubmissionList({ assignment, now }: { assignment: Doc<"assignments">; now: number }) {
  const list = usePaginatedQuery(api.assignments.submissions, { id: assignment._id }, { initialNumItems: 20 });
  const maxScore = assignmentMaxScore(assignment);
  const reviewed = list.results.filter((item) => item.reviewedAt !== null && !item.stale).length;
  return <section aria-labelledby="submissions-title"><div className="app-section-heading"><div><p className="eyebrow">KIRIMAN MEMBER</p><h2 id="submissions-title">Kiriman</h2></div>{list.status !== "LoadingFirstPage" && <span className="app-small">{list.results.length}{list.status === "CanLoadMore" ? "+" : ""} kiriman · {list.results.filter((item) => item.late).length} terlambat · {reviewed} dinilai</span>}</div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat kiriman…" /> : !list.results.length ? <div className="app-empty"><h3>Belum ada kiriman.</h3><p>{assignment.status === "draft" ? "Buka tugas ini agar member bisa mulai mengumpulkan." : assignment.dueAt > now ? "Kiriman member akan muncul di sini secara otomatis." : "Tenggat sudah lewat dan belum ada member yang mengirim."}</p></div>
      : <ul className="dash-submissions">{list.results.map((item) => <li key={item._id} className="app-panel">
        <div className="app-record-top"><div><strong>{item.name}</strong><span className="app-small">{[item.email, item.campus].filter(Boolean).join(" · ")}</span></div><span className="app-inline-badges"><SubmissionBadge submittedAt={item.submittedAt} late={item.late} /><ScoreBadge score={item.score} maxScore={maxScore} reviewedAt={item.reviewedAt} stale={item.stale} /></span></div>
        <p className="app-small">Dikirim {dateLabel(item.submittedAt)}</p>
        {item.answer && <RichTextView className="dash-answer" json={item.answerDoc} text={item.answer} />}
        {item.files.length > 0 && <ul className="dash-file-list" aria-label={`Lampiran dari ${item.name}`}>{item.files.map((file) => <li key={file._id}><FileLink file={file} /></li>)}</ul>}
        <ReviewForm key={`${item._id}:${item.revision}`} item={item} maxScore={maxScore} />
      </li>)}</ul>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(20)}>Muat kiriman lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat kiriman…</p>}
  </section>;
}

/** Active members who have not submitted, with a copyable "Nama — email" list for a reminder. Staff only, so emails are fine here. */
function MissingList({ assignment }: { assignment: Doc<"assignments"> }) {
  const data = useQuery(api.assignments.missing, { id: assignment._id });
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    if (!data) return;
    const text = data.missing.map((row) => `${row.name} — ${row.email}`).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied("copied"); } catch { setCopied("failed"); }
    setTimeout(() => setCopied("idle"), 2500);
  }
  return <section className="dash-missing" aria-labelledby="missing-title">
    <div className="app-section-heading"><div><p className="eyebrow">BELUM MENGUMPULKAN</p><h2 id="missing-title">Siapa yang belum</h2></div>
      {data && <span className="app-small">{data.missing.length} dari {data.active} member aktif belum mengirim</span>}</div>
    {!data ? <LoadingPanel label="Memeriksa member…" /> : !data.missing.length ? <p className="app-small">{data.active ? "Semua member aktif sudah mengirim tugas ini." : "Belum ada member aktif yang terdaftar."}</p>
      : <><ul className="dash-missing-list">{data.missing.map((row) => <li key={row.ownerId}><strong>{row.name}</strong><span className="app-small">{[row.email, row.campus].filter(Boolean).join(" · ")}</span></li>)}</ul>
        <div className="app-inline-actions"><button type="button" className="text-button" onClick={() => void copy()}><PixelIcon name={copied === "copied" ? "check" : "copy"} size={16} />{copied === "copied" ? "Daftar tersalin" : "Salin daftar nama dan email"}</button>
          <span className="sr-only" role="status">{copied === "copied" ? "Daftar member yang belum mengumpulkan tersalin." : ""}</span>
          {copied === "failed" && <small role="alert">Tidak bisa menyalin otomatis. Pilih dan salin daftar di atas.</small>}</div>
        <p className="app-small">Admin dan pemilik tidak dihitung. Member nonaktif tidak ditampilkan.</p></>}
  </section>;
}

/** Score and feedback for one submission. Keyed by revision upstream, so a resubmission resets the form to the new version. */
function ReviewForm({ item, maxScore }: { item: SubmissionRow; maxScore: number }) {
  const review = useMutation(api.assignments.review);
  const [score, setScore] = useState(item.score === null ? "" : String(item.score));
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const id = `review-${item._id}`;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = score.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) { setError(`Nilai harus bilangan bulat 0 sampai ${maxScore}.`); return; }
    setBusy(true); setError(""); setSaved(false);
    try { await review({ submissionId: item._id, submissionRevision: item.revision, score: trimmed ? Number(trimmed) : undefined, feedback }); setSaved(true); }
    catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }
  return <form className="dash-review-form" onSubmit={save} aria-label={`Penilaian untuk ${item.name}`}>
    <fieldset disabled={busy}><legend className="sr-only">Penilaian</legend>
      {item.stale && <p className="app-notice">Member memperbarui kiriman setelah dinilai. Periksa versi terbaru, lalu simpan penilaian lagi.</p>}
      <div className="dash-review-fields">
        <div className="app-field"><label htmlFor={`${id}-score`}>Nilai (0–{maxScore})</label><input id={`${id}-score`} type="number" inputMode="numeric" min={0} max={maxScore} step={1} value={score} onChange={(event) => setScore(event.target.value)} placeholder="—" /></div>
        <div className="app-field"><label htmlFor={`${id}-feedback`}>Umpan balik untuk member</label><textarea data-lenis-prevent id={`${id}-feedback`} rows={3} maxLength={assignmentLimits.feedback} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Apa yang sudah baik, apa yang perlu diperbaiki." /></div>
      </div>
      <div className="app-inline-actions"><button className="button button-blue" type="submit">{busy ? "Menyimpan…" : item.reviewedAt === null ? "Simpan penilaian" : "Perbarui penilaian"}</button>
        {item.reviewedAt !== null && !saved && <span className="app-small">Dinilai {dateLabel(item.reviewedAt)}{item.reviewerName ? ` oleh ${item.reviewerName}` : ""}{item.score !== null ? ` · ${scoreLabel(item.score, maxScore)}` : ""}</span>}
        {saved && <span className="app-small" role="status">Penilaian tersimpan. Member bisa melihatnya sekarang.</span>}</div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </fieldset>
  </form>;
}
