import Link from "next/link";
import { Faq } from "@/components/faq";
import { Arrow } from "@/components/icons";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { communityLinks } from "@/lib/community";
import type { FaqItem } from "@/lib/faq";
import { leagueHref } from "@/lib/league";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import { currentRegistrationState, techLeague } from "@/lib/tech-league";

const categoryIcons: Record<(typeof techLeague.categories)[number], PixelIconName> = {
  "Software Development": "code",
  "UI/UX Design": "brush",
  "Business Plan": "notebook",
};

/** The FAQ the page renders and serialises as `FAQPage` JSON-LD. */
export const techLeagueFaq: FaqItem[] = [
  { question: "Bagaimana cara mendaftar?", answer: [`Pilih Daftar, masuk dengan akun Google, lalu lengkapi perkenalan singkat sebagai member GDGoC IPB. Pembentukan tim dan pengumpulan karya segera dibuka di halaman Tech League; kabarnya diumumkan di Instagram saat pendaftaran dibuka pada ${dayLabel(techLeague.registration.opensAt)}.`] },
  { question: "Di mana aturan lengkapnya?", answer: techLeague.guidebookUrl ? ["Di ", { text: "guidebook Tech League", href: techLeague.guidebookUrl }, "."] : ["Di guidebook Tech League, yang ditautkan di halaman ini setelah terbit."] },
  { question: "Saya punya pertanyaan lain.", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
];

const phases = [...new Set(techLeague.timeline.map((step) => step.phase))];

function RegistrationStatus() {
  const state = currentRegistrationState();
  const { opensAt, closesAt } = techLeague.registration;
  const message = {
    upcoming: `Pendaftaran tim dibuka ${dayLabel(opensAt)} dan ditutup ${dayLabel(closesAt)}.`,
    open: `Pendaftaran tim dibuka sampai ${dayLabel(closesAt)}.`,
    closed: `Pendaftaran tim sudah ditutup pada ${dayLabel(closesAt)}.`,
  }[state];
  return <div className="league-status" role="status">
    <p>{message}</p>
    {state !== "closed" && <p className="league-status-note">Masuk sebagai member GDGoC IPB sekarang. Pembentukan tim dan pengumpulan karya segera dibuka di sini.</p>}
    <div className="league-actions">
      {state !== "closed" && <Link className="button button-blue" href={leagueHref("/daftar")}>Daftar <Arrow /></Link>}
      {state === "open" && techLeague.registrationUrl && <a className="button button-quiet" href={techLeague.registrationUrl} target="_blank" rel="noreferrer">Form pendaftaran tim <Arrow external /></a>}
      {techLeague.guidebookUrl && <a className="button button-quiet" href={techLeague.guidebookUrl} target="_blank" rel="noreferrer">Baca guidebook <Arrow external /></a>}
      <a className="text-button" href={communityLinks.instagram} target="_blank" rel="noreferrer">Pantau info di Instagram <Arrow external /></a>
    </div>
  </div>;
}

/** What the league shows about the competition: brief, registration state, categories, schedule by phase, and FAQ. */
export function TechLeagueContent() {
  return <>
    <p className="eyebrow">GDGOC IPB · KOMPETISI NASIONAL · 2026/27</p>
    <h1>Tech League.</h1>
    <p className="league-lead">Kompetisi nasional untuk mengadu karya di tiga kategori: Software Development, UI/UX Design, dan Business Plan. Siapkan karya terbaik bersama timmu.</p>
    <RegistrationStatus />

    <section aria-labelledby="league-categories">
      <h2 id="league-categories">Kategori</h2>
      <ul className="league-categories">{techLeague.categories.map((category) => <li key={category}><PixelIcon name={categoryIcons[category]} size={32} /><span>{category}</span></li>)}</ul>
    </section>

    <section id="jadwal" aria-labelledby="league-timeline">
      <h2 id="league-timeline">Jadwal</h2>
      {phases.map((phase) => <div key={phase} className="league-phase">
        <h3>{phase}</h3>
        <ol className="league-timeline">{techLeague.timeline.filter((step) => step.phase === phase).map((step) => <li key={step.label}>
          <time dateTime={step.start}>{rangeLabel(step.start, "end" in step ? step.end : undefined)}</time>
          <span>{step.label}{"note" in step && <small>{step.note}</small>}</span>
        </li>)}</ol>
      </div>)}
      <p className="league-note">Jadwal dapat berubah. Perubahan diumumkan di Instagram GDGoC IPB dan di halaman ini.</p>
    </section>

    <section id="faq" aria-labelledby="league-faq">
      <h2 id="league-faq">Pertanyaan umum</h2>
      <Faq items={techLeagueFaq} className="league-faq" />
    </section>
  </>;
}
