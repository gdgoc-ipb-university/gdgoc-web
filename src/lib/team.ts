import { chapterPeriod } from "./chapter";
import { organizationId, siteUrl } from "./site";

type ProfileLink = { label: string; href: string };

/**
 * A chapter leader on /tim. Photo and profile links wait on the person's approval, so they stay null until then;
 * the page shows the pixel initial instead of a photo.
 */
export type Leader = {
  key: "lead" | "co-lead";
  role: string;
  name: string | null;
  /** A path under `public/`, once approved. */
  photo: string | null;
  links: readonly ProfileLink[] | null;
};

/**
 * Who runs the chapter in 2026/27, shown at /tim (#94). Epic #86, decision 1: only the Lead and Co-Lead are named;
 * divisions are listed by purpose without staff names. Names follow the "Meet the New Leads" post of 31 Jul 2026.
 */
export const team = {
  path: "/tim",
  year: chapterPeriod.year,
  description: `Tim GDGoC IPB ${chapterPeriod.year}: Lead, Co-Lead, dan lima divisi yang menjalankan program komunitas teknologi mahasiswa Bogor.`,
  leaders: [
    { key: "lead", role: "Lead", name: "Dika Aprilio Wibowo", photo: null, links: null },
    { key: "co-lead", role: "Co-Lead", name: "Trias Aldi", photo: null, links: null },
  ] satisfies readonly Leader[] as readonly Leader[],
  divisions: [
    { name: "Program & Development", purpose: "Merancang dan menjalankan program unggulan chapter, seperti Tech League dan GDGoC Catalyst. Fokusnya pengembangan member yang berkelanjutan, bukan sekadar acara." },
    { name: "Community & External", purpose: "Menjaga komunitas tetap hidup ke dalam dan membangun relasi ke luar, dari kabar harian di grup sampai kerja sama dengan partner dan media partner." },
    { name: "Media & Creative", purpose: "Menulis dan mendesain wajah GDGoC IPB: copywriting, ilustrasi, konten Instagram, dan website." },
    { name: "Technical", purpose: "Memegang jalur belajar software development, data & AI, dan UI/UX. Tiap jalur punya PIC yang mencarikan mentor berbeda untuk Study Jam dan sesi Catalyst." },
    { name: "Secretary-Treasurer", purpose: "Mengurus administrasi dan keuangan chapter: surat, arsip, notulen rapat, ToR program, dan MoU kerja sama." },
  ],
} as const;

/** The letter on the pixel avatar: the name's first letter, or the role's while the name is not set. */
export function leaderInitial(leader: Pick<Leader, "name" | "role">) {
  return (leader.name ?? leader.role).trim().slice(0, 1).toUpperCase();
}

/** `Person` nodes for the named leaders, each working for the landing's `Organization`. Unnamed slots are left out. */
export function teamJsonLd(leaders: readonly Leader[] = team.leaders) {
  const url = `${siteUrl}${team.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": leaders.flatMap((leader) => leader.name ? [{
      "@type": "Person",
      "@id": `${url}#${leader.key}`,
      name: leader.name,
      jobTitle: `${leader.role} GDGoC IPB ${team.year}`,
      worksFor: { "@id": organizationId },
      url,
      ...(leader.photo && { image: `${siteUrl}${leader.photo}` }),
      ...(leader.links?.length && { sameAs: leader.links.map((link) => link.href) }),
    }] : []),
  };
}
