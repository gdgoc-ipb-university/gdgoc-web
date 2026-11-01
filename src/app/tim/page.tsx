import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JoinFooter } from "@/components/join-footer";
import { JsonLd } from "@/components/json-ld";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { canonical } from "@/lib/site";
import { leaderInitial, team, teamJsonLd } from "@/lib/team";

export const metadata: Metadata = {
  title: `Tim ${team.year}`,
  description: team.description,
  ...canonical(team.path),
};

const divisionIcons: Record<(typeof team.divisions)[number]["name"], PixelIconName> = {
  "Program & Development": "teach",
  "Community & External": "megaphone",
  "Media & Creative": "brush",
  Technical: "code",
  "Secretary-Treasurer": "notebook",
};

export default function TeamPage() {
  return <>
    <JsonLd data={teamJsonLd()} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Tim", path: team.path }])} />
    <Header />
    <main id="main" className="league-page about-page section-width">
      <p className="eyebrow">GDGOC IPB · TIM {team.year}</p>
      <h1>Tim GDGoC IPB.</h1>
      <p className="league-lead">GDGoC IPB {team.year} dipimpin seorang Lead dan Co-Lead, dengan lima divisi yang menjalankan program dan menjaga komunitas sepanjang tahun.</p>

      <section aria-labelledby="team-leads">
        <h2 id="team-leads">Lead dan Co-Lead</h2>
        <ul className="team-leaders">{team.leaders.map((leader) => <li key={leader.key}>
          {leader.photo
            ? <Image className="team-avatar" src={leader.photo} alt="" width={88} height={88} />
            : <span className="team-avatar" aria-hidden="true">{leaderInitial(leader)}</span>}
          <span>
            {leader.name && <strong>{leader.name}</strong>}
            <small>{leader.role}</small>
            {leader.links && <span className="team-links">{leader.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} <Arrow external /></a>)}</span>}
          </span>
        </li>)}</ul>
      </section>

      <section aria-labelledby="team-divisions">
        <h2 id="team-divisions">Divisi</h2>
        <ul className="league-categories about-missions team-divisions">{team.divisions.map((division) => <li key={division.name}>
          <PixelIcon name={divisionIcons[division.name]} size={32} />
          <span>{division.name}</span>
          <p>{division.purpose}</p>
        </li>)}</ul>
      </section>

      <section aria-labelledby="team-next">
        <h2 id="team-next">Ikut menjalankan komunitas</h2>
        <p>Pengurus dipilih lewat open recruitment Core Team di awal tahun kepengurusan. Sebelum itu, kamu bisa mulai sebagai member dan ikut kegiatannya.</p>
        <div className="league-actions">
          <Link className="button button-blue" href="/bergabung">Cara bergabung <Arrow /></Link>
          <Link className="button button-quiet" href="/tentang">Tentang GDGoC IPB <Arrow /></Link>
        </div>
      </section>
    </main>
    <JoinFooter />
  </>;
}
