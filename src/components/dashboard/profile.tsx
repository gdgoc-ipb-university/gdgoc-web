"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { roleLabels } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { memberTagLabel } from "@/lib/onboarding";
import { LoadingPanel } from "../appreciation/shared";
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

/** `photo` is the "Foto profil" panel, passed in by the route so the shell, which imports `RolePrompt`, does not load the card. */
export function ProfilePage({ photo }: { photo?: ReactNode }) {
  const viewer = useDashboardViewer();
  const stats = useQuery(api.assignments.list);
  const facts = [["Email", viewer.email], ["Sekolah/kampus", viewer.campus || "—"], ["Jurusan/program studi", viewer.studyProgram || "—"], ["Akses dashboard", roleLabels[viewer.role]]];
  return <>
    <div className="dash-intro"><p className="eyebrow">AKUN</p><h1>Profil.</h1><p>Nama, kampus, dan program studi berasal dari perkenalanmu. Hubungi admin jika perlu mengoreksinya.</p></div>
    {photo}
    <div className="dash-profile-grid">
      <section className="app-panel" aria-labelledby="profile-facts"><h2 id="profile-facts">{viewer.name}</h2>
        <dl className="dash-facts">{facts.map(([term, detail]) => <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl>
        {stats ? <p className="app-small">{stats.filter((item) => item.submittedAt).length} tugas sudah kamu kumpulkan.</p> : <LoadingPanel label="Memuat ringkasan…" />}
      </section>
      <section className="app-panel" aria-labelledby="profile-role"><h2 id="profile-role">Peran komunitas</h2>
        {viewer.memberType && <p className="dash-badges dash-profile-tag"><span className="dash-role" data-role={viewer.memberType}>{memberTagLabel(viewer.memberType, viewer.division)}</span>
          {viewer.tagConfirmed ? <span className="dash-confirmed">Dikonfirmasi pengurus</span> : viewer.memberType !== "member" && <span className="dash-unconfirmed">Belum dikonfirmasi pengurus</span>}</p>}
        <p className="app-small">{staffSetTag}</p>
      </section>
    </div>
  </>;
}
