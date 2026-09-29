"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { memberTagLabel, validateRole, type MemberType, type OnboardingErrors, type RoleValues } from "@/lib/onboarding";
import { LoadingPanel } from "../appreciation/shared";
import { RoleChoice } from "../role-choice";
import { useDashboardViewer } from "./viewer";

type SaveRole = (role: { memberType: MemberType; division: string }) => Promise<unknown>;

export function RoleForm({ initial, onSave, submitLabel, savedMessage }: { initial: RoleValues; onSave: SaveRole; submitLabel: string; savedMessage?: string }) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const typeRef = useRef<HTMLInputElement>(null);
  const divisionRef = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateRole(value);
    setErrors(found); setError(""); setSaved(false);
    if (found.memberType) { typeRef.current?.focus(); return; }
    if (found.division) { divisionRef.current?.focus(); return; }
    setBusy(true);
    try { await onSave({ memberType: value.memberType as MemberType, division: value.division }); setSaved(true); }
    catch (cause) { setError(readableError(cause)); }
    finally { setBusy(false); }
  }
  return <form className="dash-role-form" onSubmit={submit} noValidate>
    <RoleChoice id="dash-role" value={value} errors={errors} disabled={busy} typeRef={typeRef} divisionRef={divisionRef} onChange={(next) => { setValue(next); setErrors({}); setSaved(false); }} />
    {error && <p className="app-notice" role="alert">{error}</p>}
    {saved && savedMessage && <p className="dash-success" role="status">{savedMessage}</p>}
    <button className="button button-blue" type="submit" disabled={busy}>{busy ? "Menyimpan…" : submitLabel}</button>
  </form>;
}

/** Shown once to members who finished onboarding before the role step existed. */
export function RolePrompt() {
  const saveRole = useMutation(api.members.saveRole);
  return <section className="app-panel dash-role-prompt" aria-labelledby="role-prompt-title">
    <p className="eyebrow">SATU HAL LAGI</p>
    <h1 id="role-prompt-title">Peranmu di GDGoC IPB.</h1>
    <p>Pilih Member kalau kamu ikut kegiatan komunitas, atau Core Team kalau kamu pengurus. Kamu bisa mengubahnya nanti di halaman Profil.</p>
    <RoleForm initial={{ memberType: "", division: "" }} submitLabel="Simpan dan buka dashboard" onSave={saveRole} />
  </section>;
}

export function ProfilePage() {
  const viewer = useDashboardViewer();
  const saveRole = useMutation(api.members.saveRole);
  const stats = useQuery(api.assignments.list);
  const facts = [
    ["Email", viewer.email], ["Kampus", viewer.campus || "—"], ["Program studi", viewer.studyProgram || "—"], ["Akses dashboard", roleLabels[viewer.role]],
    ["Peran komunitas", viewer.memberType ? memberTagLabel(viewer.memberType, viewer.division) : "—"],
  ];
  return <>
    <div className="dash-intro"><p className="eyebrow">AKUN</p><h1>Profil.</h1><p>Nama, kampus, dan program studi berasal dari perkenalanmu. Hubungi admin jika perlu mengoreksinya.</p></div>
    <div className="dash-profile-grid">
      <section className="app-panel" aria-labelledby="profile-facts"><h2 id="profile-facts">{viewer.name}</h2>
        <dl className="dash-facts">{facts.map(([term, detail]) => <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl>
        {stats ? <p className="app-small">{stats.filter((item) => item.submittedAt).length} tugas sudah kamu kumpulkan.</p> : <LoadingPanel label="Memuat ringkasan…" />}
      </section>
      <section className="app-panel" aria-labelledby="profile-role"><h2 id="profile-role">Peran komunitas</h2>
        {viewer.memberType === "bod"
          ? <><p>Kamu tercatat sebagai <strong>{memberTagLabel("bod", viewer.division)}</strong> (Board of Directors).</p><p className="app-small">Peran BoD diatur oleh admin. Hubungi admin GDGoC IPB jika perlu mengubahnya.</p></>
          : <><p>Pilih sesuai keterlibatanmu saat ini. Perubahan langsung tersimpan di profilmu.</p>
            <RoleForm initial={{ memberType: viewer.memberType ?? "", division: viewer.division ?? "" }} submitLabel="Simpan peran" savedMessage="Peran komunitas tersimpan." onSave={saveRole} /></>}
      </section>
    </div>
  </>;
}
