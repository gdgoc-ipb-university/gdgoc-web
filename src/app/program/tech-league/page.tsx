import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { Header } from "@/components/header";
import { JsonLd } from "@/components/json-ld";
import { Arrow } from "@/components/icons";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { communityLinks } from "@/lib/community";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { faqJsonLd, type FaqItem } from "@/lib/faq";
import { canonical } from "@/lib/site";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import { currentRegistrationState, techLeague, techLeagueJsonLd } from "@/lib/tech-league";

export const metadata: Metadata = {
  title: "Tech League",
  description: techLeague.description,
  ...canonical(techLeague.path),
};

// The registration status depends on the date, so the page is rebuilt at most hourly instead of once at deploy.
export const revalidate = 3600;

const categoryIcons: Record<(typeof techLeague.categories)[number], PixelIconName> = {
  "Software Development": "code",
  "UI/UX Design": "brush",
  "Business Plan": "notebook",
};

const faq: FaqItem[] = [
  { question: "Bagaimana cara mendaftar?", answer: [`Lewat form resmi dari GDGoC IPB. Link form ditautkan di halaman ini dan diumumkan di Instagram saat pendaftaran dibuka pada ${dayLabel(techLeague.registration.opensAt)}.`] },
  { question: "Di mana aturan lengkapnya?", answer: techLeague.guidebookUrl ? ["Di ", { text: "guidebook Tech League", href: techLeague.guidebookUrl }, "."] : ["Di guidebook Tech League, yang ditautkan di halaman ini setelah terbit."] },
  { question: "Saya punya pertanyaan lain.", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
];

function RegistrationStatus() {
  const state = currentRegistrationState();
  const { opensAt, closesAt } = techLeague.registration;
  const message = {
    upcoming: `Pendaftaran tim dibuka ${dayLabel(opensAt)} dan ditutup ${dayLabel(closesAt)}.`,
    open: techLeague.registrationUrl ? `Pendaftaran tim dibuka sampai ${dayLabel(closesAt)}.` : `Pendaftaran tim dibuka sampai ${dayLabel(closesAt)}. Link form diumumkan di Instagram GDGoC IPB.`,
    closed: `Pendaftaran tim sudah ditutup pada ${dayLabel(closesAt)}.`,
  }[state];
  return <div className="league-status" role="status">
    <p>{message}</p>
    <div className="league-actions">
      {state === "open" && techLeague.registrationUrl && <a className="button button-blue" href={techLeague.registrationUrl} target="_blank" rel="noreferrer">Daftar tim <Arrow external /></a>}
      {techLeague.guidebookUrl && <a className="button button-quiet" href={techLeague.guidebookUrl} target="_blank" rel="noreferrer">Baca guidebook <Arrow external /></a>}
      <a className="text-button" href={communityLinks.instagram} target="_blank" rel="noreferrer">Pantau info di Instagram <Arrow external /></a>
    </div>
  </div>;
}

export default function TechLeaguePage() {
  return <>
    <JsonLd data={techLeagueJsonLd()} />
    <JsonLd data={faqJsonLd(faq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech League", path: techLeague.path }])} />
    <Header />
    <main id="main" className="league-page section-width">
      <p className="eyebrow">GDGOC IPB · KOMPETISI NASIONAL · 2026/27</p>
      <h1>Tech League.</h1>
      <p className="league-lead">Kompetisi nasional untuk mengadu karya di tiga kategori: Software Development, UI/UX Design, dan Business Plan. Siapkan karya terbaik bersama timmu.</p>
      <RegistrationStatus />

      <section aria-labelledby="league-categories">
        <h2 id="league-categories">Kategori</h2>
        <ul className="league-categories">{techLeague.categories.map((category) => <li key={category}><PixelIcon name={categoryIcons[category]} size={32} /><span>{category}</span></li>)}</ul>
      </section>

      <section aria-labelledby="league-timeline">
        <h2 id="league-timeline">Jadwal</h2>
        <ol className="league-timeline">{techLeague.timeline.map((step) => <li key={step.label}><time dateTime={step.start}>{rangeLabel(step.start, "end" in step ? step.end : undefined)}</time><span>{step.label}</span></li>)}</ol>
        <p className="league-note">Jadwal dapat berubah. Perubahan diumumkan di Instagram GDGoC IPB dan di halaman ini.</p>
      </section>

      <section aria-labelledby="league-faq">
        <h2 id="league-faq">Pertanyaan umum</h2>
        <Faq items={faq} className="league-faq" />
      </section>
    </main>
  </>;
}
