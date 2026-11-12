import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Arrow } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { JoinFooter } from "@/components/join-footer";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { communityLinks } from "@/lib/community";
import { flagshipCount, programs } from "@/lib/programs";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Program",
  description: "Program GDGoC IPB untuk belajar, membangun produk, berkompetisi, dan bertumbuh bersama komunitas teknologi Bogor.",
  ...canonical("/program"),
};

export default function ProgramPage() {
  return <>
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }])} />
    <Header />
    <main id="main" className="program-page section-width">
      <p className="eyebrow">GDGOC IPB · BELAJAR, BERKARYA, BERTUMBUH</p>
      <h1>Program kami.</h1>
      <p className="program-lead">Pilih ruang untuk belajar teknologi, membangun karya bersama, mengasah kemampuan lewat kompetisi, atau meminta masukan dari mentor.</p>

      <section aria-labelledby="flagship-programs">
        <h2 id="flagship-programs">Program utama</h2>
        <ul className="program-grid">
          {programs.slice(0, flagshipCount).map((program) => <ProgramCard key={program.title} program={program} />)}
        </ul>
      </section>

      <section aria-labelledby="regular-programs">
        <h2 id="regular-programs">Program rutin</h2>
        <ul className="program-grid">
          {programs.slice(flagshipCount).map((program) => <ProgramCard key={program.title} program={program} />)}
        </ul>
      </section>
      <p className="program-updates">Program yang belum memiliki halaman sendiri diumumkan lewat <a href={communityLinks.instagram} target="_blank" rel="noreferrer">Instagram @gdgoc.ipb <Arrow external /></a>.</p>
    </main>
    <JoinFooter />
  </>;
}

function ProgramCard({ program }: { program: (typeof programs)[number] }) {
  const content = <>
    <h3>{program.title}</h3>
    <p>{program.audience}</p>
    <p className="program-schedule">{program.schedule}</p>
    {program.href && <span className="text-link">Lihat program <Arrow /></span>}
  </>;
  return <li>{program.href ? <Link href={program.href}>{content}</Link> : <div>{content}</div>}</li>;
}
