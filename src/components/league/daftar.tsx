"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GoogleMark, LoadingPanel } from "@/components/appreciation/shared";
import { Arrow } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { leagueHref, mainHref } from "@/lib/league";
import { forgetNavViewer } from "@/lib/nav-viewer";

/** Where Google returns after sign-in started here: this page, on the league host (a trusted origin, #179). */
function returnUrl() {
  return new URL(leagueHref("/daftar"), window.location.origin).toString();
}

/**
 * "Daftar" on the league: a visitor signs in with Google, a new member goes through onboarding on the main site and comes
 * back here, and a member sees what opens next. Teams and submissions arrive here in #183 and #180.
 */
export function LeagueRegistration() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.members.profile, isAuthenticated ? {} : "skip");
  const needsOnboarding = Boolean(viewer && profile !== undefined && !profile?.completedAt);
  useEffect(() => { if (needsOnboarding) window.location.assign(mainHref("/onboarding?next=league")); }, [needsOnboarding]);

  if (isLoading || (isAuthenticated && (viewer === undefined || profile === undefined))) return <LoadingPanel label="Menghubungkan akunmu…" />;
  if (!viewer) return <SignIn />;
  if (needsOnboarding) return <p className="app-panel" role="status">Mengajakmu kenalan singkat dulu…</p>;
  return <section className="app-panel league-member" aria-labelledby="league-member-title">
    <p className="eyebrow">TECH LEAGUE 2026/27</p>
    <h1 id="league-member-title">Halo, {viewer.name.split(/\s+/)[0]}.</h1>
    <p>Kamu sudah masuk sebagai member GDGoC IPB. Pembentukan tim dan pengumpulan karya segera dibuka di sini. Kabarnya kami umumkan di Instagram GDGoC IPB.</p>
    <div className="league-actions">
      <a className="button button-blue" href={leagueHref("/")}>Lihat jadwal <Arrow /></a>
      <a className="text-button" href={mainHref("/dashboard")}>Buka dashboard <Arrow /></a>
      <SignOut />
    </div>
  </section>;
}

function SignIn() {
  const config = useQuery(api.auth.configuration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("authError")) requestAnimationFrame(() => setError("Login belum selesai atau dibatalkan. Coba masuk lagi."));
  }, []);
  async function signIn() {
    setBusy(true); setError("");
    try {
      const here = returnUrl();
      const result = await authClient.signIn.social({ provider: "google", callbackURL: here, errorCallbackURL: `${here}?authError=1` });
      if (result.error) { setError("Google login belum berhasil. Coba lagi dengan akun yang ingin kamu pakai."); setBusy(false); }
    } catch { setError("Belum bisa membuka Google login. Periksa koneksi dan coba lagi."); setBusy(false); }
  }
  return <section className="app-panel login-panel" aria-labelledby="league-login-title">
    <p className="eyebrow">DAFTAR TECH LEAGUE</p>
    <h1 id="league-login-title">Masuk dulu sebagai member GDGoC IPB.</h1>
    <p>Masuk dengan akun Google. Kalau ini pertama kalinya, kamu diajak kenalan singkat dulu, lalu kembali ke sini. Pembentukan tim dan pengumpulan karya segera dibuka di Tech League.</p>
    <button className="google-button" onClick={signIn} disabled={busy || !config?.googleEnabled}><GoogleMark />{busy ? "Membuka Google…" : "Lanjutkan dengan Google"}<Arrow /></button>
    {config && !config.googleEnabled && <p className="app-notice" role="status">Login sedang disiapkan. Coba lagi nanti.</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <p className="app-small">Kami memakai nama dan email Google untuk mengelola akunmu. <a href={mainHref("/privasi")}>Lihat penggunaan data</a>.</p>
  </section>;
}

/** Signing out here clears the shared cookies, so it signs out of the main site too. */
function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try { const result = await authClient.signOut(); if (result.error) throw result.error; forgetNavViewer(); window.location.assign(leagueHref("/")); }
    catch { setError("Belum bisa keluar. Periksa koneksi, lalu coba lagi."); setBusy(false); }
  }
  return <>
    <button type="button" className="text-button" onClick={() => void signOut()} disabled={busy}>{busy ? "Sebentar…" : "Keluar"}</button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </>;
}
