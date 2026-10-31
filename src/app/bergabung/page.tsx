import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JoinFooter } from "@/components/join-footer";
import { JsonLd } from "@/components/json-ld";
import { PixelIcon } from "@/components/pixel-icons";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { catalyst, currentOprecState } from "@/lib/catalyst";
import { communityLinks } from "@/lib/community";
import { faqJsonLd, type FaqItem } from "@/lib/faq";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import { canonical } from "@/lib/site";
import { currentRegistrationState, techLeague } from "@/lib/tech-league";

const path = "/bergabung";

export const metadata: Metadata = {
  title: "Cara bergabung",
  description:
    "Cara bergabung dengan GDGoC IPB: jadi member lewat Google Developer Groups dan grup WhatsApp, ikut bootcamp GDGoC Catalyst, atau berkompetisi di Tech League.",
  ...canonical(path),
};

// The Catalyst and Tech League lines depend on the date, so the page is rebuilt at most hourly instead of once at deploy.
export const revalidate = 3600;

const faq: FaqItem[] = [
  { question: "Apakah harus mahasiswa IPB?", answer: ["Tidak. GDGoC IPB terbuka untuk mahasiswa yang tinggal di Bogor, dari kampus dan jurusan mana pun."] },
  { question: "Apakah ada biaya untuk bergabung?", answer: ["Tidak. Bergabung sebagai member lewat Google Developer Groups dan grup WhatsApp tidak dipungut biaya. GDGoC Catalyst juga gratis."] },
  { question: "Apa bedanya member dan peserta Catalyst?", answer: ["Member mengikuti kabar dan kegiatan komunitas. Peserta Catalyst mendaftar lewat oprec, lalu mengikuti sembilan sesi bootcamp dan mengerjakan capstone dalam tim."] },
  { question: "Bagaimana kalau saya terlewat pendaftaran Catalyst?", answer: ["Kamu tetap bisa bergabung sebagai member dan ikut Study Jam serta kegiatan komunitas lainnya. Program berikutnya diumumkan di ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
  { question: "Saya punya pertanyaan lain.", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: communityLinks.instagram }, "."] },
];

function catalystLine() {
  const { opensAt, closesAt } = catalyst.oprec;
  return {
    upcoming: `Pendaftaran dibuka ${rangeLabel(opensAt, closesAt)}.`,
    open: `Pendaftaran dibuka sampai ${dayLabel(closesAt)}.`,
    closed: `Pendaftaran sudah ditutup. Peserta diumumkan ${dayLabel(catalyst.announcedAt)}.`,
    announced: "Pendaftaran Catalyst 2026/27 sudah ditutup.",
  }[currentOprecState()];
}

function techLeagueLine() {
  const { opensAt, closesAt } = techLeague.registration;
  return {
    upcoming: `Pendaftaran tim dibuka ${rangeLabel(opensAt, closesAt)}.`,
    open: `Pendaftaran tim dibuka sampai ${dayLabel(closesAt)}.`,
    closed: "Pendaftaran tim 2026/27 sudah ditutup.",
  }[currentRegistrationState()];
}

export default function JoinPage() {
  return <>
    <JsonLd data={faqJsonLd(faq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Bergabung", path }])} />
    <Header />
    <main id="main" className="league-page join-page section-width">
      <p className="eyebrow">GDGOC IPB · BERGABUNG</p>
      <h1>Gabung GDGoC IPB.</h1>
      <p className="league-lead">Terbuka untuk mahasiswa yang tinggal di Bogor, dari kampus dan jurusan mana pun. Pilih cara yang paling cocok untukmu.</p>

      <section aria-labelledby="join-now">
        <h2 id="join-now">Gabung sekarang</h2>
        <ul className="program-grid join-ways">
          <li><div>
            <PixelIcon name="users" size={32} />
            <h3>Member Google Developer Groups</h3>
            <p>Daftar di halaman resmi chapter untuk mendapat kabar acara GDGoC IPB.</p>
            <a className="button button-blue" href={communityLinks.membership} target="_blank" rel="noreferrer">Gabung member <Arrow external /></a>
          </div></li>
          <li><div>
            <PixelIcon name="whatsapp" size={32} />
            <h3>Grup WhatsApp komunitas</h3>
            <p>Kabar kegiatan dan obrolan komunitas dalam satu tempat.</p>
            <a className="button button-quiet" href={communityLinks.whatsapp} target="_blank" rel="noreferrer">Gabung grup WhatsApp <Arrow external /></a>
          </div></li>
        </ul>
      </section>

      <section aria-labelledby="join-paths">
        <h2 id="join-paths">Ikut program</h2>
        <ul className="program-grid join-ways">
          <li><Link href={catalyst.path}>
            <h3>Belajar terstruktur: GDGoC Catalyst</h3>
            <p>Bootcamp {catalyst.track} gratis dengan peran Hacker, Hipster, dan Hustler, untuk siswa SMK dan mahasiswa.</p>
            <p className="program-schedule">{catalystLine()}</p>
            <span className="text-link">Lihat Catalyst <Arrow /></span>
          </Link></li>
          <li><Link href={techLeague.path}>
            <h3>Berkompetisi: Tech League</h3>
            <p>Kompetisi nasional untuk tim di kategori Software Development, UI/UX Design, dan Business Plan.</p>
            <p className="program-schedule">{techLeagueLine()}</p>
            <span className="text-link">Lihat Tech League <Arrow /></span>
          </Link></li>
        </ul>
        <p className="program-updates">Program lain seperti Study Jam ada di <Link href="/program">halaman program</Link>.</p>
      </section>

      <section aria-labelledby="join-who">
        <h2 id="join-who">Siapa yang bisa bergabung</h2>
        <p className="join-who">Mahasiswa yang tinggal di Bogor, dari kampus dan jurusan mana pun, tidak hanya IPB. GDGoC Catalyst juga menerima siswa SMK, dan Tech League terbuka untuk tim dari seluruh Indonesia.</p>
      </section>

      <section aria-labelledby="join-faq">
        <h2 id="join-faq">Pertanyaan umum</h2>
        <Faq items={faq} className="league-faq" />
      </section>
    </main>
    <JoinFooter />
  </>;
}
