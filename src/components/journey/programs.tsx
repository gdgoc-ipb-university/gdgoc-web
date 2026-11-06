import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/icons";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { Reveal } from "@/components/reveal";
import { catalyst } from "@/lib/catalyst";
import { techLeague } from "@/lib/tech-league";
import { techSupport } from "@/lib/tech-support";
import { Chapter, ChapterTitle } from "./chapter";

const programs: {
  level: string;
  color: "blue" | "green" | "red";
  title: string;
  label: string;
  text: string;
  cta: string;
  icon: PixelIconName;
  href: string;
  scene: string;
}[] = [
  {
    level: "01",
    color: "blue",
    title: "GDGoC Catalyst",
    label: "BELAJAR & BANGUN PRODUK",
    text: "Belajar membangun produk lewat tiga peran: Hustler untuk pengelolaan proyek, Hipster untuk desain UI/UX, dan Hacker untuk pengembangan teknologi. Kolaborasi dalam tim, lalu kerjakan capstone dengan pendampingan",
    cta: "Lihat jadwal Catalyst",
    icon: "code",
    href: catalyst.path,
    scene: "/landing/meja-proyek-tim.svg",
  },
  {
    level: "02",
    color: "green",
    title: "Tech League",
    label: "UJI KARYA DI KOMPETISI",
    text: "Kompetisi nasional untuk mengadu karya di tiga kategori: Software Development, UI/UX Design, dan Business Plan. Siapkan karya terbaik bersama timmu",
    cta: "Lihat jadwal Tech League",
    icon: "trophy",
    href: techLeague.path,
    scene: "/landing/arena-kompetisi.svg",
  },
  {
    level: "03",
    color: "red",
    title: "Tech Support",
    label: "CARI MASUKAN DARI MENTOR",
    text: "Butuh masukan untuk lomba, pitch deck, atau proyekmu? Ceritakan kebutuhanmu agar kami bisa mencarikan mentor yang sesuai",
    cta: "Lihat alur mentoring",
    icon: "message-text",
    href: techSupport.path,
    scene: "/landing/sesi-review-mentor.svg",
  },
];

/**
 * Chapter 3: the three programs as level-select cards. On a wide screen without reduced motion, `Journey` watches
 * three invisible bands stacked over the cards and writes the one crossing the middle of the screen to
 * `data-selected`, so a "pilih" cursor steps from card to card as the chapter scrolls by.
 */
export function PilihJalurmu() {
  return (
    <Chapter id="explore" number="03" label="Pilih jalurmu" side="right" className="chapter-programs">
      <Reveal className="chapter-head chapter-head-split">
        <ChapterTitle id="explore" lead="Mau belajar, bikin," accent="atau ikut kompetisi?" />
        <p className="chapter-lead">
          Kenali tiga program kami. Jadwal dan info pendaftaran diumumkan lewat kanal resmi GDGoC IPB
        </p>
      </Reveal>
      <div className="levels" data-levels>
        <div className="level-bands" aria-hidden="true">
          {programs.map((program) => (
            <span key={program.level} className="level-band" />
          ))}
        </div>
        {programs.map((program, index) => (
          <a key={program.level} className="level" href={program.href} data-level={index} data-color={program.color}>
            <span className="level-cursor" aria-hidden="true">
              <PixelIcon name="arrow-down" size={16} /> Pilih
            </span>
            <span className="level-top">
              <span className="level-number">Level {program.level}</span>
              <span className="level-glyph" aria-hidden="true">
                <PixelIcon name={program.icon} size={28} />
              </span>
            </span>
            <span className="level-scene">
              <Image src={program.scene} alt="" width={960} height={768} unoptimized />
            </span>
            <div className="level-body">
              <p className="eyebrow">{program.label}</p>
              <h3>{program.title}</h3>
              <p className="level-text">{program.text}</p>
              <span className="level-link">
                {program.cta} <Arrow />
              </span>
            </div>
          </a>
        ))}
      </div>
      <Reveal className="chapter-more">
        <Link className="text-link" href="/program">
          Lihat semua program <Arrow />
        </Link>
      </Reveal>
    </Chapter>
  );
}
