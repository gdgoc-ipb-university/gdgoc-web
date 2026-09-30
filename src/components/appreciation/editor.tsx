"use client";

import type { MemberType } from "@/lib/onboarding";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { achievementLevels, chapterPeriod, fieldLimits, memberTypes, participationTypes, todayInWib, validateAppreciation, type AppreciationField, type AppreciationValues, type FieldErrors } from "@/lib/appreciation";
import { DraftSession, readableError } from "@/lib/draft-session";
import { Arrow } from "../icons";
import { LoadingPanel, RecordDetails, StatusBadge, dateLabel } from "./shared";

type Viewer = { id: string; name: string; email: string; isAdmin: boolean; memberType?: MemberType | null };
type EditorProps = { id: Id<"appreciations">; viewer: Viewer; onBack: () => void };
type DraftActions = {
  save: (args: { id: Id<"appreciations">; values: AppreciationValues; revision: number }) => Promise<{ revision: number; updatedAt: number }>;
  submit: (args: { id: Id<"appreciations">; revision: number }) => Promise<Id<"appreciations">>;
  remove: (args: { id: Id<"appreciations">; revision: number }) => Promise<null>;
};
function subscribeOnline(fn: () => void) { window.addEventListener("online", fn); window.addEventListener("offline", fn); return () => { window.removeEventListener("online", fn); window.removeEventListener("offline", fn); }; }
const getOnline = () => navigator.onLine;
const serverOnline = () => true;

export function AppreciationEditor({ id, viewer, onBack }: EditorProps) {
  const record = useQuery(api.appreciations.get, { id });
  const save = useMutation(api.appreciations.save);
  const submit = useMutation(api.appreciations.submit);
  const remove = useMutation(api.appreciations.removeDraft);
  if (!record) return <LoadingPanel />;
  if (!["draft", "revision"].includes(record.status)) return <><button className="text-button app-back" onClick={onBack}>← Semua kiriman</button><section className="app-panel submission-receipt"><StatusBadge status={record.status} /><h2>{record.status === "published" ? "Prestasi yang ikut menginspirasi." : "Terima kasih sudah berbagi."}</h2><p>{record.status === "published" ? "Apresiasimu sudah dipost di Instagram GDGoC IPB." : "Kirimanmu tersimpan untuk ditinjau tim Media & Creative. Cek status dan catatan tim di halaman ini."}</p><p className="app-small">Dikirim {dateLabel(record.submittedAt ?? record.updatedAt)}</p>{record.reviewNote && <p className="review-note">{record.reviewNote}</p>}{record.postUrl && <a className="button button-blue" href={record.postUrl} target="_blank" rel="noopener noreferrer">Lihat post Instagram <Arrow diagonal /></a>}<details><summary>Lihat detail kiriman</summary><RecordDetails record={record} /></details></section></>;
  return <DraftEditor record={record} viewer={viewer} onBack={onBack} actions={{ save, submit, remove }} />;
}

export function DraftEditor({ record, viewer, onBack, actions }: { record: Doc<"appreciations">; viewer: Viewer; onBack: () => void; actions: DraftActions }) {
  const { save, submit, remove } = actions;
  const [session] = useState(() => {
    let cache: Storage | undefined;
    try { cache = window.localStorage; } catch { /* Cloud saving still works when local storage is unavailable. */ }
    return new DraftSession(record, (values, revision) => save({ id: record._id, values, revision }), cache, `gdgoc:apresiasi:${viewer.id}:${record._id}`);
  });
  const draft = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const online = useSyncExternalStore(subscribeOnline, getOnline, serverOnline);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { session.start(); return () => session.stop(); }, [session]);
  useEffect(() => { session.receive(record); }, [record, session]);
  useEffect(() => {
    const retry = () => { void session.flush(); };
    const leaving = (event: BeforeUnloadEvent) => { if (session.getSnapshot().phase !== "saved") { event.preventDefault(); } };
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", leaving);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("beforeunload", leaving); };
  }, [session]);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);

  function update<K extends AppreciationField>(field: K, value: AppreciationValues[K]) {
    session.update({ ...session.getSnapshot().values, [field]: value });
    setErrors((old) => ({ ...old, [field]: undefined }));
  }
  async function leave() {
    setBusy(true);
    try { if (await session.flush()) onBack(); }
    finally { setBusy(false); }
  }
  async function reviewForm() {
    const found = validateAppreciation(draft.values);
    setErrors(found);
    if (Object.keys(found).length) {
      const field = Array.from(form.current?.elements ?? []).find((element) => "name" in element && found[element.name as AppreciationField]);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setBusy(true); setError("");
    try { if (await session.flush()) setPreview(true); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true); setError("");
    try {
      if (!(await session.flush())) return;
      await submit({ id: record._id, revision: session.getSnapshot().revision });
    } catch (error) { setError(readableError(error)); }
    finally { setBusy(false); }
  }
  async function deleteDraft() {
    setBusy(true); setError("");
    try {
      if (!(await session.flush())) return;
      await remove({ id: record._id, revision: session.getSnapshot().revision });
      onBack();
    } catch (error) { setError(readableError(error)); }
    finally { setBusy(false); }
  }

  function field(name: Exclude<AppreciationField, "publicationConsent">, label: string, options: { hint?: string; placeholder?: string; optional?: boolean; rows?: number; type?: string; choices?: readonly string[]; min?: string; max?: string } = {}) {
    const describedBy = [options.hint ? `${name}-hint` : "", errors[name] ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = { id: name, name, value: draft.values[name], required: !options.optional, "aria-invalid": Boolean(errors[name]), "aria-describedby": describedBy, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(name, event.target.value) };
    let control: ReactNode;
    if (options.choices) control = <select {...common}><option value="">Pilih {label.toLowerCase()}</option>{options.choices.map((choice) => <option key={choice}>{choice}</option>)}</select>;
    else if (options.rows) control = <textarea {...common} rows={options.rows} placeholder={options.placeholder} maxLength={fieldLimits[name]} data-lenis-prevent />;
    else control = <input {...common} type={options.type || "text"} placeholder={options.placeholder} maxLength={fieldLimits[name]} min={options.min} max={options.max} autoComplete={name === "fullName" ? "name" : "off"} />;
    return <div className="app-field"><label htmlFor={name}>{label} {options.optional ? <span className="field-optional">opsional</span> : <span aria-hidden="true" className="field-required">*</span>}</label>{control}{options.hint && <p className="field-hint" id={`${name}-hint`}>{options.hint}</p>}{errors[name] && <p className="field-error" id={`${name}-error`}>{errors[name]}</p>}</div>;
  }
  // The picker stops at the end of the chapter year or today, whichever comes first.
  const today = todayInWib();
  const latestEventDate = today < chapterPeriod.end ? today : chapterPeriod.end;
  const saveText = !online ? (draft.localBackup ? "Offline · cadangan di perangkat ini" : "Offline · perubahan belum tersimpan") : { saved: "Tersimpan di akun", dirty: "Ada perubahan belum tersimpan", saving: "Menyimpan ke akun…", error: "Belum tersimpan ke akun", conflict: "Ada dua versi draft" }[draft.phase];

  return <><div className="editor-toolbar"><button className="text-button" onClick={leave} disabled={busy || !online}>← Semua kiriman</button><span className="save-indicator" data-phase={online ? draft.phase : "error"} role="status"><i />{saveText}</span></div>
    {!online && <p className="app-notice" role="status">{draft.localBackup ? "Kamu bisa tetap mengisi. Perubahan disimpan di browser ini dan akan disinkronkan setelah terhubung kembali." : "Penyimpanan lokal tidak tersedia. Jangan tutup halaman sebelum koneksi pulih dan status menjadi Tersimpan di akun."}</p>}
    {draft.phase === "conflict" && <div className="app-notice" role="alert"><p>{draft.message || "Draft berubah di tab atau perangkat lain. Versi di halaman ini belum disimpan."}</p><p>Salin isianmu sebelum memakai versi akun; perubahan di halaman ini akan diganti.</p><div className="app-inline-actions"><button type="button" className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.values, null, 2)); setError("Isian disalin. Kamu bisa menempelkannya ke catatan sebelum memuat versi akun."); } catch { setError("Belum bisa menyalin otomatis. Salin isian penting secara manual."); } }}>Salin isian</button><button className="text-button" onClick={() => { session.useRemote(record); setPreview(false); }}>Gunakan versi akun</button></div></div>}
    {draft.phase === "error" && <div className="app-notice" role="alert">{draft.message} <button className="text-button" onClick={() => session.flush()}>Coba simpan lagi</button></div>}
    {error && <p className="app-notice" role="alert">{error}</p>}
    {record.status === "revision" && <div className="review-note"><strong>Catatan tim Media & Creative</strong><p>{record.reviewNote}</p></div>}
    {preview ? <section className="app-panel app-review"><p className="eyebrow">SATU LANGKAH LAGI</p><h2 ref={previewHeading} tabIndex={-1}>Sudah sesuai ceritamu?</h2><p>Cek ejaan nama, akun Instagram, dan link dokumentasi sebelum dikirim.</p><RecordDetails record={{ ...record, values: draft.values }} /><div className="app-review-actions"><button className="button button-quiet" disabled={busy} onClick={() => setPreview(false)}>Kembali mengedit</button><button className="button button-blue" onClick={send} disabled={busy || !online || draft.phase === "conflict"}>{busy ? "Mengirim…" : "Kirim apresiasi"}<Arrow /></button></div><p className="app-small">Setelah dikirim, isian dikunci selama tinjauan. Kamu bisa melengkapinya lagi jika tim meminta revisi.</p></section> : <div className="app-editor-grid"><form ref={form} className="app-form" noValidate onSubmit={(event) => { event.preventDefault(); void reviewForm(); }}><fieldset disabled={busy}><legend className="sr-only">Form apresiasi prestasi</legend>
      <section className="app-form-section"><div className="form-section-title"><span>01</span><div><h2>Kenalan dengan yang berprestasi.</h2><p>Nama dan akun ini akan dipakai untuk materi apresiasi.</p></div></div><p className="app-small required-note">Isian bertanda * wajib diisi sebelum kirim.</p><div className="app-field-grid">{field("fullName", "Nama lengkap", { placeholder: "Nama yang ingin dicantumkan" })}{field("memberType", "Peran di GDGoC IPB", { choices: viewer.memberType === "bod" || draft.values.memberType === "BoD" ? memberTypes : memberTypes.filter((type) => type !== "BoD") })}{field("campus", "Kampus", { placeholder: "Contoh: IPB University" })}{field("studyProgram", "Program studi", { optional: true, placeholder: "Contoh: Teknologi Rekayasa Perangkat Lunak" })}</div>{field("instagram", "Username Instagram", { placeholder: "contoh.username", hint: "Tanpa link profil. Akun ini akan digunakan untuk undangan collab post." })}</section>
      <section className="app-form-section"><div className="form-section-title"><span>02</span><div><h2>Ceritakan pencapaiannya.</h2><p>Dari nama kompetisi sampai cerita di balik hasilnya.</p></div></div>{field("achievement", "Prestasi yang diraih", { placeholder: "Contoh: Juara 1 UI/UX Design Competition" })}{field("eventName", "Nama kompetisi atau acara", { placeholder: "Nama resmi kompetisi" })}{field("organizer", "Penyelenggara", { placeholder: "Nama organisasi atau institusi" })}<div className="app-field-grid">{field("level", "Tingkat kompetisi", { choices: achievementLevels })}{field("eventDate", "Tanggal pengumuman", { type: "date", min: chapterPeriod.start, max: latestEventDate, hint: `Dalam periode GDGoC IPB ${chapterPeriod.label}.` })}{field("participation", "Partisipasi", { choices: participationTypes })}</div>{draft.values.participation === "Tim" && <div className="app-team-fields">{field("teamName", "Nama tim")}{field("teamMembers", "Anggota tim & Instagram", { rows: 4, placeholder: "Nama — @username\nNama — @username", hint: "Satu anggota per baris, termasuk dirimu. Pastikan semua anggota setuju namanya dicantumkan." })}</div>}{field("story", "Cerita di balik prestasi", { rows: 6, placeholder: "Apa yang kamu atau tim kerjakan? Tantangan apa yang dihadapi, dan hal apa yang paling berkesan?", hint: "Bantu tim mengenal prosesnya. Maksimal 2.400 karakter." })}</section>
      <section className="app-form-section"><div className="form-section-title"><span>03</span><div><h2>Buktinya lewat link saja.</h2><p>Siapkan materi yang bisa dibuka tim tanpa meminta akses.</p></div></div><div className="document-guide"><span aria-hidden="true">↗</span><div><strong>Satu folder juga boleh.</strong><p>Sertakan bukti prestasi, foto orang atau tim, dan dokumentasi kegiatan. Foto berkualitas asli membantu proses desain.</p></div></div>{field("documentationLinks", "Link dokumentasi", { rows: 5, placeholder: "https://drive.google.com/…\nhttps://situs-penyelenggara.com/…", hint: "Maksimal 5 link https://, satu link per baris. Untuk Drive, aktifkan akses lihat bagi siapa saja yang memiliki link. Hindari dokumen berisi NIK, alamat, atau data sensitif lain." })}<div className="app-consent"><input id="publicationConsent" name="publicationConsent" type="checkbox" checked={draft.values.publicationConsent} onChange={(event) => update("publicationConsent", event.target.checked)} required aria-invalid={Boolean(errors.publicationConsent)} aria-describedby={errors.publicationConsent ? "publicationConsent-error" : undefined} /><label htmlFor="publicationConsent">Saya memastikan informasi ini benar dan mendapat izin dari orang yang dicantumkan. Saya mengizinkan GDGoC IPB menggunakan nama, akun Instagram, cerita, dan dokumentasi ini untuk materi apresiasi serta undangan collab post.</label></div>{errors.publicationConsent && <p id="publicationConsent-error" className="field-error">{errors.publicationConsent}</p>}</section>
      <div className="app-submit-bar"><div><strong>Siap dirayakan bersama?</strong><p>Kamu masih bisa mengecek seluruh isian sebelum kirim.</p></div><button className="button button-blue" type="submit" disabled={!online || draft.phase === "conflict"}>{busy ? "Menyimpan…" : "Tinjau sebelum kirim"}<Arrow /></button></div></fieldset></form>
      <aside className="editor-sidebar"><div className="editor-sidebar-inner"><p className="eyebrow">DRAFT MILIKMU</p><h3>Isi pelan-pelan,<br />lanjutkan kapan saja.</h3><p>Perubahan otomatis tersimpan ke akun selama terhubung. Perhatikan status penyimpanan di atas form.</p><div className="sidebar-divider" /><p className="eyebrow">SETELAH DIKIRIM</p><p>Tim meninjau informasi dan dokumentasi sebelum menyiapkan materi. Pengiriman form belum berarti postingan langsung terbit.</p><p className="app-small">Cek status dan catatan tim dari daftar kirimanmu.</p>{record.status === "draft" && <div className="delete-draft">{confirmDelete ? <><p>Hapus draft ini beserta isiannya?</p><div className="app-inline-actions"><button className="text-button text-danger" disabled={busy || !online} onClick={deleteDraft}>Ya, hapus</button><button className="text-button" onClick={() => setConfirmDelete(false)}>Batal</button></div></> : <button className="text-button" onClick={() => setConfirmDelete(true)}>Hapus draft</button>}</div>}</div></aside>
    </div>}
  </>;
}
