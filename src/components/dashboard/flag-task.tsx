"use client";

import { flagLimits, flagPointsOf, flagPreview, parseFlagPoints, validateFlag, type FlagErrors, type FlagInput } from "@/lib/flag-task";

/** Flag tasks (#240) in Kelola tugas: the kind switch, the flag with its points, and the staff summary. */

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
