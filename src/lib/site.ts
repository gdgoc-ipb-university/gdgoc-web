import type { Metadata } from "next";

/** The canonical public origin, without a trailing slash. Production sets NEXT_PUBLIC_SITE_URL to it (see docs/APRESIASI.md). */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.gdgocipb.com").replace(/\/+$/, "");

export const siteName = "GDGoC IPB";
export const siteDescription =
  "Google Developer Group on Campus IPB University: komunitas mahasiswa Bogor untuk belajar coding, UI/UX, dan AI lewat sesi praktik, proyek tim, dan kompetisi.";

/**
 * Open Graph fields every page shares; Next.js fills in the title and description from each page's own metadata.
 * The share image is rendered by design/og-image.mjs.
 */
export const openGraph: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName,
  locale: "id_ID",
  images: [
    {
      url: "/brand/og-image.jpg",
      width: 1200,
      height: 630,
      type: "image/jpeg",
      alt: "Kampus IPB bergaya voxel dengan Gedung Andi Hakim Nasoetion dan Chrome Dino, bertuliskan “Belajar teknologi bareng GDGoC IPB”.",
    },
  ],
};

/**
 * Canonical URL and matching `og:url` for an indexable page. Next.js replaces nested metadata
 * instead of merging it, so the shared Open Graph fields are repeated here.
 */
export function canonical(path: string): Pick<Metadata, "alternates" | "openGraph"> {
  return { alternates: { canonical: path }, openGraph: { ...openGraph, url: path } };
}
