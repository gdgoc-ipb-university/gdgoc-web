"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { Arrow } from "../icons";
import { MissingAssignment } from "./assignments";
import { AssignmentStatusBadge, DueLabel, FileLink, SubmissionBadge, useNow } from "./shared";
import { SubmissionForm, type SubmissionActions } from "./submission-form";

type Detail = NonNullable<FunctionReturnType<typeof api.assignments.get>>;

export function AssignmentDetail({ id }: { id: string }) {
  const data = useQuery(api.assignments.get, { id });
  const now = useNow();
  if (data === undefined) return <LoadingPanel label="Memuat tugas…" />;
  if (!data) return <MissingAssignment />;
  const { assignment } = data;
  return <>
    <Link className="text-button app-back" href="/dashboard/tugas">← {data.canManage ? "Kelola tugas" : "Semua tugas"}</Link>
    <article className="dash-assignment" aria-labelledby="assignment-title">
      <div className="app-record-top"><AssignmentStatusBadge status={assignment.status} />{!data.canManage && <SubmissionBadge submittedAt={data.submission?.submittedAt ?? null} late={data.submission?.late ?? false} />}</div>
      <h1 id="assignment-title">{assignment.title}</h1>
      <DueLabel dueAt={assignment.dueAt} now={now} open={assignment.status === "published"} />
      <div className="dash-instructions">{assignment.description}</div>
    </article>
    {data.canManage ? <><StaffControls assignment={assignment} /><SubmissionList assignment={assignment} now={now} /></> : <MemberSubmission data={data} now={now} />}
  </>;
}

function MemberSubmission({ data, now }: { data: Detail; now: number }) {
  const { assignment, submission, files } = data;
  const generateUploadUrl = useMutation(api.assignments.generateUploadUrl);
  const attachFile = useMutation(api.assignments.attachFile);
  const removeFile = useMutation(api.assignments.removeFile);
  const submit = useMutation(api.assignments.submit);
  const actions: SubmissionActions = {
    async upload(file) {
      const url = await generateUploadUrl({ assignmentId: assignment._id });
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!response.ok) throw new Error("Unggahan gagal. Periksa koneksi, lalu coba lagi.");
      const { storageId } = await response.json() as { storageId: Id<"_storage"> };
      return attachFile({ assignmentId: assignment._id, storageId, name: file.name });
    },
    removeFile: (fileId) => removeFile({ fileId }),
    submit: (args) => submit({ assignmentId: assignment._id, ...args }),
  };
  if (assignment.status === "closed") {
    return <section className="app-form-section dash-closed" aria-labelledby="closed-title"><h2 id="closed-title">Pengumpulan sudah ditutup.</h2>
      {submission ? <><p>Kamu mengirim pada {dateLabel(submission.submittedAt)}{submission.late ? " (terlambat)" : ""}.</p>{submission.answer && <div className="dash-answer">{submission.answer}</div>}<ul className="dash-file-list">{files.filter((file) => file.attached).map((file) => <li key={file._id}><FileLink file={file} /></li>)}</ul></>
        : <p>Kamu belum mengirim tugas ini sebelum pengumpulan ditutup.</p>}
    </section>;
  }
  return <SubmissionForm key={assignment._id} submission={submission} files={files} dueAt={assignment.dueAt} now={now} actions={actions} />;
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
      <Link className="text-button" href={`/dashboard/tugas/${assignment._id}/ubah`}>Ubah tugas <Arrow /></Link>
      {assignment.status === "draft" && (confirmDelete
        ? <span className="dash-confirm" role="group" aria-label="Konfirmasi hapus"><span>Hapus tugas ini?</span><button className="text-button text-danger" disabled={busy} onClick={() => void run(async () => { await remove({ id: assignment._id, revision: assignment.revision }); router.push("/dashboard/tugas"); })}>Ya, hapus</button><button className="text-button" onClick={() => setConfirmDelete(false)}>Batal</button></span>
        : <button className="text-button text-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Hapus draft</button>)}
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
  </section>;
}

function SubmissionList({ assignment, now }: { assignment: Doc<"assignments">; now: number }) {
  const list = usePaginatedQuery(api.assignments.submissions, { id: assignment._id }, { initialNumItems: 20 });
  return <section aria-labelledby="submissions-title"><div className="app-section-heading"><div><p className="eyebrow">KIRIMAN MEMBER</p><h2 id="submissions-title">Kiriman</h2></div>{list.status !== "LoadingFirstPage" && <span className="app-small">{list.results.length}{list.status === "CanLoadMore" ? "+" : ""} kiriman · {list.results.filter((item) => item.late).length} terlambat</span>}</div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat kiriman…" /> : !list.results.length ? <div className="app-empty"><h3>Belum ada kiriman.</h3><p>{assignment.status === "draft" ? "Buka tugas ini agar member bisa mulai mengumpulkan." : assignment.dueAt > now ? "Kiriman member akan muncul di sini secara otomatis." : "Tenggat sudah lewat dan belum ada member yang mengirim."}</p></div>
      : <ul className="dash-submissions">{list.results.map((item) => <li key={item._id} className="app-panel">
        <div className="app-record-top"><div><strong>{item.name}</strong><span className="app-small">{[item.email, item.campus].filter(Boolean).join(" · ")}</span></div><SubmissionBadge submittedAt={item.submittedAt} late={item.late} /></div>
        <p className="app-small">Dikirim {dateLabel(item.submittedAt)}</p>
        {item.answer && <div className="dash-answer">{item.answer}</div>}
        {item.files.length > 0 && <ul className="dash-file-list" aria-label={`Lampiran dari ${item.name}`}>{item.files.map((file) => <li key={file._id}><FileLink file={file} /></li>)}</ul>}
      </li>)}</ul>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(20)}>Muat kiriman lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat kiriman…</p>}
  </section>;
}
