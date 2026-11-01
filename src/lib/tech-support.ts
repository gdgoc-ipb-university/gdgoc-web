import { communityLinks } from "./community";
import type { FaqItem } from "./faq";
import { organizationId, siteUrl } from "./site";
import { techSupportHelpKinds, techSupportResponseDays } from "./tech-support-request";

/**
 * Tech Support, the Competition Support Hub, shown at /program/tech-support: mentor facilitation for members
 * preparing for competitions outside the chapter, following the program blueprint recorded in issue #91.
 * Members request mentoring from the dashboard form (#92), which `requestPath` points the call to action and the FAQ
 * at; with it set to null the page falls back to Instagram. The mentor lines are the names and roles Community & External confirmed;
 * longer profile copy is added once it is approved.
 */
export const techSupport = {
  path: "/program/tech-support",
  name: "Tech Support GDGoC IPB",
  description:
    "Tech Support GDGoC IPB: fasilitasi mentor untuk member yang bersiap mengikuti kompetisi eksternal, dari ideasi dan konsultasi teknis sampai mock judging. Dibalas paling lama 3 hari kerja.",
  /** Working days within which a request gets a reply. */
  responseDays: techSupportResponseDays,
  steps: [
    { title: "Ajukan permintaan mentoring", text: "Sampaikan bahwa kamu ingin didampingi untuk sebuah kompetisi." },
    { title: "Ceritakan kompetisi dan progresmu", text: "Bagikan info lomba, kondisi ide atau proyek saat ini, dan bagian yang ingin dibahas." },
    { title: "GDGoC mencarikan mentor", text: "Kebutuhanmu dicocokkan dengan mentor yang relevan dari jaringan komunitas." },
    { title: "Konsultasi pertama", text: "GDGoC memfasilitasi pertemuan pertama antara tim dan mentor." },
    { title: "Sepakati cakupan pendampingan", text: "Mentor dan tim menyepakati apa yang dibahas dan sampai mana pendampingan berjalan." },
  ],
  helpKinds: techSupportHelpKinds,
  mentors: [
    { name: "Badzlan Nur Dhabith", role: "Director of Program & Development, GDGoC IPB" },
    { name: "Dika Aprilio Wibowo", role: "Lead GDGoC IPB" },
    { name: "Maghfira Aulia Ramadhanti", role: "Founder Omongin.id" },
  ],
  /** The dashboard request form (#92). Set to null to send members to Instagram instead. */
  requestPath: "/dashboard/tech-support" as string | null,
} as const;

/** Where a member goes to request mentoring right now: the dashboard form once it ships, Instagram until then. */
export function requestLink() {
  return techSupport.requestPath
    ? { label: "Ajukan mentoring", href: techSupport.requestPath, external: false }
    : { label: "Tanya alur mentoring", href: communityLinks.instagram, external: true };
}

const responseLine = `Permintaan dibalas paling lama ${techSupport.responseDays} hari kerja.`;

/** The FAQ the page renders and turns into FAQPage JSON-LD. */
export const techSupportFaq: readonly FaqItem[] = [
  { question: "Siapa yang bisa mengajukan?", answer: ["Member GDGoC IPB yang sedang bersiap mengikuti kompetisi di luar komunitas, sendiri atau bersama tim. Belum member? Lihat ", { text: "cara bergabung", href: "/bergabung" }, "."] },
  {
    question: "Bagaimana cara mengajukan?",
    answer: techSupport.requestPath
      ? ["Masuk ke dashboard member, lalu buka ", { text: "form pengajuan Tech Support", href: techSupport.requestPath }, ". Siapkan info lomba, progres ide atau proyekmu, dan bagian yang ingin dibahas."]
      : ["Untuk sementara, kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, " dengan info lomba, progres ide atau proyekmu, dan bagian yang ingin dibahas. Form pengajuan di dashboard member sedang disiapkan."],
  },
  { question: "Berapa lama menunggu balasan?", answer: [responseLine] },
  { question: "Apakah mentor pasti tersedia?", answer: ["Mentor dicari sesuai kebutuhan dan ketersediaan. Topik dan cakupan pendampingan disepakati bersama di konsultasi pertama, supaya tim dan mentor sama-sama tahu apa yang bisa diharapkan."] },
  { question: "Saya punya pertanyaan lain.", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
];

/** The program as a `Service` the chapter provides to its members. */
export function techSupportJsonLd() {
  const url = `${siteUrl}${techSupport.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: techSupport.name,
    description: techSupport.description,
    url,
    inLanguage: "id",
    serviceType: "Mentoring",
    provider: { "@type": "Organization", "@id": organizationId, name: "GDGoC IPB University", url: `${siteUrl}/` },
    audience: { "@type": "Audience", audienceType: "Member GDGoC IPB" },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Bentuk dukungan",
      itemListElement: techSupport.helpKinds.map((kind) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: kind } })),
    },
  };
}
