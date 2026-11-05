import Link from "next/link";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { Reveal } from "@/components/reveal";
import { Arrow } from "@/components/icons";
import { JoinFooter } from "@/components/join-footer";
import { Chapter } from "@/components/journey/chapter";
import { Kenalan, StartLine } from "@/components/journey/kenalan";
import "@/components/journey/journey.css";
import { catalyst } from "@/lib/catalyst";
import { communityLinks } from "@/lib/community";
import { techLeague } from "@/lib/tech-league";
import { techSupport } from "@/lib/tech-support";

const paths = [
  {
    n: "01",
    color: "blue",
    title: "GDGoC Catalyst",
    label: "BELAJAR & BANGUN PRODUK",
    text: "Belajar membangun produk lewat tiga peran: Hustler untuk pengelolaan proyek, Hipster untuk desain UI/UX, dan Hacker untuk pengembangan teknologi. Kolaborasi dalam tim, lalu kerjakan capstone dengan pendampingan",
    cta: "Lihat jadwal Catalyst",
    icon: "code" as PixelIconName,
    href: catalyst.path,
  },
  {
    n: "02",
    color: "green",
    title: "Tech League",
    label: "UJI KARYA DI KOMPETISI",
    text: "Kompetisi nasional untuk mengadu karya di tiga kategori: Software Development, UI/UX Design, dan Business Plan. Siapkan karya terbaik bersama timmu",
    cta: "Lihat jadwal Tech League",
    icon: "trophy" as PixelIconName,
    href: techLeague.path,
  },
  {
    n: "03",
    color: "red",
    title: "Tech Support",
    label: "CARI MASUKAN DARI MENTOR",
    text: "Butuh masukan untuk lomba, pitch deck, atau proyekmu? Ceritakan kebutuhanmu agar kami bisa mencarikan mentor yang sesuai",
    cta: "Lihat alur mentoring",
    icon: "message-text" as PixelIconName,
    href: techSupport.path,
  },
];

/** The landing page. */
export function Landing() {
  return (
    <>
      <a className="skip-link" href="#community">
        Lewati ke konten
      </a>
      <Header />
      <main>
        <Hero />
        <div className="journey">
          <StartLine />
          <Kenalan />
          <Chapter id="explore" number="03" label="Pilih jalurmu" side="left" className="chapter-programs">
            <Reveal className="section-top">
              <div>
                <h2 id="explore-heading">
                  Mau belajar, bikin,
                  <br />
                  <span className="pixel-accent">atau ikut kompetisi?</span>
                </h2>
              </div>
              <p>
                Kenali tiga program kami. Jadwal dan info pendaftaran diumumkan
                lewat kanal resmi GDGoC IPB
              </p>
            </Reveal>
            <div className="path-grid">
              {paths.map((path) => (
                <Reveal key={path.n}>
                  <a
                    className={`path-card path-${path.color}`}
                    href={path.href ?? communityLinks.instagram}
                    {...(path.href ? {} : { target: "_blank", rel: "noreferrer" })}
                  >
                    <div className="path-top">
                      <span>{path.n}</span>
                      <span className="path-glyph" aria-hidden="true">
                        <PixelIcon name={path.icon} size={48} />
                      </span>
                      {path.href ? <Arrow /> : <Arrow external />}
                    </div>
                    <p className="eyebrow">{path.label}</p>
                    <h3>{path.title}</h3>
                    <p>{path.text}</p>
                    <span className="path-link">
                      {path.cta} <Arrow />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
            <Reveal className="path-all">
              <Link className="text-link" href="/program">
                Lihat semua program <Arrow />
              </Link>
            </Reveal>
          </Chapter>
        </div>
      </main>
      <JoinFooter />
    </>
  );
}
