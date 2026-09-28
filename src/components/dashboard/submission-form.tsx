"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { acceptAttribute, assignmentLimits, fileProblem, maxSubmissionFiles } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { dateLabel } from "../appreciation/shared";
import { FileLink } from "./shared";

type FileId = Id<"submissionFiles">;
export type SubmissionFile = { _id: FileId; name: string; size: number; attached: boolean; url: string | null };
export type SubmissionActions = {
  upload: (file: File) => Promise<{ fileId: FileId } | { error: string }>;
  removeFile: (fileId: FileId) => Promise<unknown>;
  submit: (args: { revision: number; answer: string; fileIds: FileId[] }) => Promise<unknown>;
};
type Upload = { key: string; name: string; error?: string };

export function SubmissionForm({ submission, files, dueAt, now, actions }: {
  submission: { answer: string; revision: number; submittedAt: number; late: boolean } | null;
  files: SubmissionFile[]; dueAt: number; now: number; actions: SubmissionActions;
}) {
  const [answer, setAnswer] = useState(submission?.answer ?? "");
  const [selected, setSelected] = useState<FileId[]>(() => files.map((file) => file._id));
  const [base, setBase] = useState(submission?.revision ?? 0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);
  const uploading = uploads.some((upload) => !upload.error);
  const shown = selected.map((id) => files.find((file) => file._id === id)).filter((file): file is SubmissionFile => Boolean(file));
  const room = maxSubmissionFiles - selected.length - uploads.filter((upload) => !upload.error).length;
  const changedElsewhere = (submission?.revision ?? 0) !== base;

  async function addFiles(list: FileList | null) {
    setError(""); setDone("");
    const chosen = Array.from(list ?? []);
    if (picker.current) picker.current.value = "";
    if (chosen.length > room) { setError(`Lampirkan maksimal ${maxSubmissionFiles} file. Hapus file lain terlebih dahulu.`); return; }
    await Promise.all(chosen.map(async (file) => {
      const key = crypto.randomUUID();
      const problem = fileProblem(file.name, file.type || "application/octet-stream", file.size);
      if (problem) { setUploads((current) => [...current, { key, name: file.name, error: problem }]); return; }
      setUploads((current) => [...current, { key, name: file.name }]);
      try {
        const result = await actions.upload(file);
        if ("error" in result) throw new Error(result.error);
        setSelected((current) => [...current, result.fileId]);
        setUploads((current) => current.filter((upload) => upload.key !== key));
      } catch (cause) {
        const message = cause instanceof Error && !("data" in cause) ? cause.message : readableError(cause);
        setUploads((current) => current.map((upload) => upload.key === key ? { ...upload, error: message || "Unggahan gagal. Coba lagi." } : upload));
      }
    }));
  }

  async function removeFile(file: SubmissionFile) {
    setError(""); setDone("");
    setSelected((current) => current.filter((id) => id !== file._id));
    // Files already in the submission are replaced when the form is sent.
    if (!file.attached) {
      try { await actions.removeFile(file._id); } catch (cause) { setError(readableError(cause)); }
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setDone("");
    if (!answer.trim() && !selected.length) { setError("Tulis jawaban atau lampirkan setidaknya satu file."); answerField.current?.focus(); return; }
    setBusy(true);
    try {
      await actions.submit({ revision: base, answer, fileIds: selected });
      setBase(base + 1);
      setDone(Date.now() > dueAt ? "Tugas terkirim dan ditandai terlambat." : "Tugas terkirim. Kamu masih bisa memperbaruinya selama pengumpulan dibuka.");
    } catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }

  function reload() {
    setAnswer(submission?.answer ?? "");
    setSelected(files.filter((file) => file.attached).map((file) => file._id));
    setBase(submission?.revision ?? 0);
    setError(""); setDone("");
  }

  return <form className="app-form dash-submit" onSubmit={send} noValidate aria-labelledby="submit-title"><fieldset disabled={busy}>
    <div className="app-form-section">
      <div className="form-section-title"><span aria-hidden="true">✎</span><div><h2 id="submit-title">{submission ? "Perbarui kirimanmu" : "Kumpulkan tugas"}</h2><p>{submission ? `Terakhir dikirim ${dateLabel(submission.submittedAt)}${submission.late ? " · terlambat" : ""}.` : "Tulis jawaban, lampirkan file, atau keduanya."}</p></div></div>
      {now > dueAt && <p className="app-notice">Tenggat sudah lewat. Kiriman tetap diterima dan akan ditandai terlambat{submission && !submission.late ? ", termasuk jika kamu memperbarui kiriman yang sudah tepat waktu" : ""}.</p>}
      {changedElsewhere && <div className="app-notice" role="status"><p>Kiriman ini baru diperbarui dari tab atau perangkat lain.</p><button type="button" className="text-button" onClick={reload}>Pakai versi terbaru</button></div>}
      <div className="app-field"><label htmlFor="answer">Jawaban <span className="field-optional">(opsional jika melampirkan file)</span></label><textarea data-lenis-prevent id="answer" ref={answerField} rows={8} maxLength={assignmentLimits.answer} value={answer} onChange={(event) => { setAnswer(event.target.value); setDone(""); }} aria-describedby="answer-hint" placeholder="Ringkasan pengerjaan, link demo, atau catatan untuk admin." /><p className="field-hint" id="answer-hint">{answer.length}/{assignmentLimits.answer} karakter.</p></div>
      <div className="app-field"><span className="dash-label" id="files-label">Lampiran</span>
        {(shown.length > 0 || uploads.length > 0) && <ul className="dash-file-list" aria-labelledby="files-label">
          {shown.map((file) => <li key={file._id}><FileLink file={file} />{!file.attached && <small className="dash-file-pending">Belum dikirim</small>}<button type="button" className="text-button text-danger" onClick={() => void removeFile(file)} aria-label={`Hapus ${file.name}`}>Hapus</button></li>)}
          {uploads.map((upload) => <li key={upload.key} data-error={Boolean(upload.error)}><span className="dash-file">{upload.name}</span>{upload.error ? <><small className="field-error" role="alert">{upload.error}</small><button type="button" className="text-button" onClick={() => setUploads((current) => current.filter((item) => item.key !== upload.key))} aria-label={`Tutup pesan untuk ${upload.name}`}>Tutup</button></> : <small role="status">Mengunggah…</small>}</li>)}
        </ul>}
        <input ref={picker} data-testid="file-input" hidden type="file" multiple accept={acceptAttribute} onChange={(event) => void addFiles(event.target.files)} />
        <button type="button" className="button button-quiet dash-file-picker" onClick={() => picker.current?.click()} disabled={room <= 0} aria-describedby="files-hint">Pilih file</button>
        <p className="field-hint" id="files-hint">Maksimal {maxSubmissionFiles} file, masing-masing 10 MB: PDF, PNG, JPG, WebP, TXT, ZIP, DOCX, PPTX, atau XLSX.</p>
      </div>
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
    {done && <p className="dash-success" role="status">{done}</p>}
    <div className="app-submit-bar"><div><strong>{submission ? "Kiriman lama akan diganti." : "Admin bisa melihat kirimanmu."}</strong><p>Jawaban dan file hanya bisa dilihat olehmu dan admin GDGoC IPB.</p></div><button className="button button-blue" type="submit" disabled={uploading}>{busy ? "Mengirim…" : uploading ? "Menunggu unggahan…" : submission ? "Kirim ulang" : "Kirim tugas"}</button></div>
  </fieldset></form>;
}
