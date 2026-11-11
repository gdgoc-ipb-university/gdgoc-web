"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { campusOptions, loadCampusOptions, loadSchoolOptions, schoolProgramOptions, studyProgramOptions, type EducationOption } from "@/lib/education-options";
import { readableError } from "@/lib/draft-session";
import { educationLabels, institutionKindLabels, institutionKinds, onboardingLimits, type InstitutionKind, type OnboardingErrors } from "@/lib/onboarding";
import { normalizeProfile, profileFields, validateProfile, type ProfileDraft, type ProfileField, type ProfileValues } from "@/lib/profile-edit";
import { EducationCombobox } from "../onboarding/education-combobox";
import { PixelIcon } from "../pixel-icons";

type Props = {
  /** Prefixes every field id. */
  id: string;
  initial: ProfileDraft;
  revision: number;
  /** Saves normalised values against `revision` and returns the new revision; throws the server's refusal. */
  save: (values: ProfileValues, revision: number) => Promise<{ revision: number }>;
  /** `self` speaks to the member about their own profile; `staff` to an admin correcting someone else's (#235). */
  who?: "self" | "staff";
  submitLabel: string;
  savedLabel: string;
  /** Called after a save, e.g. to close a correction form; the saved note shows until the next edit otherwise. */
  onSaved?: () => void;
  onCancel?: () => void;
};

const required = <span className="field-required" aria-hidden="true">*</span>;

/** Field errors the server sent with a refusal (`fields` on a VALIDATION error), if any. */
function serverErrors(cause: unknown): OnboardingErrors | null {
  const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null;
  return data && typeof data === "object" && "fields" in data && data.fields && typeof data.fields === "object" ? data.fields as OnboardingErrors : null;
}

/**
 * Onboarding's answers as one dashboard form (#235): name, campus or school with onboarding's picker and lists, study
 * program, and Instagram, checked with onboarding's rules before saving. Used by the member on /dashboard/profil and by
 * staff on the member page.
 */
export function ProfileForm({ id, initial, revision: savedRevision, save, who = "self", submitLabel, savedLabel, onSaved, onCancel }: Props) {
  const [values, setValues] = useState<ProfileDraft>(initial);
  const [lists, setLists] = useState<Record<InstitutionKind, EducationOption[]>>({ campus: campusOptions, school: [] });
  const [wantsLists, setWantsLists] = useState(false);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(savedRevision);
  // The answers as last saved, brought back when the kind is switched away and back.
  const stored = useRef(initial);
  const fullName = useRef<HTMLInputElement>(null);
  const kindChoice = useRef<HTMLInputElement>(null);
  const campus = useRef<HTMLInputElement>(null);
  const studyProgram = useRef<HTMLInputElement>(null);
  const instagram = useRef<HTMLInputElement>(null);
  const kind = values.institutionKind;
  const labels = educationLabels(kind);

  // The national campus list and the school list are long, so they load once the education fields are focused.
  useEffect(() => {
    if (!wantsLists || !kind || (kind === "campus" ? lists.campus.length > campusOptions.length : lists.school.length)) return;
    let live = true;
    (kind === "campus" ? loadCampusOptions() : loadSchoolOptions()).then((options) => { if (live) setLists((current) => ({ ...current, [kind]: options })); }).catch(() => {});
    return () => { live = false; };
  }, [wantsLists, kind, lists]);

  function update(field: Exclude<ProfileField, "institutionKind">, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError(""); setSaved(false);
  }

  /** Switching between campus and school clears both answers, as onboarding does, unless it goes back to the saved kind. */
  function chooseKind(next: InstitutionKind) {
    if (next === kind) return;
    const back = next === stored.current.institutionKind;
    setValues((current) => ({ ...current, institutionKind: next, campus: back ? stored.current.campus : "", studyProgram: back ? stored.current.studyProgram : "" }));
    setErrors((current) => ({ ...current, institutionKind: undefined, campus: undefined, studyProgram: undefined }));
    setError(""); setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validateProfile(values);
    setErrors(found); setError(""); setSaved(false);
    const first = profileFields.find((field) => found[field]);
    if (first) { ({ fullName, institutionKind: kindChoice, campus, studyProgram, instagram })[first].current?.focus(); return; }
    const clean = normalizeProfile(values as ProfileValues);
    setBusy(true);
    try {
      revision.current = (await save(clean, revision.current)).revision;
      stored.current = clean;
      setValues(clean); setSaved(true);
      onSaved?.();
    } catch (cause) {
      setErrors(serverErrors(cause) ?? {});
      setError(readableError(cause));
    } finally { setBusy(false); }
  }

  const fieldId = (field: ProfileField, part = "") => `${id}-${field}${part}`;
  const described = (field: ProfileField, hint?: boolean) => [hint ? fieldId(field, "-hint") : "", errors[field] ? fieldId(field, "-error") : ""].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: ProfileField) => errors[field] && <p className="field-error" id={fieldId(field, "-error")}>{errors[field]}</p>;

  return <I18nProvider locale="id-ID"><form className="dash-profile-form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy} onKeyDown={(event) => {
    // A phone's Next key in the campus field moves on to the study program, as in onboarding.
    if (event.target === campus.current && event.key === "Enter" && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); studyProgram.current?.focus(); }
  }}>
    <fieldset disabled={busy}>
      <div className="app-field"><label htmlFor={fieldId("fullName")}>{who === "self" ? "Nama kamu" : "Nama"} {required}</label>
        <input id={fieldId("fullName")} ref={fullName} name="name" autoComplete={who === "self" ? "name" : "off"} autoCapitalize="words" enterKeyHint="next" maxLength={onboardingLimits.fullName} required value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={described("fullName", true)} />
        <p className="field-hint" id={fieldId("fullName", "-hint")}>Nama ini dicetak di kartu anggota dan dipakai di sertifikat, Apresiasi, dan halaman tim. Tulis nama lengkap dengan ejaan yang benar.</p>
        {fieldError("fullName")}</div>
      <fieldset className="dash-audience-editor" aria-describedby={described("institutionKind")}>
        <legend>{who === "self" ? "Saat ini kamu" : "Mahasiswa atau siswa"} {required}</legend>
        <div className="dash-audience-options">{institutionKinds.map((option, index) => <label className="dash-audience-option" key={option}>
          <input ref={index === 0 ? kindChoice : undefined} type="radio" name={fieldId("institutionKind")} checked={kind === option} onChange={() => chooseKind(option)} />{institutionKindLabels[option]}
        </label>)}</div>
        {fieldError("institutionKind")}
      </fieldset>
      {kind && <div onFocus={() => setWantsLists(true)}>
        <EducationCombobox appearance="field" key={`institution-${kind}`} id={fieldId("campus")} label={labels.institution} options={lists[kind].length ? lists[kind] : kind === "campus" ? campusOptions : []} inputRef={campus} value={values.campus} onChange={(value) => update("campus", value)} error={errors.campus} disabled={busy} enterKeyHint="next" hint={kind === "school" ? "Cari nama atau kotanya, misalnya “SMKN 1 Bogor”. Belum ada? Ketik nama lengkapnya." : undefined} />
        <EducationCombobox appearance="field" key={`program-${kind}`} id={fieldId("studyProgram")} label={labels.program} options={kind === "school" ? schoolProgramOptions : studyProgramOptions} inputRef={studyProgram} value={values.studyProgram} onChange={(value) => update("studyProgram", value)} error={errors.studyProgram} disabled={busy} enterKeyHint="next" />
      </div>}
      <div className="app-field"><label htmlFor={fieldId("instagram")}>Username Instagram {required}</label>
        <div className="dash-at-field"><span aria-hidden="true">@</span><input id={fieldId("instagram")} ref={instagram} name="instagram" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" maxLength={80} required value={values.instagram} onChange={(event) => update("instagram", event.target.value)} aria-invalid={Boolean(errors.instagram)} aria-describedby={described("instagram", true)} placeholder={who === "self" ? "usernamekamu" : "username"} /></div>
        <p className="field-hint" id={fieldId("instagram", "-hint")}>{who === "self"
          ? "Akun untuk follow @gdgoc.ipb dan memasang twibbon. Pengurus bisa melihat kapan username ini terakhir diubah."
          : "Akun yang dicek core team untuk follow @gdgoc.ipb dan twibbon. Menggantinya juga mencatat waktu penggantian Instagram."}</p>
        {fieldError("instagram")}</div>
    </fieldset>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="dash-profile-actions">
      <button type="submit" className="button button-blue" disabled={busy}>{busy ? "Menyimpan…" : submitLabel}</button>
      {onCancel && <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Batal</button>}
      <p className="dash-saved" role="status">{saved && <><PixelIcon name="check" size={18} />{savedLabel}</>}</p>
    </div>
  </form></I18nProvider>;
}
