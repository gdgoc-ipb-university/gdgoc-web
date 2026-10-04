"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { assignmentLimits, fileProblem, fileSizeLabel, maxSubmissionFiles } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { isOptimizableImage, maxImageInputBytes, optimizeImage } from "@/lib/image-optimize";
import { docFromPlainText, parseRichDoc, richText, type RichDoc } from "@/lib/rich-text";
import { dateLabel } from "../appreciation/shared";
import { PixelIcon, type PixelIconName } from "../pixel-icons";
import { FileDropzone } from "./file-dropzone";
import { RichTextEditor } from "./rich-text-editor";
import { FileLink } from "./shared";

type FileId = Id<"submissionFiles">;
export type SubmissionFile = { _id: FileId; name: string; size: number; attached: boolean; url: string | null };
export type UploadOptions = { onProgress: (fraction: number) => void; signal: AbortSignal };
export type SubmissionActions = {
  upload: (file: File, options: UploadOptions) => Promise<{ fileId: FileId } | { error: string }>;
  removeFile: (fileId: FileId) => Promise<unknown>;
  submit: (args: { revision: number; answer: string; answerDoc: string; fileIds: FileId[] }) => Promise<unknown>;
};
type Submission = { answer: string; answerDoc: string | null; revision: number; submittedAt: number; late: boolean };
type Upload = { key: string; name: string; size: number; progress: number; optimizing?: boolean; error?: string; controller?: AbortController };

const startingDoc = (submission: Submission | null): RichDoc => parseRichDoc(submission?.answerDoc) ?? docFromPlainText(submission?.answer ?? "");

export function fileIcon(name: string): PixelIconName {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "image";
  return extension === "zip" ? "archive" : "file-text";
}

export function SubmissionForm({ submission, files, dueAt, now, actions, optimize = optimizeImage }: {
  submission: Submission | null; files: SubmissionFile[]; dueAt: number; now: number; actions: SubmissionActions;
  optimize?: (file: File) => Promise<File>;
}) {
  // `seed` feeds the editor when it mounts; bumping its version reloads the editor content.
  const [seed, setSeed] = useState(() => ({ version: 0, doc: startingDoc(submission) }));
  const [doc, setDoc] = useState(seed.doc);
  const [selected, setSelected] = useState<FileId[]>(() => files.map((file) => file._id));
  const [base, setBase] = useState(submission?.revision ?? 0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  // Original sizes of images compressed in this session, to show the saving.
  const [savings, setSavings] = useState<Record<string, number>>({});
  const focusEditor = useRef<(() => void) | null>(null);
  const uploading = uploads.some((upload) => !upload.error);
  const shown = selected.map((id) => files.find((file) => file._id === id)).filter((file): file is SubmissionFile => Boolean(file));
  const room = maxSubmissionFiles - selected.length - uploads.filter((upload) => !upload.error).length;
  const changedElsewhere = (submission?.revision ?? 0) !== base;
  const setUpload = (key: string, change: Partial<Upload> | null) => setUploads((current) => change ? current.map((upload) => upload.key === key ? { ...upload, ...change } : upload) : current.filter((upload) => upload.key !== key));

  async function addFiles(list: File[]) {
    setError(""); setDone("");
    const accepted = list.slice(0, Math.max(0, room));
    if (accepted.length < list.length) setError(accepted.length ? `Hanya ${accepted.length} file pertama yang ditambahkan. Maksimal ${maxSubmissionFiles} file per kiriman.` : `Lampiran sudah ${maxSubmissionFiles} file. Hapus salah satu untuk menambah file lain.`);
    await Promise.all(accepted.map(async (original) => {
      const key = crypto.randomUUID();
      const image = isOptimizableImage(original);
      // Images may start larger than the limit because they are compressed first.
      const early = image
        ? original.size > maxImageInputBytes ? "Gambar maksimal 25 MB sebelum dikompres." : null
        : fileProblem(original.name, original.type || "application/octet-stream", original.size);
      if (early) { setUploads((current) => [...current, { key, name: original.name, size: original.size, progress: 0, error: early }]); return; }
      const controller = new AbortController();
      setUploads((current) => [...current, { key, name: original.name, size: original.size, progress: 0, optimizing: image, controller }]);
      const file = image ? await optimize(original) : original;
      if (controller.signal.aborted) { setUpload(key, null); return; }
      const problem = fileProblem(file.name, file.type || "application/octet-stream", file.size);
      if (problem) { setUpload(key, { name: file.name, size: file.size, optimizing: false, controller: undefined, error: image && file === original ? `${problem} Gambar tidak bisa dikompres di browser ini.` : problem }); return; }
      setUpload(key, { name: file.name, size: file.size, optimizing: false });
      try {
        const result = await actions.upload(file, { signal: controller.signal, onProgress: (progress) => setUpload(key, { progress }) });
        if ("error" in result) throw new Error(result.error);
        if (file !== original) setSavings((current) => ({ ...current, [result.fileId]: original.size }));
        setSelected((current) => [...current, result.fileId]);
        setUpload(key, null);
      } catch (cause) {
        if (controller.signal.aborted) { setUpload(key, null); return; }
        const message = cause instanceof Error && !("data" in cause) ? cause.message : readableError(cause);
        setUpload(key, { error: message || "Unggahan gagal. Coba lagi.", controller: undefined });
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
    const answer = richText(doc);
    if (!answer && !selected.length) { setError("Tulis jawaban atau lampirkan setidaknya satu file."); focusEditor.current?.(); return; }
    setBusy(true);
    try {
      await actions.submit({ revision: base, answer, answerDoc: JSON.stringify(doc), fileIds: selected });
      setBase(base + 1);
      // Same clock as the deadline notice below (`now` from useNow), so the message and the tests agree on what "late" means.
      setDone(now > dueAt ? "Tugas terkirim dan ditandai terlambat." : "Tugas terkirim. Kamu masih bisa memperbaruinya selama pengumpulan dibuka.");
    } catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }

  function reload() {
    const next = startingDoc(submission);
    setSeed((current) => ({ version: current.version + 1, doc: next }));
    setDoc(next);
    setSelected(files.filter((file) => file.attached).map((file) => file._id));
    setBase(submission?.revision ?? 0);
    setError(""); setDone("");
  }

  return <form className="app-form dash-submit" onSubmit={send} noValidate aria-labelledby="submit-title"><fieldset disabled={busy}>
    <div className="app-form-section">
      <div className="form-section-title"><span aria-hidden="true">✎</span><div><h2 id="submit-title">{submission ? "Perbarui kirimanmu" : "Kumpulkan tugas"}</h2><p>{submission ? `Terakhir dikirim ${dateLabel(submission.submittedAt)}${submission.late ? " · terlambat" : ""}.` : "Tulis jawaban, lampirkan file, atau keduanya."}</p></div></div>
      {now > dueAt && <p className="app-notice">Tenggat sudah lewat. Kiriman tetap diterima dan akan ditandai terlambat{submission && !submission.late ? ", termasuk jika kamu memperbarui kiriman yang sudah tepat waktu" : ""}.</p>}
      {changedElsewhere && <div className="app-notice" role="status"><p>Kiriman ini baru diperbarui dari tab atau perangkat lain.</p><button type="button" className="text-button" onClick={reload}>Pakai versi terbaru</button></div>}
      <div className="app-field">
        <span className="dash-label" id="answer-label">Jawaban <span className="field-optional">(opsional jika melampirkan file)</span></span>
        <p className="field-hint dash-hint-above" id="answer-hint">Gunakan toolbar untuk judul, daftar, kode, atau tautan demo.</p>
        <RichTextEditor key={seed.version} id="answer" labelledBy="answer-label" describedBy="answer-hint" initialDoc={seed.doc} disabled={busy}
          maxLength={assignmentLimits.answer} placeholder="Ringkasan pengerjaan, link demo, atau catatan untuk admin." focusRef={focusEditor}
          onChange={(next) => { setDoc(next); setDone(""); }} />
      </div>
      <div className="app-field">
        <span className="dash-label" id="files-label">Lampiran</span>
        <FileDropzone room={room} disabled={busy} describedBy="files-hint" onFiles={(list) => void addFiles(list)} />
        <p className="field-hint" id="files-hint">PDF, PNG, JPG, WebP, TXT, ZIP, DOCX, PPTX, atau XLSX. Gambar (hingga 25 MB) otomatis dikecilkan ke WebP dan metadatanya dihapus; PDF, dokumen Office, dan ZIP sudah terkompresi sehingga diunggah apa adanya. File yang diunggah baru terkirim setelah kamu menekan {submission ? "Kirim ulang" : "Kirim tugas"}.</p>
        {(shown.length > 0 || uploads.length > 0) && <ul className="dash-file-list dash-upload-list" aria-labelledby="files-label">
          {shown.map((file) => <li key={file._id}>
            <PixelIcon name={fileIcon(file.name)} size={20} className="dash-file-type" />
            <div className="dash-file-main"><FileLink file={file} />{(savings[file._id] || !file.attached) && <span className="dash-file-notes">{savings[file._id] && <small className="dash-file-saved">WebP · hemat {Math.round((1 - file.size / savings[file._id]) * 100)}% dari {fileSizeLabel(savings[file._id])}</small>}{!file.attached && <small className="dash-file-pending">Belum dikirim</small>}</span>}</div>
            <button type="button" className="dash-icon-button" onClick={() => void removeFile(file)} aria-label={`Hapus ${file.name}`} title="Hapus"><PixelIcon name="trash" size={18} /></button>
          </li>)}
          {uploads.map((upload) => {
            const percent = Math.round(upload.progress * 100);
            return <li key={upload.key} data-error={Boolean(upload.error)}>
              <PixelIcon name={fileIcon(upload.name)} size={20} className="dash-file-type" />
              <div className="dash-file-main">
                <span className="dash-file">{upload.name} <small>{fileSizeLabel(upload.size)}</small></span>
                {upload.error ? <small className="field-error" role="alert">{upload.error}</small>
                  : upload.optimizing ? <small className="dash-file-optimizing" role="status">Mengompres gambar ke WebP…</small>
                  : <span className="dash-progress-row"><span className="dash-progress" role="progressbar" aria-label={`Mengunggah ${upload.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></span><small>{percent < 100 ? `${percent}%` : "Memeriksa…"}</small></span>}
              </div>
              {upload.error
                ? <button type="button" className="dash-icon-button" onClick={() => setUpload(upload.key, null)} aria-label={`Tutup pesan untuk ${upload.name}`} title="Tutup"><PixelIcon name="close" size={18} /></button>
                : <button type="button" className="dash-icon-button" onClick={() => upload.controller?.abort()} aria-label={`Batalkan unggahan ${upload.name}`} title="Batalkan"><PixelIcon name="close" size={18} /></button>}
            </li>;
          })}
        </ul>}
      </div>
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
    {done && <p className="dash-success" role="status">{done}</p>}
    <div className="app-submit-bar"><div><strong>{submission ? "Kiriman lama akan diganti." : "Admin bisa melihat kirimanmu."}</strong><p>Jawaban dan file hanya bisa dilihat olehmu dan admin GDGoC IPB.</p></div><button className="button button-blue" type="submit" disabled={uploading}>{busy ? "Mengirim…" : uploading ? "Menunggu unggahan…" : submission ? "Kirim ulang" : "Kirim tugas"}</button></div>
  </fieldset></form>;
}
