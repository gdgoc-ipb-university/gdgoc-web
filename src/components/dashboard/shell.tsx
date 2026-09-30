"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { forgetNavViewer } from "@/lib/nav-viewer";
import { roleLabels } from "@/lib/assignment";
import { memberTypeLabels } from "@/lib/onboarding";
import { AccountBar, AppreciationFooter, GoogleMark, LoadingPanel } from "../appreciation/shared";
import { BrandLogo } from "../brand-logo";
import { Header } from "../header";
import { Arrow, PixelDino } from "../icons";
import { PixelIcon, type PixelIconName } from "../pixel-icons";
import { RolePrompt } from "./profile";
import { ViewerContext, isReviewer, isStaff, type DashboardViewer } from "./viewer";


function Standalone({ children }: { children: ReactNode }) {
  return <><a className="skip-link" href="#main">Lewati ke konten</a><Header /><main id="main" className="appreciation-page dashboard-page section-width">{children}</main><AppreciationFooter label="Informasi dashboard" /></>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.dashboard.viewer, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();
  const onboarding = pathname.startsWith("/dashboard/apresiasi/tinjau") ? "/onboarding?next=review" : "/onboarding";
  const needsOnboarding = Boolean(viewer && !viewer.onboarded);
  useEffect(() => { if (needsOnboarding) router.replace(onboarding); }, [needsOnboarding, onboarding, router]);

  if (isLoading || (isAuthenticated && viewer === undefined)) return <Standalone><LoadingPanel label="Menghubungkan akunmu…" /></Standalone>;
  if (!viewer) return <Standalone><DashboardLogin /></Standalone>;
  if (needsOnboarding) return <Standalone><p className="app-panel" role="status">Menyiapkan perkenalan singkatmu…</p><Link className="text-button" href={onboarding}>Lanjut ke perkenalan →</Link></Standalone>;
  if (!viewer.active) {
    return <Standalone><AccountBar viewer={viewer} /><div className="app-panel dash-blocked"><p className="eyebrow">DASHBOARD GDGOC IPB</p><h1>Akunmu sedang dinonaktifkan.</h1><p>Tugas, apresiasi, dan kiriman tidak bisa dibuka untuk sementara. Semua yang sudah kamu kirim tetap tersimpan. Hubungi admin GDGoC IPB jika menurutmu ini keliru.</p></div></Standalone>;
  }
  if (!viewer.memberType) return <Standalone><RolePrompt /></Standalone>;
  return <ViewerContext.Provider value={viewer}><AppFrame viewer={viewer}>{children}</AppFrame></ViewerContext.Provider>;
}

type NavItem = { href: string; label: string; icon: PixelIconName; current: boolean };

function AppFrame({ viewer, children }: { viewer: DashboardViewer; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const at = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const groups: { title: string; items: NavItem[] }[] = [
    { title: "Belajar", items: [
      { href: "/dashboard", label: "Ringkasan", icon: "home", current: pathname === "/dashboard" },
      { href: "/dashboard/tugas", label: isStaff(viewer) ? "Kelola tugas" : "Tugas", icon: "clipboard-note", current: at("/dashboard/tugas") },
      { href: "/dashboard/apresiasi", label: "Apresiasi", icon: "trophy", current: pathname === "/dashboard/apresiasi" },
      { href: "/dashboard/papan-skor", label: "Papan skor", icon: "gamepad", current: at("/dashboard/papan-skor") },
    ] },
    ...(isStaff(viewer) ? [{ title: "Kelola", items: [
      ...(isReviewer(viewer) ? [{ href: "/dashboard/apresiasi/tinjau", label: "Tinjau apresiasi", icon: "shield" as const, current: at("/dashboard/apresiasi/tinjau") }] : []),
      { href: "/dashboard/anggota", label: "Anggota", icon: "users" as const, current: at("/dashboard/anggota") },
    ] }] : []),
    { title: "Akun", items: [{ href: "/dashboard/profil", label: "Profil", icon: "user", current: at("/dashboard/profil") }] },
  ];
  const firstHref = groups[0].items[0].href;
  return <div className="dash-app" data-menu-open={open}>
    <a className="skip-link" href="#main">Lewati ke konten</a>
    <header className="dash-topbar">
      <Link href="/" className="dash-topbar-brand" aria-label="GDGoC IPB — beranda"><BrandLogo /></Link>
      <button ref={toggle} type="button" className="dash-menu-button" aria-expanded={open} aria-controls="dash-sidebar" onClick={() => setOpen(!open)}>
        <PixelIcon name={open ? "close" : "menu"} size={22} /><span>{open ? "Tutup" : "Menu"}</span>
      </button>
    </header>
    <aside id="dash-sidebar" className="dash-sidebar" data-open={open} aria-label="Dashboard">
      <Link href="/" className="dash-brand" aria-label="GDGoC IPB — beranda"><BrandLogo preload /></Link>
      <nav className="dash-nav" aria-label="Navigasi dashboard">{groups.map((group) => <div key={group.title} className="dash-nav-group">
        <p className="dash-nav-heading" id={`nav-${group.title}`}>{group.title}</p>
        <ul aria-labelledby={`nav-${group.title}`}>{group.items.map((item) => {
          return <li key={item.href}><Link ref={item.href === firstHref ? firstLink : undefined} href={item.href} className="dash-nav-link" aria-current={item.current ? "page" : undefined} onClick={() => setOpen(false)}><PixelIcon name={item.icon} />{item.label}</Link></li>;
        })}</ul>
      </div>)}</nav>
      <div className="dash-account">
        <div className="dash-account-identity"><span className="account-avatar" aria-hidden="true">{viewer.name.trim().slice(0, 1).toUpperCase()}</span><div><strong>{viewer.name}</strong><span>{viewer.email}</span></div></div>
        <div className="dash-account-badges"><span className="dash-role" data-role={viewer.role}>{roleLabels[viewer.role]}</span>{viewer.memberType && <span className="dash-role" data-role={viewer.memberType}>{viewer.memberType === "core" && viewer.division ? viewer.division : memberTypeLabels[viewer.memberType]}</span>}</div>
        <Link className="dash-account-link" href="/" onClick={() => setOpen(false)}><PixelIcon name="arrow-left" size={18} />Ke beranda situs</Link>
        <SignOutButton />
      </div>
    </aside>
    {open && <div className="dash-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}
    <div className="dash-body">
      <main id="main" className="appreciation-page dashboard-page">{children}</main>
      <AppreciationFooter label="Informasi dashboard" />
    </div>
  </div>;
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try { const result = await authClient.signOut(); if (result.error) throw result.error; forgetNavViewer(); }
    catch { setError("Belum bisa keluar. Periksa koneksi, lalu coba lagi."); setBusy(false); }
  }
  return <><button type="button" className="dash-account-link" onClick={() => void signOut()} disabled={busy}><PixelIcon name="logout" size={18} />{busy ? "Sebentar…" : "Keluar"}</button>{error && <p className="field-error" role="alert">{error}</p>}</>;
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
    // Return to the page that asked for sign-in, e.g. a shared assignment link.
    const here = window.location.pathname.startsWith("/dashboard") ? window.location.pathname : "/dashboard";
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: here, errorCallbackURL: `${here}?authError=1` });
      if (result.error) { setError("Google login belum berhasil. Coba lagi dengan akun yang ingin kamu pakai."); setBusy(false); }
    } catch { setError("Belum bisa membuka Google login. Periksa koneksi dan coba lagi."); setBusy(false); }
  }
  return <div className="app-login-grid dash-login">
    <section className="app-panel login-panel" aria-labelledby="login-title">
      <p className="eyebrow">DASHBOARD MEMBER & ADMIN</p>
      <h1 id="login-title">{"Belajar bareng,\ncatat progresmu."}</h1>
      <p>Masuk dengan akun Google yang kamu pakai di GDGoC IPB untuk melihat tugas, mengumpulkan hasil kerja, dan menceritakan prestasimu.</p>
      <button className="google-button" onClick={signIn} disabled={busy || !config?.googleEnabled}><GoogleMark />{busy ? "Membuka Google…" : "Lanjutkan dengan Google"}<Arrow /></button>
      {config && !config.googleEnabled && <p className="app-notice" role="status">Login sedang disiapkan. Dashboard bisa dibuka setelah koneksi Google aktif.</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
      <p className="app-small">Kami memakai nama dan email Google untuk mengelola akun, tugas, dan kirimanmu. <Link href="/privasi">Lihat penggunaan data</Link>.</p>
    </section>
    <aside className="app-how">
      <p className="eyebrow">YANG BISA KAMU LAKUKAN</p>
      <ol><li><span>01</span><div><h2>Kerjakan tugas</h2><p>Lihat tugas dan tenggatnya dalam WIB, tulis jawaban, lalu lampirkan file hasil kerjamu.</p></div></li>
        <li><span>02</span><div><h2>Ceritakan prestasi</h2><p>Raih prestasi? Kirim ceritamu untuk diapresiasi di Instagram GDGoC IPB.</p></div></li>
        <li><span>03</span><div><h2>Kelola komunitas</h2><p>Admin membuat tugas, melihat kiriman, dan mengelola anggota.</p></div></li></ol>
      <div className="app-dino-note"><PixelDino /><p>Pertama kali masuk? Kamu akan diajak <strong>kenalan singkat</strong> dulu sebelum dashboard terbuka.</p></div>
    </aside>
  </div>;
}
