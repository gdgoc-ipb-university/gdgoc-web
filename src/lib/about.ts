import { organizationId, siteUrl, websiteId } from "./site";

/** The chapter's vision and missions for 2026/27 from the grand design, shown at /tentang (#93). */
export const about = {
  path: "/tentang",
  description:
    "Kenali GDGoC IPB: visi, misi, dan sejarah komunitas teknologi mahasiswa Bogor, dari GDSC IPB sampai Google Developer Groups on Campus.",
  vision:
    "Menjadi ekosistem pertumbuhan teknologi yang inklusif, tempat mahasiswa dari IPB dan seluruh Bogor belajar, berkarya, berkompetisi, berkolaborasi, dan memimpin.",
  missions: [
    { name: "Structured Learning", text: "Jalur belajar yang jelas di software development, data & AI, dan UI/UX, didukung mentor, alumni, praktisi, dan komunitas." },
    { name: "Applied Growth", text: "Mengubah pembelajaran menjadi proyek nyata dan hasil kompetisi." },
    { name: "Connected Ecosystem", text: "Memperluas kolaborasi lintas kampus di Bogor, serta membangun mentorship dan pengembangan member yang berkelanjutan." },
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
