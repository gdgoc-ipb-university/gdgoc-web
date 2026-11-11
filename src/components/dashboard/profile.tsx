"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { memberTagLabel } from "@/lib/onboarding";
import { profileDraft } from "@/lib/profile-edit";
import { LoadingPanel } from "../appreciation/shared";
import { ProfileForm } from "./profile-form";
import { useDashboardViewer } from "./viewer";

const staffSetTag = "Peran dan divisi diatur oleh pengurus. Hubungi admin jika perlu diubah.";

/** Shown once to members who finished onboarding before community tags existed; they register as Member. */
export function MemberTagNotice() {
  const registerAsMember = useMutation(api.members.registerAsMember);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setBusy(true); setError("");
    try { await registerAsMember(); }
    catch (cause) { setError(readableError(cause)); setBusy(false); }
  }
  return <section className="app-panel dash-role-prompt" aria-labelledby="role-prompt-title">
    <p className="eyebrow">SATU HAL LAGI</p>
    <h1 id="role-prompt-title">Kamu terdaftar sebagai Member.</h1>
    <p>{staffSetTag}</p>
    {error && <p className="app-notice" role="alert">{error}</p>}
    <button className="button button-blue" type="button" disabled={busy} onClick={accept}>{busy ? "Menyimpan…" : "Buka dashboard"}</button>
  </section>;
}

/**
 * The member's own profile: their onboarding answers to edit (#235), the photo, and what they cannot change here (email
 * from Google, dashboard access, and the community tag staff set). `photo` is the "Foto profil" panel, passed in by the
 * route so the shell, which imports `RolePrompt`, does not load the card.
 */
export function ProfilePage({ photo }: { photo?: ReactNode }) {
  const viewer = useDashboardViewer();
  const stats = useQuery(api.assignments.list);
  const profile = useQuery(api.members.profile);
  const updateProfile = useMutation(api.members.updateProfile);
  const facts = [["Email", viewer.email], ["Akses dashboard", roleLabels[viewer.role]]];
  return <>
    <div className="dash-intro"><p className="eyebrow">AKUN</p><h1>Profil.</h1><p>Nama, sekolah atau kampus, jurusan, dan Instagram berasal dari perkenalanmu. Kamu bisa mengubahnya di sini kapan saja.</p></div>
    {photo}
    <div className="dash-profile-grid dash-profile-layout">
      <section className="app-panel" aria-labelledby="profile-edit"><h2 id="profile-edit">Ubah profil</h2>
        {profile ? <ProfileForm id="profile" initial={profileDraft(profile)} revision={profile.revision} submitLabel="Simpan profil" savedLabel="Profil tersimpan."
          save={(values, revision) => updateProfile({ values, revision })} /> : <LoadingPanel label="Memuat profil…" />}
      </section>
      <div className="dash-profile-side">
        <section className="app-panel" aria-labelledby="profile-facts"><h2 id="profile-facts">{viewer.name}</h2>
          <dl className="dash-facts">{facts.map(([term, detail]) => <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl>
          <p className="app-small">Email berasal dari akun Google-mu dan tidak bisa diubah di sini.</p>
          {stats ? <p className="app-small">{stats.filter((item) => item.submittedAt).length} tugas sudah kamu kumpulkan.</p> : <LoadingPanel label="Memuat ringkasan…" />}
        </section>
        <section className="app-panel" aria-labelledby="profile-role"><h2 id="profile-role">Peran komunitas</h2>
          {viewer.memberType && <p className="dash-badges dash-profile-tag"><span className="dash-role" data-role={viewer.memberType}>{memberTagLabel(viewer.memberType, viewer.division)}</span>
            {viewer.tagConfirmed ? <span className="dash-confirmed">Dikonfirmasi pengurus</span> : viewer.memberType !== "member" && <span className="dash-unconfirmed">Belum dikonfirmasi pengurus</span>}</p>}
          <p className="app-small">{staffSetTag}</p>
        </section>
      </div>
    </div>
  </>;
}
