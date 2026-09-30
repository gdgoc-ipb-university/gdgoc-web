"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Arrow } from "./icons";
import { BrandLogo } from "./brand-logo";
import { ScrollProgress } from "./scroll-progress";
import { PixelIcon } from "./pixel-icons";
import { cachedNavViewer, loadNavViewer, type NavViewer } from "@/lib/nav-viewer";

const SECTIONS = [
  { id: "community", label: "Tentang kami" },
  { id: "explore", label: "Program" },
  { id: "join", label: "Bogor Run" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
/** The scroll-progress bar's quarters, in order; the active link is underlined in the quarter being filled. */
const ACCENTS = ["blue", "red", "yellow", "green"] as const;
type Accent = (typeof ACCENTS)[number];

/** On the landing, which section is being read and which progress quarter is filling. */
function useScrollSpy(enabled: boolean, header: React.RefObject<HTMLElement | null>) {
  const [spot, setSpot] = useState<{ active: SectionId | null; accent: Accent }>({ active: null, accent: "blue" });
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { scrollY, innerHeight } = window;
      const height = document.documentElement.scrollHeight;
      // A section is "being read" once its top passes a line a third of the way down the space under the header.
      const line = (header.current?.offsetHeight ?? 0) + (innerHeight - (header.current?.offsetHeight ?? 0)) / 3;
      let active: SectionId | null = null;
      for (const { id } of SECTIONS) if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= line) active = id;
      if (scrollY + innerHeight >= height - 2) active = SECTIONS[SECTIONS.length - 1].id; // the footer can't reach the line
      const progress = height > innerHeight ? scrollY / (height - innerHeight) : 0;
      const accent = ACCENTS[Math.min(ACCENTS.length - 1, Math.max(0, Math.floor(progress * ACCENTS.length)))];
      setSpot((current) => (current.active === active && current.accent === accent ? current : { active, accent }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [enabled, header]);
  return enabled ? spot : { active: null, accent: "blue" as Accent };
}

/** undefined while unknown, null for a guest, or the signed-in viewer. Read after hydration so the page renders the same. */
function useNavViewer() {
  const [viewer, setViewer] = useState<NavViewer | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      const known = cachedNavViewer();
      if (known !== undefined) { setViewer(known); return; }
      loadNavViewer(controller.signal).then(setViewer, () => { /* offline or signed out elsewhere: keep the neutral button */ });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, []);
  return viewer;
}

export function Header({ review = false }: { review?: boolean }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const inDashboard = pathname.startsWith("/dashboard");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLElement>(null);
  const { active, accent } = useScrollSpy(home && !review, bar);
  const viewer = useNavViewer();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  // Guests sign in from the dashboard's login page; members go straight in. Before the check it simply says Dashboard.
  const cta = viewer
    ? { label: `Buka dashboard, masuk sebagai ${viewer.firstName}`, body: <><span className="nav-avatar" aria-hidden="true">{viewer.initial}</span><span className="nav-cta-text"><small>Hai, {viewer.firstName}</small>Dashboard</span></> }
    : viewer === null
      ? { label: "Masuk ke dashboard dengan Google", body: <>Masuk <Arrow /></> }
      : { label: undefined, body: <>Dashboard <Arrow /></> };

  return (
    <header ref={bar} className="header">
      <Link href="/" className="brand" aria-label="GDGoC IPB — beranda">
        <BrandLogo preload />
      </Link>
      {review ? (
        <Link href="/" className="back-link">
          Kembali ke landing <Arrow />
        </Link>
      ) : (
        <>
          {/* On phones a signed-in member reaches the dashboard in one tap, without opening the menu. */}
          {viewer && <Link href="/dashboard" className="nav-quick" aria-label={cta.label} aria-current={inDashboard ? "page" : undefined}><span className="nav-avatar" aria-hidden="true">{viewer.initial}</span></Link>}
          <button
            ref={trigger}
            className="menu-toggle"
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen(!open)}
          >
            <PixelIcon name={open ? "close" : "menu"} size={24} />
          </button>
          <nav id="site-nav" className="navigation" aria-label="Navigasi utama" data-open={open} data-accent={accent}>
            {SECTIONS.map(({ id, label }) => (
              <Link key={id} href={home ? `#${id}` : `/#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              className="nav-cta"
              data-viewer={viewer ? "member" : viewer === null ? "guest" : "unknown"}
              aria-label={cta.label}
              aria-current={inDashboard ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {cta.body}
            </Link>
          </nav>
        </>
      )}
      {home && !review && <ScrollProgress />}
    </header>
  );
}
