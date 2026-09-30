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
import { campusOptions, studyProgramOptions } from "@/lib/education-options";
import { readableError } from "@/lib/draft-session";
import { finalStep, normalizeOnboarding, onboardingDestination, roleStep, validateOnboarding, type OnboardingErrors, type OnboardingStep, type OnboardingValues, type RoleValues } from "@/lib/onboarding";
import { Arrow } from "../icons";
import { BrandLogo } from "../brand-logo";
import { RoleChoice } from "../role-choice";
import { EducationCombobox } from "./education-combobox";
import { OnboardingArtwork } from "./artwork";

type SaveStep = (args: { step: OnboardingStep; revision: number; values: OnboardingValues }) => Promise<Doc<"memberProfiles">>;
const stepLabels = ["Kenalan", "Kampus", "Peran", "WhatsApp", "Jadi member"];
const headings = ["Kenalan dulu, yuk.", "Dari kampus mana?", "Peranmu di\nGDGoC IPB.", "Gabung grup\nWhatsApp.", "Jadi member\nGDGoC IPB."];
const descriptions = [
  "Selamat datang di GDGoC IPB. Mulai dari nama yang ingin kamu pakai di komunitas.",
  "Apa pun jurusanmu, kamu bisa belajar teknologi di sini. Lengkapi dua hal ini untuk profilmu.",
  "Pilih Member kalau kamu ikut kegiatan komunitas, atau Core Team kalau kamu pengurus. Admin bisa membantu mengoreksinya nanti.",
  "Gabung grup WhatsApp untuk kabar kegiatan, teman diskusi, dan ajakan belajar bareng.",
  "Gabung sebagai member di halaman resmi GDGoC IPB. Temukan kegiatan dan daftar acara lewat Google Developer Groups.",
];

export function OnboardingPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.members.profile, isAuthenticated ? {} : "skip");
  const save = useMutation(api.members.saveStep);
  const router = useRouter();
  const params = useSearchParams();
  const destination = onboardingDestination(params.get("next"));
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/dashboard");
    else if (profile?.completedAt) router.replace(destination);
  }, [isLoading, isAuthenticated, profile?.completedAt, router, destination]);
  if (isLoading || !isAuthenticated || !viewer || profile === undefined || profile?.completedAt) {
    return <main id="main" className="onboard-loading" role="status">Menyiapkan ruang untukmu…</main>;
  }
  return <OnboardingFlow key={viewer.id} viewer={viewer} profile={profile} save={save} onComplete={() => router.replace(destination)} />;
}

export function OnboardingFlow({ viewer, profile, save, onComplete }: {
  viewer: { name: string; email: string }; profile: Doc<"memberProfiles"> | null; save: SaveStep; onComplete: () => void;
}) {
  const [step, setStep] = useState<OnboardingStep>(profile?.nextStep ?? 1);
  const [values, setValues] = useState<OnboardingValues>({
    fullName: profile?.fullName || viewer.name, campus: profile?.campus ?? "", studyProgram: profile?.studyProgram ?? "",
    memberType: profile?.memberType ?? "", division: profile?.division ?? "",
  });
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
  const memberType = useRef<HTMLInputElement>(null);
  const division = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);

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

  function updateRole(role: RoleValues) {
    setValues((current) => ({ ...current, ...role }));
    setErrors((current) => ({ ...current, memberType: undefined, division: undefined }));
    setError("");
  }

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateOnboarding(values, step);
    setErrors(nextErrors); setError("");
    const first = Object.keys(nextErrors)[0] as keyof OnboardingValues | undefined;
    if (first) {
      ({ fullName, campus, studyProgram, memberType, division })[first].current?.focus();
      return;
    }
    inFlight.current = true; setBusy(true);
    try {
      const saved = await save({ step, revision: revision.current, values });
      revision.current = saved.revision;
      setValues(normalizeOnboarding(values));
      if (saved.completedAt) onComplete();
      else setStep((step + 1) as OnboardingStep);
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
        <nav aria-label="Langkah perkenalan"><ol className="onboard-progress">{stepLabels.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} data-done={step > index + 1}><span className="onboard-progress-line"/><span className="onboard-progress-label"><b>{step > index + 1 ? "✓" : `0${index + 1}`}</b> <span className="onboard-progress-name">{label}</span></span></li>)}</ol></nav>
        <section className="onboard-step" aria-labelledby="onboard-title" aria-busy={busy}>
          <p className="onboard-step-counter">LANGKAH 0{step} DARI 0{finalStep} <span>{step > roleStep ? "OPSIONAL" : "TENTANG KAMU"}</span></p>
          <h1 id="onboard-title" ref={title} tabIndex={-1}>{headings[step - 1]}</h1>
          <p className="onboard-description">{descriptions[step - 1]}</p>
          <form onSubmit={next} onKeyDown={(event) => {
            // An unhandled mobile Next key moves fields. Pointer submission must
            // still work in browsers that leave focus on the preceding input.
            if (step === 2 && event.target === campus.current && event.key === "Enter" && !event.defaultPrevented && !event.nativeEvent.isComposing) {
              event.preventDefault();
              studyProgram.current?.focus();
            }
          }} noValidate>
            {step === 1 && <div className="onboard-field"><label htmlFor="fullName">Nama kamu <span aria-hidden="true">*</span></label><input id="fullName" ref={fullName} name="name" autoComplete="name" inputMode="text" enterKeyHint="next" autoCapitalize="words" maxLength={120} required disabled={busy} value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "name-hint name-error" : "name-hint"} placeholder="Nama yang ingin kamu pakai"/><p id="name-hint" className="onboard-hint">Kami isi dari akun Google. Kamu boleh menggantinya.</p>{errors.fullName && <p className="onboard-field-error" id="name-error">{errors.fullName}</p>}</div>}
            {step === 2 && <div className="onboard-education"><EducationCombobox id="campus" label="Kampus" options={campusOptions} inputRef={campus} value={values.campus} onChange={(value) => update("campus", value)} error={errors.campus} disabled={busy} enterKeyHint="next"/><EducationCombobox id="studyProgram" label="Program studi" options={studyProgramOptions} inputRef={studyProgram} value={values.studyProgram} onChange={(value) => update("studyProgram", value)} error={errors.studyProgram} disabled={busy} enterKeyHint="done"/></div>}
            {step === roleStep && <RoleChoice id="onboard-role" value={values} errors={errors} disabled={busy} onChange={updateRole} typeRef={memberType} divisionRef={division} />}
            {step === 4 && <div className="onboard-invitation"><div className="onboard-invite-icon whatsapp-icon" aria-hidden="true">WA</div><div><strong>Grup WhatsApp GDGoC IPB</strong><p>Kabar kegiatan dan obrolan komunitas dalam satu tempat.</p></div><a className="button onboard-external" href={communityLinks.whatsapp} target="_blank" rel="noopener noreferrer">Gabung grup WhatsApp <Arrow diagonal/><span className="sr-only"> (buka tab baru)</span></a><p className="onboard-external-note">Setelah bergabung, kembali ke halaman ini untuk melanjutkan.</p></div>}
            {step === finalStep && <div className="onboard-invitation"><div className="onboard-invite-icon gdg-icon" aria-hidden="true">&lt;&gt;</div><div><strong>GDG on Campus IPB University</strong><p>Buka halaman chapter, lalu pilih <b>Join us</b> untuk menjadi member.</p></div><a className="button onboard-external" href={communityLinks.membership} target="_blank" rel="noopener noreferrer">Gabung di GDG Community <Arrow diagonal/><span className="sr-only"> (buka tab baru)</span></a><p className="onboard-external-note">Sudah jadi member? Kamu bisa langsung menyelesaikan perkenalan.</p></div>}
            {error && <p className="onboard-notice" role="alert">{error} Isianmu tetap ada di halaman ini.</p>}
            <div className="onboard-actions">{step > 1 ? <button className="onboard-back" type="button" disabled={busy || leaving} onClick={() => { setErrors({}); setError(""); setStep((step - 1) as OnboardingStep); }}><span aria-hidden="true">←</span> Kembali</button> : <span className="onboard-time">{finalStep} langkah singkat.</span>}<button className="button button-blue" type="submit" disabled={busy || leaving}>{busy ? "Menyimpan…" : step === finalStep ? "Selesai, ke Dashboard" : "Lanjut"}<Arrow /></button></div>
            {step > roleStep ? <p className="onboard-save-note">Belum ingin bergabung? {step === 4 ? "Pilih Lanjut untuk melewati langkah ini." : "Kamu tetap bisa menyelesaikan perkenalan."}</p> : <p className="onboard-save-note">Data tersimpan setiap menekan Lanjut. Bisa diteruskan nanti.</p>}
          </form>
        </section>
        <footer className="onboard-footer"><span>Masuk sebagai <strong>{viewer.email}</strong></span><Link href="/privasi">Privasi</Link></footer>
      </div>
    </main>
  </div></I18nProvider>;
}
