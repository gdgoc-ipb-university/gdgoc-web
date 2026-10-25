import { organizationId, siteUrl, websiteId } from "./site";

/** The chapter's vision and missions for 2026/27, shown at /tentang (#93). */
export const about = {
  path: "/tentang",
  description:
    "Kenali GDGoC IPB: visi, misi, dan sejarah komunitas teknologi mahasiswa Bogor, dari GDSC IPB sampai Google Developer Groups on Campus.",
  vision:
    "Menjadi ekosistem pertumbuhan teknologi yang inklusif, tempat mahasiswa dari IPB dan seluruh Bogor belajar, berkarya, berkompetisi, berkolaborasi, dan memimpin.",
  missions: [
    { name: "Structured Learning", text: "Belajar teknologi secara terarah, dari Study Jam sampai bootcamp GDGoC Catalyst." },
    { name: "Applied Growth", text: "Menerapkan ilmu lewat proyek tim, kompetisi seperti Tech League, dan pendampingan mentor." },
    { name: "Connected Ecosystem", text: "Menghubungkan mahasiswa lintas kampus di Bogor dengan sesama member, mentor, dan jaringan Google Developer Groups." },
  ],
} as const;

/** `AboutPage` for /tentang. The `Organization` itself stays on the landing; this page points at it. */
export function aboutPageJsonLd() {
  const url = `${siteUrl}${about.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#webpage`,
    name: "Tentang GDGoC IPB",
    description: about.description,
    url,
    inLanguage: "id",
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
  };
}
