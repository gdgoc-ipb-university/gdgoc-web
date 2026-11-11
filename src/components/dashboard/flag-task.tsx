"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { readableError } from "@/lib/draft-session";
import { dateLabel } from "../appreciation/shared";
import { flagLimits, flagPointsOf, flagPreview, parseFlagPoints, validateFlag, type FlagErrors, type FlagInput } from "@/lib/flag-task";

/** Flag tasks (#240): the kind switch, the flag with its points and the staff summary in Kelola tugas, and the member's panel. */

const number = new Intl.NumberFormat("id-ID");
const clock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });

export function FlagBadge() {
  return <span className="app-status dash-status" data-status="flag">Flag</span>;
}

/** Chosen once, on a new task: hand-graded, or a flag the site grades. */
export function KindSwitch({ flag, onChange }: { flag: boolean; onChange: (flag: boolean) => void }) {
  return <fieldset className="dash-audience-editor" aria-describedby="kind-hint">
    <legend>Jenis tugas</legend>
    <div className="dash-audience-options">
      <label className="dash-audience-option"><input type="radio" name="kind" checked={!flag} onChange={() => onChange(false)} />Dinilai penilai</label>
      <label className="dash-audience-option"><input type="radio" name="kind" checked={flag} onChange={() => onChange(true)} />Flag, dinilai otomatis</label>
    </div>
    <p className="field-hint" id="kind-hint">{flag ? "Member mengirim flag yang mereka temukan, misalnya di Discord. Situs mencocokkannya, dan poinnya turun setiap ada yang memecahkan." : "Member mengirim jawaban dan file, lalu admin atau penilai memberi nilai."} Jenis tugas tidak bisa diubah setelah dibuat.</p>
  </fieldset>;
}

export const flagFields = ["flag", "maxPoints", "minPoints", "decrement"] as const;
const pointFields = [
  { key: "maxPoints", label: "Poin maksimal", hint: "Untuk solver pertama." },
  { key: "minPoints", label: "Poin minimal", hint: "Poin tidak turun di bawah ini." },
  { key: "decrement", label: "Turun per solve", hint: "Isi 0 agar poinnya tetap." },
] as const;

/** The flag and its points, with a live preview of what each solver gets. */
export function FlagFields({ value, errors, editing, onChange }: { value: FlagInput; errors: FlagErrors; editing: boolean; onChange: (field: keyof FlagInput, value: string) => void }) {
  // The preview needs only the numbers.
  const ready = !Object.keys(validateFlag({ ...value, flag: "x" })).length;
  const described = (field: keyof FlagInput, hint: string) => [hint, errors[field] && `${field}-error`].filter(Boolean).join(" ");
  return <fieldset className="dash-rubric-editor dash-flag-editor" aria-describedby="flag-preview">
    <legend>Flag dan poin <span className="field-required" aria-hidden="true">*</span></legend>
    <div className="app-field"><label htmlFor="flag">Flag</label>
      <input id="flag" className="dash-flag-input" required maxLength={flagLimits.flag} value={value.flag} onChange={(event) => onChange("flag", event.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={Boolean(errors.flag)} aria-describedby={described("flag", "flag-hint")} placeholder="Contoh: GDGOC{selamat-datang}" />
      <p className="field-hint" id="flag-hint">Dicocokkan persis, huruf besar dan kecil dibedakan; spasi di awal dan akhir diabaikan. Hanya admin dan pemilik yang bisa melihatnya.</p>
      {errors.flag && <p className="field-error" id="flag-error">{errors.flag}</p>}</div>
    <div className="dash-flag-points">{pointFields.map(({ key, label, hint }) => <div className="app-field" key={key}><label htmlFor={key}>{label}</label>
      <input id={key} type="number" inputMode="numeric" required min={0} max={flagLimits.points} step={1} value={value[key]} onChange={(event) => onChange(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={described(key, `${key}-hint`)} />
      <p className="field-hint" id={`${key}-hint`}>{hint}</p>{errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}</div>)}</div>
    <p className="dash-flag-preview" id="flag-preview" aria-live="polite">{ready ? flagPreview(parseFlagPoints(value)) : "Isi ketiga angka poin untuk melihat pratinjaunya."}</p>
    {editing && <p className="field-hint">Flag dan poin baru berlaku untuk solve berikutnya. Poin yang sudah didapat tidak berubah.</p>}
  </fieldset>;
}

/** What staff see of a flag task's setup on its page; the solves are listed below it. */
export function FlagSummary({ task, flag }: { task: { maxPoints?: number; minPoints?: number; decrement?: number }; flag: string | null }) {
  return <section className="dash-flag-summary" aria-labelledby="flag-summary-title">
    <div className="app-section-heading"><div><p className="eyebrow">KHUSUS ADMIN</p><h2 id="flag-summary-title">Flag dan poin</h2></div></div>
    <dl className="dash-flag-facts">
      <div><dt>Flag</dt><dd><code className="dash-flag-code">{flag}</code></dd></div>
      <div><dt>Poin</dt><dd>{flagPreview(flagPointsOf(task))}</dd></div>
    </dl>
    <p className="app-small">Member tidak pernah menerima flag ini. Mereka mengirim tebakan, dan situs yang mencocokkannya.</p>
  </section>;
}

/** A member's state on a flag task, in place of the submission badge. */
export function SolveBadge({ points }: { points: number | null }) {
  return points === null ? <span className="app-status dash-status" data-status="missing">Belum dipecahkan</span>
    : <span className="app-status dash-status" data-status="scored">Terpecahkan · {number.format(points)} poin</span>;
}

export type Challenge = NonNullable<NonNullable<FunctionReturnType<typeof api.assignments.get>>["challenge"]>;
export type SubmitFlag = (flag: string) => Promise<FunctionReturnType<typeof api.assignments.submitFlag>>;
type Feedback = { tone: "error" | "status"; text: string } | null;

/** Re-renders when `until` passes, so a rate-limited form opens on time rather than on the next minute tick. */
function useOpensAt(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), until - now + 50);
    return () => clearTimeout(timer);
  }, [until, now]);
  return now;
}

/**
 * The member's side of a flag task: what the next solver gets, the solves and first blood, then the flag form, or their
 * own solve with its locked points. Only correct solves lower the points; wrong flags are limited per member and task.
 */
export function MemberFlag({ challenge, open, closedText, onSubmit }: { challenge: Challenge; open: boolean; closedText: string; onSubmit: SubmitFlag }) {
  const [flag, setFlag] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [solvedHere, setSolvedHere] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const solvedHeading = useRef<HTMLHeadingElement>(null);
  const solved = Boolean(challenge.mine);
  // Focus moves to the result once the solve shows, whichever arrives first: the query update or the mutation's answer.
  useEffect(() => { if (solvedHere && solved) solvedHeading.current?.focus(); }, [solvedHere, solved]);
  const limitedUntil = Math.max(retryAt, challenge.nextTryAt ?? 0);
  const now = useOpensAt(limitedUntil);
  const limited = limitedUntil > now;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flag.trim()) { setFeedback({ tone: "error", text: "Tulis flag yang kamu temukan." }); input.current?.focus(); return; }
    setBusy(true); setFeedback(null);
    try {
      const result = await onSubmit(flag);
      if (result.ok) { setSolvedHere(true); return; }
      if (result.code === "LIMITED") { setRetryAt(result.retryAt); setFeedback({ tone: "error", text: result.message }); }
      else setFeedback({ tone: "error", text: `${result.message} ${result.triesLeft ? `Sisa ${result.triesLeft} percobaan sebelum harus menunggu.` : "Tunggu sebentar sebelum mencoba lagi."}` });
      input.current?.select();
    } catch (cause) { setFeedback({ tone: "error", text: readableError(cause) }); }
    finally { setBusy(false); }
  }
  const { mine, firstBlood } = challenge;
  return <>
    <dl className="dash-stats dash-flag-stats">
      <div><dt>Poin sekarang</dt><dd>{number.format(challenge.pointsNow)}</dd><dd className="dash-flag-note">Untuk solver ke-{challenge.solves + 1}{challenge.pointsNow === challenge.minPoints && challenge.solves ? ", sudah minimum" : ""}.</dd></div>
      <div><dt>Solve</dt><dd>{number.format(challenge.solves)}</dd><dd className="dash-flag-note">Member yang sudah memecahkannya.</dd></div>
      <div><dt>First blood</dt><dd className="dash-flag-blood">{firstBlood?.name ?? "—"}</dd><dd className="dash-flag-note">{firstBlood?.you ? "Itu kamu!" : firstBlood ? "Solver pertama." : "Belum ada. Jadilah yang pertama."}</dd></div>
    </dl>
    {mine ? <section className="app-panel dash-result dash-flag-solved" aria-labelledby="solved-title">
      <p className="eyebrow">TERPECAHKAN</p>
      <h2 id="solved-title" tabIndex={-1} ref={solvedHeading}>{solvedHere ? "Flag-mu tepat!" : "Kamu sudah memecahkan tugas ini."}</h2>
      <p className="dash-score">{number.format(mine.points)}<small>poin</small></p>
      <p className="app-small">Solver ke-{mine.order}{firstBlood?.you ? " · first blood" : ""} · {dateLabel(mine.solvedAt)}. Poinnya terkunci dan tidak berubah, meski poin tugas ini turun atau diubah.</p>
    </section>
      : !open ? <section className="app-form-section dash-closed" aria-labelledby="closed-title"><h2 id="closed-title">Flag tidak diterima lagi.</h2><p>{closedText}</p></section>
      : <form className="app-form-section dash-flag-form" onSubmit={submit} noValidate aria-labelledby="flag-form-title">
        <h2 id="flag-form-title">Kirim flag</h2>
        <div className="app-field"><label htmlFor="flag-answer">Flag</label>
          <div className="dash-flag-row">
            <input id="flag-answer" ref={input} className="dash-flag-input" value={flag} onChange={(event) => { setFlag(event.target.value); if (feedback?.tone === "error" && !limited) setFeedback(null); }}
              maxLength={flagLimits.flag * 2} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={feedback?.tone === "error" || undefined} aria-describedby={feedback ? "flag-answer-hint flag-feedback" : "flag-answer-hint"} placeholder="GDGOC{…}" readOnly={busy} />
            <button className="button button-blue" type="submit" disabled={busy || limited}>{busy ? "Memeriksa…" : "Kirim flag"}</button>
          </div>
          <p className="field-hint" id="flag-answer-hint">Huruf besar dan kecil dibedakan; spasi di awal dan akhir diabaikan.{limited ? ` ${feedback ? "" : "Terlalu banyak flag yang belum tepat. "}Percobaan berikutnya pukul ${clock.format(limitedUntil)} WIB.` : ""}</p>
          {feedback && <p className={feedback.tone === "error" ? "field-error" : "app-small"} id="flag-feedback" role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p>}
        </div>
      </form>}
  </>;
}
