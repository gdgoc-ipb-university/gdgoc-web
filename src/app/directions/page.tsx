import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { directions } from "@/lib/directions";

export const metadata: Metadata = {
  title: "Visual directions",
  robots: { index: false, follow: false },
};

export default function DirectionsPage() {
  return (
    <>
      <Header review />
      <main className="directions-page section-width">
        <div className="directions-intro">
          <p className="eyebrow">GDGOC IPB · VISUAL EXPLORATION · 2026/27</p>
          <h1>
            One community.
            <br />
            <span>Four little worlds.</span>
          </h1>
          <p>
            Empat environment untuk satu semangat: belajar, berkarya, dan bertumbuh bersama. Hello,
            Campus! menjadi arah pilihan, dengan revisi AHN mengikuti foto bangunan.
          </p>
          <div className="type-chips">
            <span>Pixelify Sans</span>
            <span>Space Grotesk</span>
            <span>Poppins</span>
            <span>JetBrains Mono</span>
          </div>
        </div>
        <div className="directions-grid">
          {directions.map((d) => (
            <article key={d.id} className="direction-card">
              <Link
                href={d === directions[0] ? "/" : `/directions/${d.id}`}
                className="direction-image"
                aria-label={`Preview ${d.name} pada landing`}
              >
                <Image src={d.image} alt={d.alt} fill sizes="(max-width: 760px) 100vw, 50vw" />
                <span className="direction-badge">
                  {d.number}
                  {d.number === "01" ? " / SELECTED DIRECTION" : " / EXPLORATION"}
                </span>
              </Link>
              <div className="direction-info">
                <div className="direction-heading">
                  <h2>{d.name}</h2>
                  <div className="palette" aria-label="Palet warna">
                    {d.colors.map((c) => (
                      <span key={c} style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
                <p className="direction-subtitle">{d.subtitle}</p>
                <p>{d.description}</p>
                <details>
                  <summary>Rencana motion</summary>
                  <p>{d.motion} Ini arahan animasi untuk pengembangan environment 3D berikutnya.</p>
                </details>
                <div className="direction-actions">
                  <Link href={d === directions[0] ? "/" : `/directions/${d.id}`}>
                    Preview landing <Arrow />
                  </Link>
                  <a href={d.original} download>
                    Download PNG <Arrow down />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="direction-note">
          <p className="eyebrow">FROM THE FIGMA DESIGN SYSTEM</p>
          <p>
            Warna Google dan tipografi diambil dari design system GDGoC 26/27. Hello, Campus! sudah
            direkonstruksi menjadi environment Three.js pada landing, dengan bentuk AHN mengikuti
            dua foto yang diberikan. Tiga arah lainnya tetap tersedia sebagai concept art.
          </p>
          <Link href="/environment">
            Jelajahi scene 3D tanpa teks <Arrow />
          </Link>
          <br />
          <a
            href="https://www.figma.com/design/YiFizWhGfLSUAlP5o64uVk/GDGOC-26-27?node-id=2-87148"
            target="_blank"
            rel="noreferrer"
          >
            Buka referensi Figma <Arrow external />
          </a>
        </aside>
      </main>
    </>
  );
}
