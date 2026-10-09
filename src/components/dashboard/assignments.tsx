"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { assignmentAudience, assignmentLimits, assignmentMaxScore, assignmentPath, audienceGroups, audienceLabels, defaultAudience, defaultMaxScore, maxSlugLength, normalizeAssignment, rubricTotal, slugify, toJakartaInput, validateAssignment, type AssignmentErrors, type AssignmentValues, type AudienceGroup, type RubricInput } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelSpark } from "../icons";
import { AssignmentStatusBadge, AudienceBadge, CopyLinkButton, DueLabel, ScoreBadge, SubmissionBadge, useNow } from "./shared";
import { isStaff, useDashboardViewer } from "./viewer";
import { PixelIcon } from "../pixel-icons";

export function AssignmentsPage() {
  const viewer = useDashboardViewer();
  return isStaff(viewer) ? <StaffAssignments /> : <MemberAssignments />;
}

/** Assignments a member was asked to review, above their own tasks. */
function ReviewingAssignments() {
  const reviewing = useQuery(api.assignments.reviewing);
  if (!reviewing?.length) return null;
  return <section aria-labelledby="reviewing-title"><div className="app-section-heading"><div><p className="eyebrow">PENILAI</p><h2 id="reviewing-title">Tugas yang kamu nilai</h2></div></div>
    <div className="dash-card-grid">{reviewing.map((item) => <article className="app-record" key={item._id}>
      <div className="app-record-top"><AssignmentStatusBadge status={item.status} /><span className="app-small">{item.submissionCount} kiriman{item.waiting ? ` · ${item.waiting} menunggu dinilai` : ""}</span></div>
      <h3><Link href={assignmentPath(item)}>{item.title}</Link></h3>
      <div className="app-record-bottom"><Link className="text-button" href={assignmentPath(item)}>Nilai kiriman <Arrow /></Link></div>
    </article>)}</div>
  </section>;
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
    <ReviewingAssignments />
    {!assignments ? <LoadingPanel label="Memuat tugas…" /> : groups.map((group) => {
      const items = assignments.filter((item) => item.status === group.key);
      if (!items.length && !group.empty) return null;
      return <section key={group.key} aria-labelledby={`group-${group.key}`}><div className="app-section-heading"><h2 id={`group-${group.key}`}>{group.title}</h2></div>
        {items.length ? <div className="dash-card-grid">{items.map((item) => <article className="app-record" key={item._id}>
          <div className="app-record-top"><SubmissionBadge submittedAt={item.submittedAt} late={item.late} /><ScoreBadge score={item.score} maxScore={item.maxScore} reviewedAt={item.reviewedAt} stale={item.stale} revisionRequestedAt={item.revisionRequestedAt} />{item.status === "closed" && <AssignmentStatusBadge status="closed" />}</div>
          <h3><Link href={assignmentPath(item)}>{item.title}</Link></h3><p className="dash-summary">{item.summary}</p>
          <div className="app-record-bottom"><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /><Link className="text-button" href={assignmentPath(item)}>{item.revisionRequestedAt !== null ? "Revisi kiriman" : item.status === "published" ? (item.submittedAt ? "Lihat & perbarui" : "Kerjakan") : "Lihat kiriman"}<Arrow /></Link></div>
        </article>)}</div> : <div className="app-empty"><PixelSpark /><h3>Belum ada tugas.</h3><p>{group.empty}</p></div>}
      </section>;
    })}
  </>;
}

function StaffAssignments() {
  const list = usePaginatedQuery(api.assignments.adminList, {}, { initialNumItems: 12 });
  const now = useNow();
  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · TUGAS</p><h1>Kelola tugas.</h1><p>Draft hanya terlihat oleh admin. Tugas yang dibuka bisa dikerjakan member aktif dari kelompok sasarannya.</p></div><Link className="button button-blue" href="/dashboard/tugas/baru">Buat tugas <span aria-hidden="true">＋</span></Link></div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat tugas…" /> : !list.results.length ? <div className="app-empty"><PixelSpark /><h2>Belum ada tugas.</h2><p>Mulai dari judul, instruksi, dan tenggat. Kamu bisa menyimpannya sebagai draft sebelum dibuka.</p><Link className="text-button" href="/dashboard/tugas/baru">Buat tugas pertama <Arrow /></Link></div>
      : <div className="dash-card-grid">{list.results.map((item) => <article className="app-record" key={item._id}>
        <div className="app-record-top"><AssignmentStatusBadge status={item.status} /><AudienceBadge audience={assignmentAudience(item)} /><span className="app-small">{item.submissionCount} kiriman{item.lateCount ? ` · ${item.lateCount} terlambat` : ""}{item.submissionCount ? ` · ${item.reviewedCount} dinilai` : ""}</span></div>
        <h3><Link href={assignmentPath(item)}>{item.title}</Link></h3><p className="dash-summary">{item.description.slice(0, 220)}</p>
        <div className="app-record-bottom"><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /><span className="dash-card-actions"><CopyLinkButton path={assignmentPath(item)} /><Link className="text-button" href={assignmentPath(item)}>Kelola<Arrow /></Link></span></div>
      </article>)}</div>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(12)}>Muat tugas lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat tugas…</p>}
  </>;
}

type SaveAssignment = (values: AssignmentValues, publish: boolean) => Promise<void>;

export function AssignmentForm({ initial, onSave, onCancel, creating, assignmentId }: { initial: AssignmentValues; onSave: SaveAssignment; onCancel: () => void; creating: boolean; assignmentId?: Id<"assignments"> }) {
  const [values, setValues] = useState(initial);
  // The slug follows the title until someone edits it by hand.
  const [slugEdited, setSlugEdited] = useState(!creating);
  const requestedSlug = slugify(values.slug) || slugify(values.title) || "tugas";
  const previewSlug = useQuery(api.assignments.slugPreview, { slug: requestedSlug, id: assignmentId });
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleField = useRef<HTMLInputElement>(null);
  const descriptionField = useRef<HTMLTextAreaElement>(null);
  const dueField = useRef<HTMLInputElement>(null);
  const maxScoreField = useRef<HTMLInputElement>(null);
  const audienceField = useRef<HTMLInputElement>(null);
  function update(field: Exclude<keyof AssignmentValues, "rubric" | "audience">, value: string) {
    setValues((current) => ({ ...current, [field]: value, ...(field === "title" && !slugEdited ? { slug: slugify(value) } : {}) }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  const rubric = values.rubric ?? [];
  const rubricSum = rubric.length ? rubricTotal(rubric) : null;
  function setRubric(next: RubricInput[]) {
    setValues((current) => ({ ...current, rubric: next }));
    setErrors((current) => ({ ...current, rubric: undefined, maxScore: undefined }));
  }
  const audience = values.audience ?? defaultAudience;
  function toggleAudience(group: AudienceGroup, on: boolean) {
    setValues((current) => {
      const now = current.audience ?? defaultAudience;
      return { ...current, audience: audienceGroups.filter((item) => item === group ? on : now.includes(item)) };
    });
    setErrors((current) => ({ ...current, audience: undefined }));
  }
  async function save(publish: boolean) {
    const found = validateAssignment(values);
    setErrors(found); setError("");
    const first = (["title", "description", "dueAt", "maxScore", "audience"] as const).find((field) => found[field]);
    if (first) { ({ title: titleField, description: descriptionField, dueAt: dueField, maxScore: maxScoreField, audience: audienceField })[first].current?.focus(); return; }
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
      <div className="app-field dash-slug-field"><label htmlFor="slug">Slug link</label>
        <div className="dash-slug-input"><span aria-hidden="true">/dashboard/tugas/</span><input id="slug" value={values.slug} maxLength={maxSlugLength + 20} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(event) => { setSlugEdited(true); update("slug", event.target.value); }} onBlur={() => setValues((current) => ({ ...current, slug: slugify(current.slug) }))} aria-describedby="slug-hint" placeholder={slugify(values.title) || "judul-tugas"} /></div>
        <p className="field-hint" id="slug-hint" aria-live="polite">{previewSlug && previewSlug !== requestedSlug ? <>Slug ini sudah dipakai tugas lain, jadi akan disimpan sebagai <b>{previewSlug}</b>. </> : null}Terisi otomatis dari judul, huruf kecil dan tanda hubung. Link lama tetap diarahkan jika slug diubah.{slugEdited && <> <button type="button" className="text-button dash-inline-button" onClick={() => { setSlugEdited(false); setValues((current) => ({ ...current, slug: slugify(current.title) })); }}>Samakan dengan judul</button></>}</p>
      </div>
      <div className="app-field"><label htmlFor="description">Instruksi <span className="field-required" aria-hidden="true">*</span></label><textarea data-lenis-prevent id="description" ref={descriptionField} required rows={10} maxLength={assignmentLimits.description} value={values.description} onChange={(event) => update("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={described("description", "description-hint")} placeholder="Tujuan, langkah pengerjaan, dan apa yang perlu dikumpulkan." /><p className="field-hint" id="description-hint">Ditampilkan apa adanya, termasuk baris baru. {values.description.length}/{assignmentLimits.description} karakter.</p>{errors.description && <p className="field-error" id="description-error">{errors.description}</p>}</div>
      <fieldset className="dash-audience-editor" aria-describedby={described("audience", "audience-hint")}>
        <legend>Untuk siapa <span className="field-required" aria-hidden="true">*</span></legend>
        <p className="field-hint" id="audience-hint">Hanya member dengan tag komunitas yang dicentang yang bisa melihat dan mengumpulkan tugas ini. Centang ketiganya untuk semua member. Admin dan pemilik selalu bisa melihat semua tugas.</p>
        <div className="dash-audience-options">{audienceGroups.map((group, index) => <label className="dash-audience-option" key={group}><input ref={index === 0 ? audienceField : undefined} type="checkbox" checked={audience.includes(group)} onChange={(event) => toggleAudience(group, event.target.checked)} aria-invalid={Boolean(errors.audience)} />{audienceLabels[group]}</label>)}</div>
        {errors.audience && <p className="field-error" id="audience-error">{errors.audience}</p>}
      </fieldset>
      <div className="app-field dash-due-field"><label htmlFor="dueAt">Tenggat (WIB) <span className="field-required" aria-hidden="true">*</span></label><input id="dueAt" ref={dueField} type="datetime-local" required value={values.dueAt} onChange={(event) => update("dueAt", event.target.value)} aria-invalid={Boolean(errors.dueAt)} aria-describedby={described("dueAt", "due-hint")} /><p className="field-hint" id="due-hint">Kiriman setelah tenggat tetap diterima dan ditandai terlambat, sampai pengumpulan ditutup.</p>{errors.dueAt && <p className="field-error" id="dueAt-error">{errors.dueAt}</p>}</div>
      <div className="app-field dash-score-field"><label htmlFor="maxScore">Nilai maksimal</label><input id="maxScore" ref={maxScoreField} type="number" inputMode="numeric" min={1} max={assignmentLimits.maxScore} step={1} value={rubric.length ? (rubricSum === null ? "" : String(rubricSum)) : values.maxScore} readOnly={rubric.length > 0} onChange={(event) => update("maxScore", event.target.value)} aria-invalid={Boolean(errors.maxScore)} aria-describedby={described("maxScore", "max-score-hint")} /><p className="field-hint" id="max-score-hint">{rubric.length ? "Mengikuti jumlah poin rubrik di bawah." : `Nilai kiriman diberikan dari 0 sampai angka ini. Biarkan ${defaultMaxScore} jika tidak yakin.`}</p>{errors.maxScore && <p className="field-error" id="maxScore-error">{errors.maxScore}</p>}</div>
      <fieldset className="dash-rubric-editor" aria-describedby={described("rubric", "rubric-hint")}>
        <legend>Rubrik <span className="app-small">(opsional)</span></legend>
        <p className="field-hint" id="rubric-hint">Pecah penilaian menjadi kriteria dengan poin maksimal masing-masing. Peninjau mengisi poin per kriteria dan totalnya menjadi nilai. Member melihat kriterianya di halaman tugas.</p>
        {rubric.length > 0 && <ol className="dash-rubric-rows">{rubric.map((criterion, index) => <li key={index} className="dash-rubric-row">
          <div className="app-field"><label htmlFor={`rubric-${index}-name`}>Kriteria {index + 1}</label><input id={`rubric-${index}-name`} maxLength={assignmentLimits.rubricName} value={criterion.name} onChange={(event) => setRubric(rubric.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder={index === 0 ? "Contoh: Kejelasan masalah" : ""} /></div>
          <div className="app-field"><label htmlFor={`rubric-${index}-max`}>Poin maks</label><input id={`rubric-${index}-max`} type="number" inputMode="numeric" min={1} max={assignmentLimits.maxScore} step={1} value={criterion.max} onChange={(event) => setRubric(rubric.map((item, i) => i === index ? { ...item, max: event.target.value } : item))} /></div>
          <button type="button" className="text-button text-danger dash-rubric-remove" onClick={() => setRubric(rubric.filter((_, i) => i !== index))} aria-label={`Hapus kriteria ${index + 1}`}><PixelIcon name="close" size={16} />Hapus</button>
        </li>)}</ol>}
        <div className="app-inline-actions"><button type="button" className="text-button" disabled={rubric.length >= assignmentLimits.rubricCriteria} onClick={() => setRubric([...rubric, { name: "", max: "" }])}>＋ Tambah kriteria</button>{rubric.length > 0 && <span className="app-small">{rubric.length} kriteria{rubricSum !== null ? ` · total ${rubricSum} poin` : ""}</span>}</div>
        {errors.rubric && <p className="field-error" id="rubric-error">{errors.rubric}</p>}
      </fieldset>
    </div>
    {error && <p className="app-notice" role="alert">{error}</p>}
    <div className="dash-form-actions"><button type="button" className="text-button" onClick={onCancel}>Batal</button>
      {creating ? <><button className="button button-quiet" type="submit" value="draft">{busy ? "Menyimpan…" : "Simpan sebagai draft"}</button><button className="button button-blue" type="submit" value="publish">{busy ? "Menyimpan…" : "Buka untuk sasaran"}</button></>
        : <button className="button button-blue" type="submit" value="save">{busy ? "Menyimpan…" : "Simpan perubahan"}</button>}
    </div>
  </fieldset></form>;
}

export function NewAssignmentPage() {
  const viewer = useDashboardViewer();
  const router = useRouter();
  const create = useMutation(api.assignments.create);
  const [initial] = useState<AssignmentValues>(() => ({ title: "", slug: "", description: "", dueAt: toJakartaInput(defaultDue()), maxScore: String(defaultMaxScore), rubric: [], audience: defaultAudience }));
  if (!isStaff(viewer)) return <StaffOnly />;
  return <>
    <Link className="text-button app-back" href="/dashboard/tugas"><PixelIcon name="arrow-left" size={24} />Kelola tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · TUGAS BARU</p><h1>Buat tugas.</h1><p>Tulis instruksi yang bisa dikerjakan tanpa perlu bertanya lagi, lalu tentukan tenggatnya.</p></div>
    <AssignmentForm creating initial={initial} onCancel={() => router.push("/dashboard/tugas")} onSave={async (values, publish) => {
      // The detail page swaps the ID for the saved slug.
      const id = await create({ values, publish });
      router.push(`/dashboard/tugas/${id}`);
    }} />
  </>;
}

export function EditAssignmentPage({ id }: { id: string }) {
  const viewer = useDashboardViewer();
  const router = useRouter();
  const data = useQuery(api.assignments.get, isStaff(viewer) ? { id } : "skip");
  const slug = data?.assignment.slug;
  useEffect(() => { if (slug && slug !== id) router.replace(`/dashboard/tugas/${slug}/ubah`); }, [slug, id, router]);
  if (!isStaff(viewer)) return <StaffOnly />;
  if (data === undefined) return <LoadingPanel label="Memuat tugas…" />;
  if (!data) return <MissingAssignment />;
  return <EditAssignment assignment={data.assignment} />;
}

function EditAssignment({ assignment }: { assignment: Doc<"assignments"> }) {
  const router = useRouter();
  const update = useMutation(api.assignments.update);
  const [initial] = useState<AssignmentValues>(() => ({
    title: assignment.title, slug: assignment.slug ?? slugify(assignment.title), description: assignment.description, dueAt: toJakartaInput(assignment.dueAt),
    maxScore: String(assignmentMaxScore(assignment)), rubric: (assignment.rubric ?? []).map((criterion) => ({ name: criterion.name, max: String(criterion.max) })),
    audience: assignmentAudience(assignment),
  }));
  const back = assignmentPath(assignment);
  return <>
    <Link className="text-button app-back" href={back}><PixelIcon name="arrow-left" size={24} />Kembali ke tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · UBAH TUGAS</p><h1>Ubah tugas.</h1><p>Perubahan langsung terlihat oleh member. Mengubah tenggat juga memperbarui tanda terlambat pada kiriman. Member yang dikeluarkan dari sasaran tidak lagi melihat tugas ini, tetapi kirimannya tetap tersimpan.</p></div>
    <AssignmentForm creating={false} assignmentId={assignment._id} initial={initial} onCancel={() => router.push(back)} onSave={async (values) => {
      const slug = await update({ id: assignment._id, revision: assignment.revision, values });
      router.push(`/dashboard/tugas/${slug ?? values.slug}`);
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
