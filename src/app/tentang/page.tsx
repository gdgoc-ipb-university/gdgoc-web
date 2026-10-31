import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JoinFooter } from "@/components/join-footer";
import { JsonLd } from "@/components/json-ld";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { about, aboutPageJsonLd } from "@/lib/about";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { communityLinks } from "@/lib/community";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tentang kami",
  description: about.description,
  ...canonical(about.path),
};

const missionIcons: Record<(typeof about.missions)[number]["name"], PixelIconName> = {
  "Structured Learning": "notebook",
  "Applied Growth": "trophy",
  "Connected Ecosystem": "users",
};

export default function AboutPage() {
  return <>
    <JsonLd data={aboutPageJsonLd()} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Tentang", path: about.path }])} />
    <Header />
    <main id="main" className="league-page about-page section-width">
      <p className="eyebrow">GDGOC IPB · TENTANG KAMI</p>
      <h1>Tentang GDGoC IPB.</h1>
      <p className="league-lead">Google Developer Group on Campus IPB University adalah komunitas mahasiswa Bogor untuk belajar dan berkarya di bidang teknologi, apa pun kampus dan jurusannya.</p>

      <section aria-labelledby="about-vision">
        <h2 id="about-vision">Visi</h2>
        <p className="about-vision">{about.vision}</p>
      </section>

      <section aria-labelledby="about-missions">
        <h2 id="about-missions">Misi</h2>
        <ul className="league-categories about-missions">{about.missions.map((mission) => <li key={mission.name}>
          <PixelIcon name={missionIcons[mission.name]} size={32} />
          <span>{mission.name}</span>
          <p>{mission.text}</p>
        </li>)}</ul>
      </section>

      <section aria-labelledby="about-audience">
        <h2 id="about-audience">Untuk siapa</h2>
        <p>Untuk mahasiswa yang tinggal di Bogor, dari kampus dan jurusan mana pun, tidak hanya IPB. Ada ruang untuk yang suka ngoding, mendesain, maupun mengelola proyek.</p>
      </section>

      <section aria-labelledby="about-history">
        <h2 id="about-history">Dari GDSC IPB ke GDGoC IPB</h2>
        <p>Komunitas ini sebelumnya bernama GDSC IPB (Google Developer Student Clubs). Kini GDGoC IPB menjadi bagian dari Google Developer Groups on Campus, jaringan komunitas developer di kampus yang didukung Google.</p>
        <p>Halaman resmi chapter ada di <a href={communityLinks.membership} target="_blank" rel="noreferrer">Google Developer Groups <Arrow external /></a>. Di sana kamu bisa bergabung sebagai member dan melihat acara chapter.</p>
      </section>

      <section aria-labelledby="about-next">
        <h2 id="about-next">Mulai dari sini</h2>
        <div className="league-actions">
          <Link className="button button-blue" href="/program">Lihat program <Arrow /></Link>
          <Link className="button button-quiet" href="/bergabung">Cara bergabung <Arrow /></Link>
          <a className="text-button" href={communityLinks.instagram} target="_blank" rel="noreferrer">Instagram @gdgoc.ipb <Arrow external /></a>
        </div>
      </section>
    </main>
    <JoinFooter />
  </>;
}
