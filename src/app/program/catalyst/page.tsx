import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { Header } from "@/components/header";
import { JsonLd } from "@/components/json-ld";
import { Arrow } from "@/components/icons";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { catalyst, catalystCourseJsonLd, catalystEventJsonLd, currentOprecState } from "@/lib/catalyst";
import { communityLinks } from "@/lib/community";
import { faqJsonLd, type FaqItem } from "@/lib/faq";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "GDGoC Catalyst",
  description: catalyst.description,
  ...canonical(catalyst.path),
};

// The oprec status depends on the date, so the page is rebuilt at most hourly instead of once at deploy.
export const revalidate = 3600;

const roleIcons: Record<(typeof catalyst.roles)[number]["name"], PixelIconName> = {
  Hacker: "code",
  Hipster: "brush",
  Hustler: "clipboard-note",
};

const { oprec, sessions } = catalyst;
const sessionRange = rangeLabel(sessions.start, sessions.end);

const faq: FaqItem[] = [
  { question: "Siapa yang bisa mendaftar?", answer: ["Siswa SMK dan mahasiswa dari sekolah atau kampus mana pun, tidak hanya IPB."] },
  { question: "Apakah ada biaya?", answer: ["Tidak. GDGoC Catalyst gratis."] },
  { question: "Berapa komitmen waktunya?", answer: [`Sembilan sesi daring pada hari Minggu, ${sessionRange}. Peserta berkomitmen hadir minimal ${catalyst.attendance} sesi.`] },
  { question: "Bagaimana cara mendaftar?", answer: catalyst.oprecUrl ? ["Lewat ", { text: "form pendaftaran Catalyst", href: catalyst.oprecUrl }, `, dibuka ${rangeLabel(oprec.opensAt, oprec.closesAt)}.`] : [`Lewat form pendaftaran yang ditautkan di halaman ini dan diumumkan di Instagram saat pendaftaran dibuka pada ${dayLabel(oprec.opensAt)}.`] },
  { question: "Kapan peserta diumumkan?", answer: [`${dayLabel(catalyst.announcedAt)}.`] },
  { question: "Saya punya pertanyaan lain.", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
];

function OprecStatus() {
  const state = currentOprecState();
  const announcement = `Peserta diumumkan ${dayLabel(catalyst.announcedAt)}.`;
  const message = {
    upcoming: `Pendaftaran dibuka ${dayLabel(oprec.opensAt)} dan ditutup ${dayLabel(oprec.closesAt)}. ${announcement}`,
    open: catalyst.oprecUrl ? `Pendaftaran dibuka sampai ${dayLabel(oprec.closesAt)}. ${announcement}` : `Pendaftaran dibuka sampai ${dayLabel(oprec.closesAt)}. Link form diumumkan di Instagram GDGoC IPB.`,
    closed: `Pendaftaran sudah ditutup pada ${dayLabel(oprec.closesAt)}. ${announcement}`,
    announced: `Pendaftaran Catalyst 2026/27 sudah ditutup dan peserta diumumkan pada ${dayLabel(catalyst.announcedAt)}.`,
  }[state];
  return <div className="league-status" role="status">
    <p>{message}</p>
    <div className="league-actions">
      {state === "open" && catalyst.oprecUrl && <a className="button button-blue" href={catalyst.oprecUrl} target="_blank" rel="noreferrer">Daftar <Arrow external /></a>}
      <a className="text-button" href={communityLinks.instagram} target="_blank" rel="noreferrer">Pantau info di Instagram <Arrow external /></a>
    </div>
  </div>;
}

export default function CatalystPage() {
  return <>
    <JsonLd data={catalystCourseJsonLd()} />
    <JsonLd data={catalystEventJsonLd()} />
    <JsonLd data={faqJsonLd(faq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Catalyst", path: catalyst.path }])} />
    <Header />
    <main id="main" className="league-page section-width">
      <p className="eyebrow">GDGOC IPB · BOOTCAMP · 2026/27</p>
      <h1>GDGoC Catalyst.</h1>
      <p className="league-lead">Bootcamp {catalyst.track} untuk belajar membangun produk dalam tim lewat tiga peran: Hacker, Hipster, dan Hustler. Gratis untuk siswa SMK dan mahasiswa dari sekolah atau kampus mana pun.</p>
      <OprecStatus />

      <section aria-labelledby="catalyst-roles">
        <h2 id="catalyst-roles">Satu track, tiga peran</h2>
        <ul className="league-categories catalyst-roles">{catalyst.roles.map((role) => <li key={role.name}>
          <PixelIcon name={roleIcons[role.name]} size={32} />
          <span>{role.name}</span>
          <small>{role.focus}</small>
          <p>{role.text}</p>
        </li>)}</ul>
      </section>

      <section aria-labelledby="catalyst-flow">
        <h2 id="catalyst-flow">Alur program</h2>
        <ul className="catalyst-points">
          <li>Di sesi pertama, Hustler mem-pitch ide, lalu Hacker dan Hipster memilih tim yang ingin diikuti.</li>
          <li>Sembilan sesi daring setiap hari Minggu: lima sesi materi, lalu checkpoint capstone.</li>
          <li>Setiap sesi memberi tugas yang ditinjau mentor peranmu di sesi berikutnya.</li>
          <li>Program ditutup dengan showcase dan awarding capstone.</li>
        </ul>
      </section>

      <section aria-labelledby="catalyst-who">
        <h2 id="catalyst-who">Siapa yang bisa ikut</h2>
        <ul className="catalyst-points">
          <li>Siswa SMK dan mahasiswa, dari sekolah atau kampus mana pun.</li>
          <li>Gratis, tanpa biaya pendaftaran.</li>
          <li>Berkomitmen hadir minimal {catalyst.attendance} sesi.</li>
        </ul>
      </section>

      <section aria-labelledby="catalyst-timeline">
        <h2 id="catalyst-timeline">Jadwal</h2>
        <ol className="league-timeline">{catalyst.timeline.map((step) => <li key={step.label}><time dateTime={step.start}>{rangeLabel(step.start, "end" in step ? step.end : undefined)}</time><span>{step.label}</span></li>)}</ol>
        <p className="league-note">Jadwal dapat berubah. Perubahan diumumkan di Instagram GDGoC IPB dan di halaman ini.</p>
      </section>

      <section aria-labelledby="catalyst-faq">
        <h2 id="catalyst-faq">Pertanyaan umum</h2>
        <Faq items={faq} className="league-faq" />
      </section>
    </main>
  </>;
}
