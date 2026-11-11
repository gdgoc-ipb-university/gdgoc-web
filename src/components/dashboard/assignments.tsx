"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { assignmentAudience, assignmentLimits, assignmentMaxScore, assignmentPath, audienceGroups, audienceLabels, defaultAudience, defaultMaxScore, maxSlugLength, normalizeAssignment, rubricTotal, slugify, toJakartaInput, validateAssignment, type AssignmentErrors, type AssignmentValues, type AudienceGroup, type RubricInput } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { defaultFlagInput, normalizeFlag, validateFlag, type FlagErrors, type FlagInput } from "@/lib/flag-task";
import type { CohortRole } from "@/lib/cohort";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelSpark } from "../icons";
import { AssignmentStatusBadge, AudienceBadge, CopyLinkButton, DueLabel, ScoreBadge, SubmissionBadge, useNow } from "./shared";
import { isStaff, useDashboardViewer } from "./viewer";
import { FlagBadge, FlagFields, KindSwitch, flagFields } from "./flag-task";
import { PixelIcon } from "../pixel-icons";
import { Select } from "../select";

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
      <div className="app-record-top"><AssignmentStatusBadge status={item.status} />{item.cohort && <AudienceBadge audience={[]} cohort={item.cohort} cohortRoles={item.cohortRoles} />}<span className="app-small">{item.submissionCount} kiriman{item.waiting ? ` · ${item.waiting} menunggu dinilai` : ""}</span></div>
      <h3><Link href={assignmentPath(item)}>{item.title}</Link></h3>
      <div className="app-record-bottom"><Link className="text-button" href={assignmentPath(item)}>Nilai kiriman <Arrow /></Link></div>
    </article>)}</div>
  </section>;
}

/** A participant's team in each cohort: its name and their active teammates' names and roles (#107). Nothing outside a team. */
function MyTeams() {
  const teams = useQuery(api.cohorts.myTeams);
  if (!teams?.length) return null;
  return <section aria-labelledby="my-team-title"><div className="app-section-heading"><div><p className="eyebrow">TIM</p><h2 id="my-team-title">Tim kamu</h2></div></div>
    {teams.map((team) => <div className="app-panel dash-my-team" key={team._id}>
      <div className="dash-team-head"><h3>{team.name}</h3><span className="app-small">{team.cohort}</span></div>
      {team.teammates.length ? <ul className="dash-mentee-list">{team.teammates.map((mate, index) => <li key={index}>{mate.name} <span className="app-small">· {mate.role}</span></li>)}</ul>
        : <p className="app-small">Belum ada rekan setim lain.</p>}
    </div>)}
  </section>;
}

/** A mentor's roles with their active participants, by name only (#32, decision 5). Nothing for anyone else. */
function MentoredParticipants() {
  const mentoring = useQuery(api.cohorts.mentoring);
  if (!mentoring?.length) return null;
  return <section aria-labelledby="mentoring-title"><div className="app-section-heading"><div><p className="eyebrow">MENTOR</p><h2 id="mentoring-title">Peserta yang kamu dampingi</h2></div></div>
    {mentoring.flatMap((cohort) => cohort.roles.map((role) => <details className="app-panel dash-mentees" key={`${cohort._id}-${role.key}`} open={mentoring.length === 1 && cohort.roles.length === 1}>
      <summary><strong>{role.name}</strong><span>{cohort.name}</span><span className="app-small">{role.participants.length} peserta aktif</span></summary>
      {role.participants.length ? <ul className="dash-mentee-list">{role.participants.map((name, index) => <li key={index}>{name}</li>)}</ul> : <p className="app-small">Belum ada peserta aktif di peran ini.</p>}
    </details>))}
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
    <MyTeams />
    <ReviewingAssignments />
    <MentoredParticipants />
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
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · TUGAS</p><h1>Kelola tugas.</h1><p>Draft hanya terlihat oleh admin. Tugas yang dibuka bisa dikerjakan member aktif dari kelompok sasarannya.</p></div><Link className="button button-blue" href="/dashboard/tugas/baru">Buat tugas <PixelIcon name="plus" size={18} /></Link></div>
    {list.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat tugas…" /> : !list.results.length ? <div className="app-empty"><PixelSpark /><h2>Belum ada tugas.</h2><p>Mulai dari judul, instruksi, dan tenggat. Kamu bisa menyimpannya sebagai draft sebelum dibuka.</p><Link className="text-button" href="/dashboard/tugas/baru">Buat tugas pertama <Arrow /></Link></div>
      : <div className="dash-card-grid">{list.results.map((item) => <article className="app-record" key={item._id}>
        <div className="app-record-top"><AssignmentStatusBadge status={item.status} /><AudienceBadge audience={assignmentAudience(item)} cohort={item.cohort} cohortRoles={item.cohortRoles} />{item.kind === "flag" && <FlagBadge />}<span className="app-small">{item.kind === "flag" ? `${item.solveCount} solve` : <>{item.submissionCount} kiriman{item.lateCount ? ` · ${item.lateCount} terlambat` : ""}{item.submissionCount ? ` · ${item.reviewedCount} dinilai` : ""}</>}</span></div>
        <h3><Link href={assignmentPath(item)}>{item.title}</Link></h3><p className="dash-summary">{item.description.slice(0, 220)}</p>
        <div className="app-record-bottom"><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /><span className="dash-card-actions"><CopyLinkButton path={assignmentPath(item)} /><Link className="text-button" href={assignmentPath(item)}>Kelola<Arrow /></Link></span></div>
      </article>)}</div>}
    {list.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => list.loadMore(12)}>Muat tugas lainnya</button>}
    {list.status === "LoadingMore" && <p role="status">Memuat tugas…</p>}
  </>;
}

type SaveAssignment = (values: AssignmentValues, publish: boolean) => Promise<void>;

/** The form's values as the mutations take them: the cohort is an ID once chosen. */
function assignmentInput(values: AssignmentValues) {
  return { ...values, cohortId: values.cohortId as Id<"cohorts"> | null | undefined };
}

export function AssignmentForm({ initial, onSave, onCancel, creating, assignmentId }: { initial: AssignmentValues; onSave: SaveAssignment; onCancel: () => void; creating: boolean; assignmentId?: Id<"assignments"> }) {
  const [values, setValues] = useState(initial);
  // The slug follows the title until someone edits it by hand.
  const [slugEdited, setSlugEdited] = useState(!creating);
  const requestedSlug = slugify(values.slug) || slugify(values.title) || "tugas";
  const previewSlug = useQuery(api.assignments.slugPreview, { slug: requestedSlug, id: assignmentId });
  const [errors, setErrors] = useState<AssignmentErrors>({});
  // A flag task (#240) is chosen on a new task and kept on edit; the typed flag survives switching back and forth.
  const [isFlag, setIsFlag] = useState(Boolean(initial.flag));
  const [flag, setFlag] = useState<FlagInput>(initial.flag ?? defaultFlagInput);
  const [flagErrors, setFlagErrors] = useState<FlagErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleField = useRef<HTMLInputElement>(null);
  const descriptionField = useRef<HTMLTextAreaElement>(null);
  const dueField = useRef<HTMLInputElement>(null);
  const maxScoreField = useRef<HTMLInputElement>(null);
  const audienceField = useRef<HTMLInputElement>(null);
  const rolesField = useRef<HTMLInputElement>(null);
  const cohorts = useQuery(api.cohorts.list);
  function update(field: Exclude<keyof AssignmentValues, "rubric" | "audience" | "cohortId" | "cohortRoles">, value: string) {
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
  // A program task picks a cohort, then its roles: one, several, or all (every role starts ticked).
  const cohort = cohorts?.find((item) => item._id === values.cohortId);
  function target(cohortId: string | null) {
    const roles = cohorts?.find((item) => item._id === cohortId)?.roles ?? [];
    setValues((current) => ({ ...current, cohortId, cohortRoles: roles.map((role) => role.key) }));
    setErrors((current) => ({ ...current, audience: undefined, cohortRoles: undefined }));
  }
  function toggleRole(roles: CohortRole[], key: string, on: boolean) {
    setValues((current) => ({ ...current, cohortRoles: roles.map((role) => role.key).filter((item) => item === key ? on : (current.cohortRoles ?? []).includes(item)) }));
    setErrors((current) => ({ ...current, cohortRoles: undefined }));
  }
  function updateFlag(field: keyof FlagInput, value: string) {
    setFlag((current) => ({ ...current, [field]: value }));
    setFlagErrors((current) => ({ ...current, [field]: undefined }));
  }
  async function save(publish: boolean) {
    const found = validateAssignment(values);
    const foundFlag = isFlag ? validateFlag(flag) : {};
    setErrors(found); setFlagErrors(foundFlag); setError("");
    const first = (["title", "description", "audience", "cohortRoles", "dueAt", "maxScore"] as const).find((field) => found[field]);
    if (first) { ({ title: titleField, description: descriptionField, dueAt: dueField, maxScore: maxScoreField, audience: audienceField, cohortRoles: rolesField })[first].current?.focus(); return; }
    const firstFlag = flagFields.find((field) => foundFlag[field]);
    if (firstFlag) { document.getElementById(firstFlag)?.focus(); return; }
    setBusy(true);
    try { await onSave({ ...normalizeAssignment(values), flag: isFlag ? normalizeFlag(flag) : undefined }, publish); }
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
      {creating && <KindSwitch flag={isFlag} onChange={setIsFlag} />}
      <div className="app-field"><label htmlFor="title">Judul tugas <span className="field-required" aria-hidden="true">*</span></label><input id="title" ref={titleField} required maxLength={assignmentLimits.title} value={values.title} onChange={(event) => update("title", event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={described("title")} placeholder="Contoh: Landing page dengan Tailwind" />{errors.title && <p className="field-error" id="title-error">{errors.title}</p>}</div>
      <div className="app-field dash-slug-field"><label htmlFor="slug">Slug link</label>
        <div className="dash-slug-input"><span aria-hidden="true">/dashboard/tugas/</span><input id="slug" value={values.slug} maxLength={maxSlugLength + 20} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(event) => { setSlugEdited(true); update("slug", event.target.value); }} onBlur={() => setValues((current) => ({ ...current, slug: slugify(current.slug) }))} aria-describedby="slug-hint" placeholder={slugify(values.title) || "judul-tugas"} /></div>
        <p className="field-hint" id="slug-hint" aria-live="polite">{previewSlug && previewSlug !== requestedSlug ? <>Slug ini sudah dipakai tugas lain, jadi akan disimpan sebagai <b>{previewSlug}</b>. </> : null}Terisi otomatis dari judul, huruf kecil dan tanda hubung. Link lama tetap diarahkan jika slug diubah.{slugEdited && <> <button type="button" className="text-button dash-inline-button" onClick={() => { setSlugEdited(false); setValues((current) => ({ ...current, slug: slugify(current.title) })); }}>Samakan dengan judul</button></>}</p>
      </div>
      <div className="app-field"><label htmlFor="description">Instruksi <span className="field-required" aria-hidden="true">*</span></label><textarea data-lenis-prevent id="description" ref={descriptionField} required rows={10} maxLength={assignmentLimits.description} value={values.description} onChange={(event) => update("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={described("description", "description-hint")} placeholder="Tujuan, langkah pengerjaan, dan apa yang perlu dikumpulkan." /><p className="field-hint" id="description-hint">Ditampilkan apa adanya, termasuk baris baru. {values.description.length}/{assignmentLimits.description} karakter.</p>{errors.description && <p className="field-error" id="description-error">{errors.description}</p>}</div>
      <fieldset className="dash-audience-editor" aria-describedby={described(values.cohortId ? "cohortRoles" : "audience", "audience-hint")}>
        <legend>Untuk siapa <span className="field-required" aria-hidden="true">*</span></legend>
        {cohorts && cohorts.length > 0 && <div className="dash-target-options" role="radiogroup" aria-label="Jenis sasaran">
          <label className="dash-audience-option"><input type="radio" name="target" checked={!values.cohortId} onChange={() => target(null)} />Tag komunitas</label>
          <label className="dash-audience-option"><input type="radio" name="target" checked={Boolean(values.cohortId)} onChange={() => target(values.cohortId || cohorts[0]._id)} />Peserta program</label>
        </div>}
        {!values.cohortId ? <>
          <p className="field-hint" id="audience-hint">Hanya member dengan tag komunitas yang dicentang yang bisa melihat dan mengumpulkan tugas ini. Centang ketiganya untuk semua member. Admin dan pemilik selalu bisa melihat semua tugas.</p>
          <div className="dash-audience-options">{audienceGroups.map((group, index) => <label className="dash-audience-option" key={group}><input ref={index === 0 ? audienceField : undefined} type="checkbox" checked={audience.includes(group)} onChange={(event) => toggleAudience(group, event.target.checked)} aria-invalid={Boolean(errors.audience)} />{audienceLabels[group]}</label>)}</div>
          {errors.audience && <p className="field-error" id="audience-error">{errors.audience}</p>}
        </> : <>
          <p className="field-hint" id="audience-hint">Hanya peserta aktif dengan peran yang dicentang, mentor peran itu, dan admin yang bisa melihat tugas ini. Centang semua peran untuk seluruh peserta. Tag komunitas tidak dipakai.</p>
          {cohorts && cohorts.length > 1 && <Select id="cohort" label="Program" value={values.cohortId} onChange={(id) => target(id)} options={cohorts.map((item) => ({ value: item._id as string, label: item.name }))} />}
          {cohort ? <div className="dash-audience-options" role="group" aria-label={`Peran di ${cohort.name}`}>{cohort.roles.map((role, index) => <label className="dash-audience-option" key={role.key}><input ref={index === 0 ? rolesField : undefined} type="checkbox" checked={(values.cohortRoles ?? []).includes(role.key)} onChange={(event) => toggleRole(cohort.roles, role.key, event.target.checked)} aria-invalid={Boolean(errors.cohortRoles)} />{role.name}</label>)}</div>
            : <p className="app-small" role="status">Memuat program…</p>}
          {errors.cohortRoles && <p className="field-error" id="cohortRoles-error">{errors.cohortRoles}</p>}
        </>}
      </fieldset>
      <div className="app-field-grid">
      <div className="app-field dash-due-field"><label htmlFor="dueAt">Tenggat (WIB) <span className="field-required" aria-hidden="true">*</span></label><input id="dueAt" ref={dueField} type="datetime-local" required value={values.dueAt} onChange={(event) => update("dueAt", event.target.value)} aria-invalid={Boolean(errors.dueAt)} aria-describedby={described("dueAt", "due-hint")} /><p className="field-hint" id="due-hint">{isFlag ? "Flag tidak diterima lagi setelah tenggat." : "Kiriman setelah tenggat tetap diterima dan ditandai terlambat, sampai pengumpulan ditutup."}</p>{errors.dueAt && <p className="field-error" id="dueAt-error">{errors.dueAt}</p>}</div>
      {!isFlag && <div className="app-field dash-score-field"><label htmlFor="maxScore">Nilai maksimal</label><input id="maxScore" ref={maxScoreField} type="number" inputMode="numeric" min={1} max={assignmentLimits.maxScore} step={1} value={rubric.length ? (rubricSum === null ? "" : String(rubricSum)) : values.maxScore} readOnly={rubric.length > 0} onChange={(event) => update("maxScore", event.target.value)} aria-invalid={Boolean(errors.maxScore)} aria-describedby={described("maxScore", "max-score-hint")} /><p className="field-hint" id="max-score-hint">{rubric.length ? "Mengikuti jumlah poin rubrik di bawah." : `Nilai kiriman diberikan dari 0 sampai angka ini. Biarkan ${defaultMaxScore} jika tidak yakin.`}</p>{errors.maxScore && <p className="field-error" id="maxScore-error">{errors.maxScore}</p>}</div>}
      </div>
      {isFlag ? <FlagFields value={flag} errors={flagErrors} editing={!creating} onChange={updateFlag} /> : <fieldset className="dash-rubric-editor" aria-describedby={described("rubric", "rubric-hint")}>
        <legend>Rubrik <span className="app-small">(opsional)</span></legend>
        <p className="field-hint" id="rubric-hint">Pecah penilaian menjadi kriteria dengan poin maksimal masing-masing. Peninjau mengisi poin per kriteria dan totalnya menjadi nilai. Member melihat kriterianya di halaman tugas.</p>
        {rubric.length > 0 && <ol className="dash-rubric-rows">{rubric.map((criterion, index) => <li key={index} className="dash-rubric-row">
          <div className="app-field"><label htmlFor={`rubric-${index}-name`}>Kriteria {index + 1}</label><input id={`rubric-${index}-name`} maxLength={assignmentLimits.rubricName} value={criterion.name} onChange={(event) => setRubric(rubric.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder={index === 0 ? "Contoh: Kejelasan masalah" : ""} /></div>
          <div className="app-field"><label htmlFor={`rubric-${index}-max`}>Poin maks</label><input id={`rubric-${index}-max`} type="number" inputMode="numeric" min={1} max={assignmentLimits.maxScore} step={1} value={criterion.max} onChange={(event) => setRubric(rubric.map((item, i) => i === index ? { ...item, max: event.target.value } : item))} /></div>
          <button type="button" className="text-button text-danger dash-rubric-remove" onClick={() => setRubric(rubric.filter((_, i) => i !== index))} aria-label={`Hapus kriteria ${index + 1}`}><PixelIcon name="close" size={16} />Hapus</button>
        </li>)}</ol>}
        <div className="app-inline-actions"><button type="button" className="text-button" disabled={rubric.length >= assignmentLimits.rubricCriteria} onClick={() => setRubric([...rubric, { name: "", max: "" }])}><PixelIcon name="plus" size={18} />Tambah kriteria</button>{rubric.length > 0 && <span className="app-small">{rubric.length} kriteria{rubricSum !== null ? ` · total ${rubricSum} poin` : ""}</span>}</div>
        {errors.rubric && <p className="field-error" id="rubric-error">{errors.rubric}</p>}
      </fieldset>}
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
  const [initial] = useState<AssignmentValues>(() => ({ title: "", slug: "", description: "", dueAt: toJakartaInput(defaultDue()), maxScore: String(defaultMaxScore), rubric: [], audience: defaultAudience, cohortId: null, cohortRoles: [] }));
  if (!isStaff(viewer)) return <StaffOnly />;
  return <>
    <Link className="text-button app-back" href="/dashboard/tugas"><PixelIcon name="arrow-left" size={24} />Kelola tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · TUGAS BARU</p><h1>Buat tugas.</h1><p>Tulis instruksi yang bisa dikerjakan tanpa perlu bertanya lagi, lalu tentukan tenggatnya.</p></div>
    <AssignmentForm creating initial={initial} onCancel={() => router.push("/dashboard/tugas")} onSave={async (values, publish) => {
      // The detail page swaps the ID for the saved slug.
      const id = await create({ values: assignmentInput(values), publish });
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
  return <EditAssignment assignment={data.assignment} cohortRoles={data.cohort?.roles ?? []} flag={data.flag} />;
}

function EditAssignment({ assignment, cohortRoles, flag }: { assignment: Doc<"assignments">; cohortRoles: CohortRole[]; flag: string | null }) {
  const router = useRouter();
  const update = useMutation(api.assignments.update);
  const [initial] = useState<AssignmentValues>(() => ({
    title: assignment.title, slug: assignment.slug ?? slugify(assignment.title), description: assignment.description, dueAt: toJakartaInput(assignment.dueAt),
    maxScore: String(assignmentMaxScore(assignment)), rubric: (assignment.rubric ?? []).map((criterion) => ({ name: criterion.name, max: String(criterion.max) })),
    audience: assignmentAudience(assignment),
    // Stored without roles means every role, which the form shows ticked.
    cohortId: assignment.cohortId ?? null, cohortRoles: assignment.cohortRoles?.length ? assignment.cohortRoles : cohortRoles.map((role) => role.key),
    flag: assignment.kind === "flag" ? { flag: flag ?? "", maxPoints: String(assignment.maxPoints ?? 0), minPoints: String(assignment.minPoints ?? 0), decrement: String(assignment.decrement ?? 0) } : undefined,
  }));
  const back = assignmentPath(assignment);
  return <>
    <Link className="text-button app-back" href={back}><PixelIcon name="arrow-left" size={24} />Kembali ke tugas</Link>
    <div className="dash-intro"><p className="eyebrow">ADMIN · UBAH TUGAS</p><h1>Ubah tugas.</h1><p>Perubahan langsung terlihat oleh member. Mengubah tenggat juga memperbarui tanda terlambat pada kiriman. Member yang dikeluarkan dari sasaran tidak lagi melihat tugas ini, tetapi kirimannya tetap tersimpan.</p></div>
    <AssignmentForm creating={false} assignmentId={assignment._id} initial={initial} onCancel={() => router.push(back)} onSave={async (values) => {
      const slug = await update({ id: assignment._id, revision: assignment.revision, values: assignmentInput(values) });
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
