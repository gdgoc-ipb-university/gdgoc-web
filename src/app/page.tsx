import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { DinoPlayground } from "@/components/dino-playground";
import { Reveal } from "@/components/reveal";
import { Arrow, PixelSpark } from "@/components/icons";
import { directions } from "@/lib/directions";
import { JoinFooter } from "@/components/join-footer";
import { communityLinks } from "@/lib/community";

const paths = [
  {
    n: "01",
    color: "blue",
    title: "GDGoC Catalyst",
    label: "BELAJAR & BANGUN PRODUK",
    text: "Belajar membangun produk lewat tiga peran: Hustler untuk pengelolaan proyek, Hipster untuk desain UI/UX, dan Hacker untuk pengembangan teknologi. Kolaborasi dalam tim, lalu kerjakan capstone dengan pendampingan",
    cta: "Pantau info Catalyst",
    glyph: "</>",
  },
  {
    n: "02",
    color: "green",
    title: "Tech League",
    label: "UJI KARYA DI KOMPETISI",
    text: "Kompetisi nasional untuk mengadu karya di tiga kategori: Software Development, UI/UX Design, dan Business Plan. Siapkan karya terbaik bersama timmu",
    cta: "Pantau info Tech League",
    glyph: "{ }",
  },
  {
    n: "03",
    color: "red",
    title: "Tech Support",
    label: "CARI MASUKAN DARI MENTOR",
    text: "Butuh masukan untuk lomba, pitch deck, atau proyekmu? Ceritakan kebutuhanmu agar kami bisa mencarikan mentor yang sesuai",
    cta: "Tanya alur mentoring",
    glyph: "+ +",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ world?: string }>;
}) {
  const { world } = await searchParams;
  const direction = directions.find((d) => d.id === world) ?? directions[0];
  return (
    <>
      <a className="skip-link" href="#community">
        Lewati ke konten
      </a>
      <Header />
      <main>
        <Hero key={direction.id} direction={direction} />
        <div className="community-strip" aria-label="Nilai komunitas">
          <span>CODING</span>
          <PixelSpark />
          <span>UI/UX</span>
          <PixelSpark />
          <span>DATA & AI</span>
          <PixelSpark />
          <span>PROJECT</span>
          <PixelSpark />
          <span>KOMPETISI</span>
        </div>
        <section
          id="community"
          className="community-section section-width"
          aria-labelledby="community-heading"
        >
          <Reveal className="community-copy">
            <p className="eyebrow">
              <span className="section-number">01 /</span> TENTANG GDGOC IPB
            </p>
            <h2 id="community-heading">
              Kenalan dengan
              <br />
              <em>GDGoC IPB</em>
            </h2>
            <p>
              Google Developer Group on Campus IPB University adalah komunitas untuk mahasiswa
              yang ingin belajar dan berkarya di bidang teknologi, apa pun jurusannya
            </p>
            <p>
              Kamu bisa mulai lewat Study Jam, mengerjakan produk digital bersama tim,
              atau mencari masukan mentor untuk persiapan lomba. Ada ruang untuk yang suka
              ngoding, mendesain, maupun mengelola proyek
            </p>
            <a className="text-link" href="#explore">
              Temukan program yang cocok <Arrow diagonal />
            </a>
          </Reveal>
          <DinoPlayground />
        </section>
        <section id="explore" className="explore-section" aria-labelledby="explore-heading">
          <div className="section-width">
            <Reveal className="section-top">
              <div>
                <p className="eyebrow">
                  <span className="section-number">02 /</span> PROGRAM 2026/2027
                </p>
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
                    href={communityLinks.instagram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="path-top">
                      <span>{path.n}</span>
                      <span className="path-glyph" aria-hidden="true">
                        {path.glyph}
                      </span>
                      <Arrow diagonal />
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
          </div>
        </section>
      </main>
      <JoinFooter />
    </>
  );
}
