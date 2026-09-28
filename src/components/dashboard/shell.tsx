"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { roleLabels } from "@/lib/assignment";
import { AccountBar, AppreciationFooter, GoogleMark, LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelDino } from "../icons";

export type DashboardViewer = NonNullable<FunctionReturnType<typeof api.dashboard.viewer>>;
const ViewerContext = createContext<DashboardViewer | null>(null);

export function useDashboardViewer() {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useDashboardViewer must be used inside DashboardShell.");
  return viewer;
}

export function isStaff(viewer: DashboardViewer) { return viewer.role !== "member"; }

function Page({ children }: { children: ReactNode }) {
  return <><main id="main" className="appreciation-page dashboard-page section-width">{children}</main><AppreciationFooter label="Informasi dashboard" /></>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.dashboard.viewer, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  if (isLoading || (isAuthenticated && viewer === undefined)) return <Page><LoadingPanel label="Menghubungkan akunmu…" /></Page>;
  if (!viewer) return <Page><DashboardLogin /></Page>;
  const account = { name: viewer.name, email: viewer.email, isAdmin: viewer.role === "owner" };
  if (!viewer.active) {
    return <Page><AccountBar viewer={account} dashboardLink={false} /><div className="app-panel dash-blocked"><p className="eyebrow">DASHBOARD GDGOC IPB</p><h1>Akunmu sedang dinonaktifkan.</h1><p>Tugas dan kiriman tidak bisa dibuka untuk sementara. Hubungi admin GDGoC IPB jika menurutmu ini keliru.</p><Link className="button button-quiet" href="/apresiasi">Ke Apresiasi</Link></div></Page>;
  }
  const links = [
    { href: "/dashboard", label: "Ringkasan", current: pathname === "/dashboard" },
    { href: "/dashboard/tugas", label: isStaff(viewer) ? "Kelola tugas" : "Tugas", current: pathname.startsWith("/dashboard/tugas") },
    ...(isStaff(viewer) ? [{ href: "/dashboard/anggota", label: "Anggota", current: pathname.startsWith("/dashboard/anggota") }] : []),
  ];
  return <Page>
    <AccountBar viewer={account} dashboardLink={false} />
    <nav className="dash-nav" aria-label="Navigasi dashboard">
      {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</Link>)}
      <span className="dash-role" data-role={viewer.role}>{roleLabels[viewer.role]}</span>
    </nav>
    <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
  </Page>;
}

function DashboardLogin() {
  const config = useQuery(api.auth.configuration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("authError")) requestAnimationFrame(() => setError("Login belum selesai atau dibatalkan. Coba masuk lagi."));
  }, []);
  async function signIn() {
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard", errorCallbackURL: "/dashboard?authError=1" });
      if (result.error) { setError("Google login belum berhasil. Coba lagi dengan akun yang ingin kamu pakai."); setBusy(false); }
    } catch { setError("Belum bisa membuka Google login. Periksa koneksi dan coba lagi."); setBusy(false); }
  }
  return <div className="app-login-grid dash-login">
    <section className="app-panel login-panel" aria-labelledby="login-title">
      <p className="eyebrow">DASHBOARD MEMBER & ADMIN</p>
      <h1 id="login-title">{"Belajar bareng,\ncatat progresmu."}</h1>
      <p>Masuk dengan akun Google yang kamu pakai di GDGoC IPB untuk melihat tugas, mengumpulkan hasil kerja, dan mengelola komunitas.</p>
      <button className="google-button" onClick={signIn} disabled={busy || !config?.googleEnabled}><GoogleMark />{busy ? "Membuka Google…" : "Lanjutkan dengan Google"}<Arrow /></button>
      {config && !config.googleEnabled && <p className="app-notice" role="status">Login sedang disiapkan. Dashboard bisa dibuka setelah koneksi Google aktif.</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
      <p className="app-small">Kami memakai nama dan email Google untuk mengelola akun, tugas, dan kirimanmu. <Link href="/privasi">Lihat penggunaan data</Link>.</p>
    </section>
    <aside className="app-how">
      <p className="eyebrow">YANG BISA KAMU LAKUKAN</p>
      <ol><li><span>01</span><div><h2>Lihat tugas</h2><p>Semua tugas yang dibuka admin, lengkap dengan tenggat dalam WIB.</p></div></li>
        <li><span>02</span><div><h2>Kumpulkan hasil kerja</h2><p>Tulis jawaban dan lampirkan file. Masih bisa diperbarui selama pengumpulan dibuka.</p></div></li>
        <li><span>03</span><div><h2>Kelola komunitas</h2><p>Admin membuat tugas, melihat kiriman, dan mengelola akses member.</p></div></li></ol>
      <div className="app-dino-note"><PixelDino /><p>Pertama kali masuk? Kamu akan diajak <strong>kenalan singkat</strong> dulu sebelum dashboard terbuka.</p></div>
    </aside>
  </div>;
}
