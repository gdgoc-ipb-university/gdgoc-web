"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./icons";
import { BrandLogo } from "./brand-logo";
import { communityLinks } from "@/lib/community";
import { ScrollProgress } from "./scroll-progress";
import { usePathname } from "next/navigation";

export function Header({ review = false }: { review?: boolean }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
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
  return (
    <header className="header">
      <Link href="/" className="brand" aria-label="GDGoC IPB — beranda">
        <BrandLogo preload />
      </Link>
      {review ? (
        <Link href="/" className="back-link">
          Kembali ke landing <Arrow />
        </Link>
      ) : (
        <>
          <button
            ref={trigger}
            className="menu-toggle"
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
          </button>
          <nav id="site-nav" className="navigation" aria-label="Navigasi utama" data-open={open}>
            <Link href={home ? "#community" : "/#community"} onClick={() => setOpen(false)}>
              Tentang kami
            </Link>
            <Link href={home ? "#explore" : "/#explore"} onClick={() => setOpen(false)}>
              Program
            </Link>
            <Link href="/dashboard/apresiasi" aria-current={pathname.startsWith("/dashboard/apresiasi") ? "page" : undefined} onClick={() => setOpen(false)}>
              Apresiasi
            </Link>
            <Link href="/dashboard" aria-current={pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/apresiasi") ? "page" : undefined} onClick={() => setOpen(false)}>
              Dashboard
            </Link>
            <a
              href={communityLinks.membership}
              className="nav-join"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              Gabung member <Arrow diagonal />
            </a>
          </nav>
        </>
      )}
      {home && !review && <ScrollProgress />}
    </header>
  );
}
