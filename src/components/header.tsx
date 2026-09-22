"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./icons";

export function Header({ review = false }: { review?: boolean }) {
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
        <Image
          src="/brand/gdgoc-ipb.png"
          alt="Google Developer Group IPB University"
          width={402}
          height={87}
          preload
        />
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
            <a href="#community" onClick={() => setOpen(false)}>
              Our community
            </a>
            <a href="#explore" onClick={() => setOpen(false)}>
              Explore
            </a>
            <a href="#join" className="nav-join" onClick={() => setOpen(false)}>
              Let’s connect <Arrow diagonal />
            </a>
          </nav>
        </>
      )}
    </header>
  );
}
