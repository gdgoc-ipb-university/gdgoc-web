"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { forgetNavViewer } from "@/lib/nav-viewer";
import { communityLinks } from "@/lib/community";
import { campusOptions, loadCampusOptions, loadSchoolOptions, schoolProgramOptions, studyProgramOptions, type EducationOption } from "@/lib/education-options";
import { techSupportHelpKinds, techSupportResponseDays } from "@/lib/tech-support-request";
import { readableError } from "@/lib/draft-session";
import { educationLabels, finalStep, institutionKindLabels, institutionKinds, normalizeOnboarding, onboardingDestination, onboardingSteps, resumeStep, stepAfter, stepBefore, techSupportRequestPath, validateOnboarding, type InstitutionKind, type OnboardingErrors, type OnboardingStep, type OnboardingValues } from "@/lib/onboarding";
import { Arrow } from "../icons";
import { BrandLogo } from "../brand-logo";
import { EducationCombobox } from "./education-combobox";
import { OnboardingArtwork } from "./artwork";
import { PixelIcon } from "../pixel-icons";

type SaveStep = (args: { step: OnboardingStep; revision: number; values: OnboardingValues }) => Promise<Doc<"memberProfiles">>;
// Per screen, in the order of `onboardingSteps`. Membership is open to SMK students too, so screen 2 asks for either.
const stepLabels = ["Kenalan", "Sekolah/kampus", "WhatsApp", "Jadi member", "Tech Support"];
const headings = ["Kenalan dulu, yuk.", "Dari sekolah atau\nkampus mana?", "Gabung grup\nWhatsApp.", "Jadi member\nGDGoC IPB.", "Punya target\nlomba?"];
const descriptions = [
  "Selamat datang di GDGoC IPB. Mulai dari nama yang ingin kamu pakai di komunitas.",
  "Mahasiswa dari kampus mana pun dan siswa SMK bisa bergabung. Apa pun jurusanmu, kamu bisa belajar teknologi di sini.",
  "Gabung grup WhatsApp untuk kabar kegiatan, teman diskusi, dan ajakan belajar bareng.",
  "Gabung sebagai member di halaman resmi GDGoC IPB. Temukan kegiatan dan daftar acara lewat Google Developer Groups.",
  `Member bisa minta Tech Support: GDGoC IPB mencarikan mentor dan mendampingimu untuk lomba teknologi, AI, dan web dev di luar komunitas. Dibalas paling lama ${techSupportResponseDays} hari kerja.`,
];

export function OnboardingPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.members.profile, isAuthenticated ? {} : "skip");
  // An accepted program participant (e.g. Catalyst) is greeted with their program and role on the first screen.
  const invitation = useQuery(api.cohorts.myInvitation, isAuthenticated ? {} : "skip");
  const save = useMutation(api.members.saveStep);
  const router = useRouter();
  const params = useSearchParams();
  const destination = onboardingDestination(params.get("next"), params.get("undangan"));
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/dashboard");
    else if (profile?.completedAt) router.replace(destination);
  }, [isLoading, isAuthenticated, profile?.completedAt, router, destination]);
  if (isLoading || !isAuthenticated || !viewer || profile === undefined || profile?.completedAt) {
    return <main id="main" className="onboard-loading" role="status">Menyiapkan ruang untukmu…</main>;
  }
  return <OnboardingFlow key={viewer.id} viewer={viewer} profile={profile} save={save} invitation={invitation ?? null} onComplete={(target) => router.replace(target ?? destination)} finishLabel={params.get("next") === "league" ? "Selesai, ke Tech League" : undefined} />;
}

export function OnboardingFlow({ viewer, profile, save, onComplete, invitation = null, finishLabel = "Selesai, ke Dashboard" }: {
  /** The last step's button, which names where onboarding returns to. */
  finishLabel?: string;
  /** Set for an accepted program participant (cohorts.myInvitation): their program and role, shown on the first screen. */
  invitation?: { cohort: string; role: string } | null;
  /** Called once the last screen is saved; `target` is set when the member chose to request Tech Support. */
  viewer: { name: string; email: string }; profile: Doc<"memberProfiles"> | null; save: SaveStep; onComplete: (target?: string) => void;
}) {
  const [step, setStep] = useState<OnboardingStep>(resumeStep(profile?.nextStep));
  // A profile saved before the kind was asked had a campus; a new one chooses.
  const [values, setValues] = useState<OnboardingValues>({ fullName: profile?.fullName || viewer.name, campus: profile?.campus ?? "", studyProgram: profile?.studyProgram ?? "", institutionKind: profile?.institutionKind ?? (profile?.campus ? "campus" : undefined) });
  const [wantsSupport, setWantsSupport] = useState(false);
  const [lists, setLists] = useState<Record<InstitutionKind, EducationOption[]>>({ campus: campusOptions, school: [] });
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const revision = useRef(profile?.revision ?? 0);
  const inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const fullName = useRef<HTMLInputElement>(null);
  const campus = useRef<HTMLInputElement>(null);
  const studyProgram = useRef<HTMLInputElement>(null);
  const kindChoice = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  const position = onboardingSteps.indexOf(step);
  const kind = values.institutionKind;
  const labels = educationLabels(kind);

  // The national campus list and the SMK list are long, so they load only when the education screen needs them.
  useEffect(() => {
    if (step !== 2 || !kind || (kind === "campus" ? lists.campus.length > campusOptions.length : lists.school.length)) return;
    let live = true;
    (kind === "campus" ? loadCampusOptions() : loadSchoolOptions()).then((options) => { if (live) setLists((current) => ({ ...current, [kind]: options })); }).catch(() => {});
    return () => { live = false; };
  }, [step, kind, lists]);

  useEffect(() => {
    if (previousStep.current !== step) {
      title.current?.focus({ preventScroll: true });
      title.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
      previousStep.current = step;
    }
  }, [step]);

  function update(field: "fullName" | "campus" | "studyProgram", value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
  }

  /** Switching between campus and school clears the two answers, which belong to the other list. */
  function chooseKind(next: InstitutionKind) {
    if (next === kind) return;
    setValues((current) => ({ ...current, institutionKind: next, campus: "", studyProgram: "" }));
    setErrors({}); setError("");
  }

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateOnboarding(values, step, { requireKind: true });
    setErrors(nextErrors); setError("");
    const first = Object.keys(nextErrors)[0] as keyof OnboardingValues | undefined;
    if (first) {
      ({ fullName, campus, studyProgram, institutionKind: kindChoice })[first].current?.focus();
      return;
    }
    inFlight.current = true; setBusy(true);
    try {
      const clean = normalizeOnboarding(values);
      const saved = await save({ step, revision: revision.current, values: clean });
      revision.current = saved.revision;
      setValues(clean);
      if (saved.completedAt) onComplete(wantsSupport ? techSupportRequestPath : undefined);
      else setStep(stepAfter(step));
    } catch (cause) { setError(readableError(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function signOut() {
    if (inFlight.current) return;
    setLeaving(true); setError("");
    try { const result = await authClient.signOut(); if (result.error) throw result.error; forgetNavViewer(); }
    catch { setError("Belum bisa keluar. Periksa koneksi, lalu coba lagi."); }
    finally { setLeaving(false); }
  }

  return <I18nProvider locale="id-ID"><div className="onboard-page">
    <a className="skip-link" href="#main">Lewati ke konten</a>
    <header className="onboard-header"><Link href="/" aria-label="GDGoC IPB — beranda"><BrandLogo preload /></Link><button className="onboard-exit" onClick={signOut} disabled={busy || leaving}>{leaving ? "Sebentar…" : "Keluar akun"}</button></header>
    <main id="main" className="onboard-layout">
      <OnboardingArtwork step={step} />
      <div className="onboard-content">
        <nav aria-label="Langkah perkenalan"><ol className="onboard-progress">{stepLabels.map((label, index) => <li key={label} aria-current={position === index ? "step" : undefined} data-done={position > index}><span className="onboard-progress-line"/><span className="onboard-progress-label"><b>{position > index ? <PixelIcon name="check" size={12} /> : `0${index + 1}`}</b> <span className="onboard-progress-name">{label}</span></span></li>)}</ol></nav>
        <section className="onboard-step" aria-labelledby="onboard-title" aria-busy={busy}>
          <p className="onboard-step-counter">LANGKAH 0{position + 1} DARI 0{onboardingSteps.length} <span>{step > 2 ? "OPSIONAL" : "TENTANG KAMU"}</span></p>
          <h1 id="onboard-title" ref={title} tabIndex={-1}>{headings[position]}</h1>
          <p className="onboard-description">{descriptions[position]}{invitation && step === 1 && <> Kamu terdaftar sebagai peserta {invitation.cohort}, peran {invitation.role}.</>}</p>
          <form onSubmit={next} onKeyDown={(event) => {
            // An unhandled mobile Next key moves fields. Pointer submission must
            // still work in browsers that leave focus on the preceding input.
            if (step === 2 && event.target === campus.current && event.key === "Enter" && !event.defaultPrevented && !event.nativeEvent.isComposing) {
              event.preventDefault();
              studyProgram.current?.focus();
            }
          }} noValidate>
            {step === 1 && <div className="onboard-field"><label htmlFor="fullName">Nama kamu <span aria-hidden="true">*</span></label><input id="fullName" ref={fullName} name="name" autoComplete="name" inputMode="text" enterKeyHint="next" autoCapitalize="words" maxLength={120} required disabled={busy} value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "name-hint name-error" : "name-hint"} placeholder="Nama yang ingin kamu pakai"/><p id="name-hint" className="onboard-hint">Kami isi dari akun Google. Kamu boleh menggantinya.</p>{errors.fullName && <p className="onboard-field-error" id="name-error">{errors.fullName}</p>}</div>}
            {step === 2 && <div className="onboard-education">
              <fieldset className="onboard-kind" aria-describedby={errors.institutionKind ? "kind-error" : undefined} aria-invalid={Boolean(errors.institutionKind)}>
                <legend>Saat ini kamu <span aria-hidden="true">*</span></legend>
                <div className="onboard-kind-options">{institutionKinds.map((option, index) => <label key={option} className="onboard-kind-option" data-checked={kind === option}>
                  <input ref={index === 0 ? kindChoice : undefined} type="radio" name="institutionKind" value={option} checked={kind === option} disabled={busy} onChange={() => chooseKind(option)} />
                  <span>{institutionKindLabels[option]}</span><small>{option === "campus" ? "Kampus mana pun, di Bogor atau luar Bogor" : "SMK atau MAK"}</small>
                </label>)}</div>
                {errors.institutionKind && <p className="onboard-field-error" id="kind-error">{errors.institutionKind}</p>}
              </fieldset>
              {kind && <>
                <EducationCombobox key={`institution-${kind}`} id="campus" label={labels.institution} options={lists[kind].length ? lists[kind] : kind === "campus" ? campusOptions : []} inputRef={campus} value={values.campus} onChange={(value) => update("campus", value)} error={errors.campus} disabled={busy} enterKeyHint="next" hint={kind === "school" ? "Cari nama atau kotanya, misalnya “SMKN 1 Bogor”. Belum ada? Ketik nama lengkapnya." : undefined}/>
                <EducationCombobox key={`program-${kind}`} id="studyProgram" label={labels.program} options={kind === "school" ? schoolProgramOptions : studyProgramOptions} inputRef={studyProgram} value={values.studyProgram} onChange={(value) => update("studyProgram", value)} error={errors.studyProgram} disabled={busy} enterKeyHint="done"/>
              </>}
            </div>}
            {step === 4 && <div className="onboard-invitation"><div className="onboard-invite-icon whatsapp-icon" aria-hidden="true"><PixelIcon name="whatsapp" size={24} /></div><div><strong>Grup WhatsApp GDGoC IPB</strong><p>Kabar kegiatan dan obrolan komunitas dalam satu tempat.</p></div><a className="button onboard-external" href={communityLinks.whatsapp} target="_blank" rel="noopener noreferrer">Gabung grup WhatsApp <Arrow external /><span className="sr-only"> (buka tab baru)</span></a><p className="onboard-external-note">Setelah bergabung, kembali ke halaman ini untuk melanjutkan.</p></div>}
            {step === 5 && <div className="onboard-invitation"><div className="onboard-invite-icon gdg-icon" aria-hidden="true"><PixelIcon name="code" size={24} /></div><div><strong>GDG on Campus IPB University</strong><p>Buka halaman chapter, lalu pilih <b>Join us</b> untuk menjadi member.</p></div><a className="button onboard-external" href={communityLinks.membership} target="_blank" rel="noopener noreferrer">Gabung di GDG Community <Arrow external /><span className="sr-only"> (buka tab baru)</span></a><p className="onboard-external-note">Sudah jadi member? Pilih Lanjut ke langkah terakhir.</p></div>}
            {step === finalStep && <div className="onboard-invitation onboard-support"><div className="onboard-invite-icon support-icon" aria-hidden="true"><PixelIcon name="message-text" size={24} /></div><div><strong>Tech Support GDGoC IPB</strong><p>Bantuan yang bisa kamu minta:</p><ul className="onboard-support-kinds">{techSupportHelpKinds.map((kind) => <li key={kind}>{kind}</li>)}</ul></div>
              <fieldset className="onboard-kind onboard-support-choice"><legend>Mau ajukan sekarang?</legend><div className="onboard-kind-options">
                <label className="onboard-kind-option" data-checked={wantsSupport}><input type="radio" name="techSupport" checked={wantsSupport} disabled={busy} onChange={() => setWantsSupport(true)} /><span>Ya, ajukan setelah ini</span><small>Formulirnya terbuka begitu perkenalan selesai.</small></label>
                <label className="onboard-kind-option" data-checked={!wantsSupport}><input type="radio" name="techSupport" checked={!wantsSupport} disabled={busy} onChange={() => setWantsSupport(false)} /><span>Nanti saja</span><small>Bisa diajukan kapan saja dari menu Tech Support.</small></label>
              </div></fieldset></div>}
            {error && <p className="onboard-notice" role="alert">{error} Isianmu tetap ada di halaman ini.</p>}
            <div className="onboard-actions">{step > 1 ? <button className="onboard-back" type="button" disabled={busy || leaving} onClick={() => { setErrors({}); setError(""); setStep(stepBefore(step)); }}><PixelIcon name="arrow-left" size={24} /> Kembali</button> : <span className="onboard-time">{onboardingSteps.length} langkah singkat.</span>}<button className="button button-blue" type="submit" disabled={busy || leaving}>{busy ? "Menyimpan…" : step === finalStep ? (wantsSupport ? "Selesai, ajukan Tech Support" : finishLabel) : "Lanjut"}<Arrow /></button></div>
            {step === finalStep ? <p className="onboard-save-note">Tidak sedang ikut lomba? Pilih Nanti saja, lalu selesaikan perkenalan.</p> : step > 2 ? <p className="onboard-save-note">Belum ingin bergabung? Pilih Lanjut untuk melewati langkah ini.</p> : <p className="onboard-save-note">Data tersimpan setiap menekan Lanjut. Bisa diteruskan nanti.</p>}
          </form>
        </section>
        <footer className="onboard-footer"><span>Masuk sebagai <strong>{viewer.email}</strong></span><Link href="/privasi">Privasi</Link></footer>
      </div>
    </main>
  </div></I18nProvider>;
}
