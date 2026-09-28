"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { assignmentLimits, normalizeAssignment, toJakartaInput, validateAssignment, type AssignmentErrors, type AssignmentValues } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelSpark } from "../icons";
import { AssignmentStatusBadge, DueLabel, SubmissionBadge, useNow } from "./shared";
import { isStaff, useDashboardViewer } from "./shell";

export function AssignmentsPage() {
  const viewer = useDashboardViewer();
  return isStaff(viewer) ? <StaffAssignments /> : <MemberAssignments />;
}

function MemberAssignments() {
  const assignments = useQuery(api.assignments.list);
  const now = useNow();
  const groups = [
    { key: "published", title: "Sedang dibuka", empty: "Belum ada tugas yang dibuka. Tugas baru akan muncul di sini." },
    { key: "closed", title: "Sudah ditutup", empty: "" },
  ] as const;
  return <>
    <div className="dash-intro"><p className="eyebrow">TUGAS MEMBER</p><h1>Tugas.</h1><p>Buka tugas untuk membaca instruksi, menulis jawaban, dan melampirkan file hasil kerjamu.</p></div>
    {!assignments ? <LoadingPanel label="Memuat tugas…" /> : groups.map((group) => {
      const items = assignments.filter((item) => item.status === group.key);
      if (!items.length && !group.empty) return null;
      return <section key={group.key} aria-labelledby={`group-${group.key}`}><div className="app-section-heading"><h2 id={`group-${group.key}`}>{group.title}</h2></div>
        {items.length ? <div className="dash-card-grid">{items.map((item) => <article className="app-record" key={item._id}>
          <div className="app-record-top"><SubmissionBadge submittedAt={item.submittedAt} late={item.late} />{item.status === "closed" && <AssignmentStatusBadge status="closed" />}</div>
          <h3><Link href={`/dashboard/tugas/${item._id}`}>{item.title}</Link></h3><p className="dash-summary">{item.summary}</p>
          <div className="app-record-bottom"><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /><Link className="text-button" href={`/dashboard/tugas/${item._id}`}>{item.status === "published" ? (item.submittedAt ? "Lihat & perbarui" : "Kerjakan") : "Lihat kiriman"}<Arrow /></Link></div>
        </article>)}</div> : <div className="app-empty"><PixelSpark /><h3>Belum ada tugas.</h3><p>{group.empty}</p></div>}
      </section>;
    })}
  </>;
}

function StaffAssignments() {
  const list = usePaginatedQuery(api.assignments.adminList, {}, { initialNumItems: 12 });
  const now = useNow();
  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · TUGAS</p><h1>Kelola tugas.</h1><p>Draft hanya terlihat oleh admin. Tugas yang dibuka bisa dikerjakan semua member aktif.</p></div><Link className="button button-blue" href="/dashboard/tugas/baru">Buat tugas <span aria-hidden="true">＋</span></Link></div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat tugas…" /> : !list.results.length ? <div className="app-empty"><PixelSpark /><h2>Belum ada tugas.</h2><p>Mulai dari judul, instruksi, dan tenggat. Kamu bisa menyimpannya sebagai draft sebelum dibuka.</p><Link className="text-button" href="/dashboard/tugas/baru">Buat tugas pertama <Arrow /></Link></div>
      : <div className="dash-card-grid">{list.results.map((item) => <article className="app-record" key={item._id}>
        <div className="app-record-top"><AssignmentStatusBadge status={item.status} /><span className="app-small">{item.submissionCount} kiriman{item.lateCount ? ` · ${item.lateCount} terlambat` : ""}</span></div>
        <h3><Link href={`/dashboard/tugas/${item._id}`}>{item.title}</Link></h3><p className="dash-summary">{item.description.slice(0, 220)}</p>
        <div className="app-record-bottom"><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /><Link className="text-button" href={`/dashboard/tugas/${item._id}`}>Kelola<Arrow /></Link></div>
      </article>)}</div>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(12)}>Muat tugas lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat tugas…</p>}
  </>;
}

type SaveAssignment = (values: AssignmentValues, publish: boolean) => Promise<void>;

export function AssignmentForm({ initial, onSave, onCancel, creating }: { initial: AssignmentValues; onSave: SaveAssignment; onCancel: () => void; creating: boolean }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleField = useRef<HTMLInputElement>(null);
  const descriptionField = useRef<HTMLTextAreaElement>(null);
  const dueField = useRef<HTMLInputElement>(null);
  function update(field: keyof AssignmentValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  async function save(publish: boolean) {
    const found = validateAssignment(values);
    setErrors(found); setError("");
    const first = (["title", "description", "dueAt"] as const).find((field) => found[field]);
    if (first) { ({ title: titleField, description: descriptionField, dueAt: dueField })[first].current?.focus(); return; }
    setBusy(true);
    try { await onSave(normalizeAssignment(values), publish); }
    catch (cause) { setError(readableError(cause)); setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void save(submitter?.value === "publish");
  }
  const described = (field: keyof AssignmentValues, hint?: string) => [hint, errors[field] && `${field}-error`].filter(Boolean).join(" ") || undefined;
  return <form className="app-form dash-form" onSubmit={submit} noValidate><fieldset disabled={busy}><legend className="sr-only">Detail tugas</legend>
    <div className="app-form-section">
      <div className="app-field"><label htmlFor="title">Judul tugas <span className="field-required" aria-hidden="true">*</span></label><input id="title" ref={titleField} required maxLength={assignmentLimits.title} value={values.title} onChange={(event) => update("title", event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={described("title")} placeholder="Contoh: Landing page dengan Tailwind" />{errors.title && <p className="field-error" id="title-error">{errors.title}</p>}</div>
      <div className="app-field"><label htmlFor="description">Instruksi <span className="field-required" aria-hidden="true">*</span></label><textarea data-lenis-prevent id="description" ref={descriptionField} required rows={10} maxLength={assignmentLimits.description} value={values.description} onChange={(event) => update("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={described("description", "description-hint")} placeholder="Tujuan, langkah pengerjaan, dan apa yang perlu dikumpulkan." /><p className="field-hint" id="description-hint">Ditampilkan apa adanya, termasuk baris baru. {values.description.length}/{assignmentLimits.description} karakter.</p>{errors.description && <p className="field-error" id="description-error">{errors.description}</p>}</div>
      <div className="app-field dash-due-field"><label htmlFor="dueAt">Tenggat (WIB) <span className="field-required" aria-hidden="true">*</span></label><input id="dueAt" ref={dueField} type="datetime-local" required value={values.dueAt} onChange={(event) => update("dueAt", event.target.value)} aria-invalid={Boolean(errors.dueAt)} aria-describedby={described("dueAt", "due-hint")} /><p className="field-hint" id="due-hint">Kiriman setelah tenggat tetap diterima dan ditandai terlambat, sampai pengumpulan ditutup.</p>{errors.dueAt && <p className="field-error" id="dueAt-error">{errors.dueAt}</p>}</div>
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
    <div className="dash-form-actions"><button type="button" className="text-button" onClick={onCancel}>Batal</button>
      {creating ? <><button className="button button-quiet" type="submit" value="draft">{busy ? "Menyimpan…" : "Simpan sebagai draft"}</button><button className="button button-blue" type="submit" value="publish">{busy ? "Menyimpan…" : "Buka untuk member"}</button></>
        : <button className="button button-blue" type="submit" value="save">{busy ? "Menyimpan…" : "Simpan perubahan"}</button>}
    </div>
  </fieldset></form>;
}

export function NewAssignmentPage() {
  const viewer = useDashboardViewer();
  const router = useRouter();
  const create = useMutation(api.assignments.create);
  const [initial] = useState(() => ({ title: "", description: "", dueAt: toJakartaInput(defaultDue()) }));
  if (!isStaff(viewer)) return <StaffOnly />;
  return <>
    <Link className="text-button app-back" href="/dashboard/tugas">← Kelola tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · TUGAS BARU</p><h1>Buat tugas.</h1><p>Tulis instruksi yang bisa dikerjakan tanpa perlu bertanya lagi, lalu tentukan tenggatnya.</p></div>
    <AssignmentForm creating initial={initial} onCancel={() => router.push("/dashboard/tugas")} onSave={async (values, publish) => {
      const id = await create({ values, publish });
      router.push(`/dashboard/tugas/${id}`);
    }} />
  </>;
}

export function EditAssignmentPage({ id }: { id: string }) {
  const viewer = useDashboardViewer();
  const data = useQuery(api.assignments.get, isStaff(viewer) ? { id } : "skip");
  if (!isStaff(viewer)) return <StaffOnly />;
  if (data === undefined) return <LoadingPanel label="Memuat tugas…" />;
  if (!data) return <MissingAssignment />;
  return <EditAssignment assignment={data.assignment} />;
}

function EditAssignment({ assignment }: { assignment: Doc<"assignments"> }) {
  const router = useRouter();
  const update = useMutation(api.assignments.update);
  const [initial] = useState(() => ({ title: assignment.title, description: assignment.description, dueAt: toJakartaInput(assignment.dueAt) }));
  const back = `/dashboard/tugas/${assignment._id}`;
  return <>
    <Link className="text-button app-back" href={back}>← Kembali ke tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · UBAH TUGAS</p><h1>Ubah tugas.</h1><p>Perubahan langsung terlihat oleh member. Mengubah tenggat juga memperbarui tanda terlambat pada kiriman.</p></div>
    <AssignmentForm creating={false} initial={initial} onCancel={() => router.push(back)} onSave={async (values) => {
      await update({ id: assignment._id, revision: assignment.revision, values });
      router.push(back);
    }} />
  </>;
}

// One week from now at 23:59 WIB.
function defaultDue() {
  const week = toJakartaInput(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return Date.parse(`${week.slice(0, 10)}T23:59:00+07:00`);
}

export function StaffOnly() {
  return <div className="app-panel"><h2>Khusus admin.</h2><p>Halaman ini hanya bisa dibuka oleh admin GDGoC IPB.</p><Link className="button button-blue" href="/dashboard/tugas">Ke daftar tugas</Link></div>;
}

export function MissingAssignment() {
  return <div className="app-panel"><h2>Tugas tidak ditemukan.</h2><p>Tugas ini mungkin sudah dihapus atau belum dibuka untuk member.</p><Link className="button button-blue" href="/dashboard/tugas">Ke daftar tugas</Link></div>;
}
