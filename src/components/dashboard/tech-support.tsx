"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toJakartaInput } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import {
  maxOpenRequests, normalizeRequest, participationLabels, techSupportHelpKinds, techSupportLimits, techSupportResponseDays, techSupportStatusLabels,
  validateRequest, type Participation, type TechSupportErrors, type TechSupportStatus, type TechSupportValues,
} from "@/lib/tech-support-request";
import { dateLabel, LoadingPanel } from "../appreciation/shared";
import { PixelIcon } from "../pixel-icons";
import { useNow } from "./shared";

export const techSupportPath = "/dashboard/tech-support";
export const techSupportQueuePath = "/dashboard/tech-support/antrean";

const blank: TechSupportValues = { competition: "", competitionUrl: "", deadline: "", participation: "", teamName: "", helpKinds: [], progress: "" };

/** "20 Nov 2026" for a YYYY-MM-DD deadline. */
export function deadlineLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(Date.parse(`${value}T00:00:00Z`));
}

export function TechSupportStatusBadge({ status }: { status: TechSupportStatus }) {
  return <span className="app-status dash-status" data-status={`support-${status}`}>{techSupportStatusLabels[status]}</span>;
}

function RequestForm({ disabled }: { disabled: boolean }) {
  const submit = useMutation(api.techSupport.submit);
  const first = useRef<HTMLInputElement>(null);
  // Arriving from the onboarding offer (`?ajukan=1`) brings the form into view with the first field focused. Read
  // from the address directly: a search-params hook would need a Suspense boundary around the whole page.
  useEffect(() => {
    if (disabled || new URLSearchParams(window.location.search).get("ajukan") !== "1") return;
    first.current?.scrollIntoView({ block: "center" });
    first.current?.focus({ preventScroll: true });
  }, [disabled]);
  const [values, setValues] = useState(blank);
  const [errors, setErrors] = useState<TechSupportErrors>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const update = <K extends keyof TechSupportValues>(field: K, value: TechSupportValues[K]) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const described = (field: keyof TechSupportValues, hint?: string) => [hint, errors[field] ? `support-${field}-error` : ""].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: keyof TechSupportValues) => errors[field] && <p className="field-error" id={`support-${field}-error`}>{errors[field]}</p>;
  const required = <span className="field-required" aria-hidden="true">*</span>;
  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeRequest(values), found = validateRequest(clean, Date.now());
    setErrors(found); setError(""); setNotice("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await submit({ values: clean });
      setValues(blank);
      setNotice(`Permintaanmu terkirim. Tim Tech Support membalas paling lama ${techSupportResponseDays} hari kerja.`);
    } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  return <form className="app-panel dash-support-form" onSubmit={(event) => void send(event)} noValidate aria-labelledby="support-form-title">
    <h2 id="support-form-title">Ajukan mentoring</h2>
    {disabled && <p className="app-notice" role="status">Kamu sudah punya {maxOpenRequests} permintaan yang berjalan. Ajukan lagi setelah salah satunya selesai.</p>}
    <fieldset disabled={busy || disabled}>
      <div className="app-field"><label htmlFor="support-competition">Nama kompetisi {required}</label>
        <input id="support-competition" ref={first} required maxLength={techSupportLimits.competition} value={values.competition} onChange={(event) => update("competition", event.target.value)} placeholder="Contoh: Gemastik 2026" aria-invalid={Boolean(errors.competition)} aria-describedby={described("competition")} />{fieldError("competition")}</div>
      <div className="app-field-grid">
        <div className="app-field"><label htmlFor="support-competitionUrl">Tautan kompetisi {required}</label>
          <input id="support-competitionUrl" type="url" inputMode="url" required maxLength={techSupportLimits.competitionUrl} value={values.competitionUrl} onChange={(event) => update("competitionUrl", event.target.value)} placeholder="https://" aria-invalid={Boolean(errors.competitionUrl)} aria-describedby={described("competitionUrl")} />{fieldError("competitionUrl")}</div>
        <div className="app-field"><label htmlFor="support-deadline">Tenggat (WIB) {required}</label>
          <input id="support-deadline" type="date" required min={toJakartaInput(now).slice(0, 10)} value={values.deadline} onChange={(event) => update("deadline", event.target.value)} aria-invalid={Boolean(errors.deadline)} aria-describedby={described("deadline", "support-deadline-hint")} />
          <p className="field-hint" id="support-deadline-hint">Tenggat pendaftaran atau pengumpulan berikutnya.</p>{fieldError("deadline")}</div>
      </div>
      <fieldset className="dash-audience-editor" aria-describedby={errors.participation ? "support-participation-error" : undefined}>
        <legend>Ikut sebagai {required}</legend>
        <div className="dash-audience-options">{(["team", "solo"] as Participation[]).map((option) => <label className="dash-audience-option" key={option}>
          <input type="radio" name="support-participation" checked={values.participation === option} onChange={() => update("participation", option)} />{participationLabels[option]}
        </label>)}</div>
        {fieldError("participation")}
      </fieldset>
      {values.participation === "team" && <div className="app-field"><label htmlFor="support-teamName">Nama tim {required}</label>
        <input id="support-teamName" required maxLength={techSupportLimits.teamName} value={values.teamName} onChange={(event) => update("teamName", event.target.value)} aria-invalid={Boolean(errors.teamName)} aria-describedby={described("teamName")} />{fieldError("teamName")}</div>}
      <fieldset className="dash-audience-editor" aria-describedby={errors.helpKinds ? "support-helpKinds-error" : undefined}>
        <legend>Bantuan yang dibutuhkan {required}</legend>
        <div className="dash-audience-options">{techSupportHelpKinds.map((kind) => <label className="dash-audience-option" key={kind}>
          <input type="checkbox" checked={values.helpKinds.includes(kind)} onChange={(event) => update("helpKinds", event.target.checked ? [...values.helpKinds, kind] : values.helpKinds.filter((item) => item !== kind))} aria-invalid={Boolean(errors.helpKinds)} />{kind}
        </label>)}</div>
        {fieldError("helpKinds")}
      </fieldset>
      <div className="app-field"><label htmlFor="support-progress">Progres saat ini {required}</label>
        <textarea data-lenis-prevent id="support-progress" required rows={5} maxLength={techSupportLimits.progress} value={values.progress} onChange={(event) => update("progress", event.target.value)} placeholder="Kondisi ide atau proyekmu sekarang, dan bagian yang ingin dibahas dengan mentor." aria-invalid={Boolean(errors.progress)} aria-describedby={described("progress", "support-progress-hint")} />
        <p className="field-hint" id="support-progress-hint">{values.progress.length}/{techSupportLimits.progress} karakter.</p>{fieldError("progress")}</div>
    </fieldset>
    {error && <p className="field-error" role="alert">{error}</p>}
    {notice && <p className="app-small" role="status">{notice}</p>}
    <button type="submit" className="button button-blue" disabled={busy || disabled}>{busy ? "Mengirim…" : "Kirim permintaan"}</button>
  </form>;
}

/** Members ask for a mentor and follow their own requests. Any active, onboarded member can; the server decides. */
export function TechSupportPage() {
  const rows = useQuery(api.techSupport.mine, {});
  const open = rows?.filter((row) => row.status !== "closed").length ?? 0;
  return <>
    <div className="dash-intro"><p className="eyebrow">TECH SUPPORT</p><h1>Tech Support.</h1>
      <p>Sedang bersiap ikut kompetisi di luar komunitas? Ceritakan lomba dan progresmu, lalu GDGoC IPB mencarikan mentor yang cocok. Permintaan dibalas paling lama {techSupportResponseDays} hari kerja. <Link className="text-link" href="/program/tech-support">Lihat alur dan mentornya</Link>.</p></div>
    {rows === undefined ? <LoadingPanel label="Memuat permintaanmu…" /> : <div className="dash-support-layout">
      <RequestForm disabled={open >= maxOpenRequests} />
      <section aria-labelledby="support-mine-title" className="dash-support-mine">
        <h2 id="support-mine-title">Permintaanmu</h2>
        {!rows.length ? <div className="app-empty"><h3>Belum ada permintaan.</h3><p>Permintaan yang kamu kirim muncul di sini dengan statusnya dan nama mentor yang dicocokkan.</p></div>
          : <ul className="dash-support-list">{rows.map((row) => <li key={row._id} className="app-panel">
            <span className="dash-badges"><TechSupportStatusBadge status={row.status} /></span>
            <h3><a href={row.competitionUrl} target="_blank" rel="noreferrer">{row.competition}<PixelIcon name="external-link" size={16} /></a></h3>
            <p className="app-small">Tenggat {deadlineLabel(row.deadline)} · {row.participation === "team" ? `Tim: ${row.teamName}` : "Sendiri"} · dikirim {dateLabel(row.submittedAt)}</p>
            <p className="app-small">{row.helpKinds.join(", ")}</p>
            <p>{row.mentorName && row.status !== "new" ? <>Mentor: <strong>{row.mentorName}</strong>. Tim Tech Support akan menghubungimu untuk konsultasi pertama.</> : row.status === "closed" ? "Permintaan ini sudah ditutup." : "Mentor sedang dicarikan."}</p>
          </li>)}</ul>}
      </section>
    </div>}
  </>;
}
