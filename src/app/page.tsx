import Link from "next/link";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { DinoPlayground } from "@/components/dino-playground";
import { Reveal } from "@/components/reveal";
import { Arrow, PixelSpark } from "@/components/icons";
import { directions } from "@/lib/directions";

const paths = [
  {
    n: "01",
    color: "blue",
    title: "Learn together.",
    label: "START WITH CURIOSITY",
    text: "Bawa pertanyaanmu. Temukan perspektif baru lewat diskusi, study jam, dan eksplorasi teknologi bersama.",
    glyph: "</>",
  },
  {
    n: "02",
    color: "green",
    title: "Build something.",
    label: "TURN IDEAS INTO THINGS",
    text: "Dari satu baris kode sampai prototipe pertama. Beri ide kecilmu ruang untuk dicoba dan dikembangkan.",
    glyph: "{ }",
  },
  {
    n: "03",
    color: "red",
    title: "Find your people.",
    label: "GROW WITH GOOD COMPANY",
    text: "Kenalan dengan teman yang sama penasarannya. Saling berbagi, saling mendukung, dan tumbuh bareng.",
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
        <Hero direction={direction} />
        <div className="community-strip" aria-label="Nilai komunitas">
          <span>LEARN</span>
          <PixelSpark />
          <span>BUILD</span>
          <PixelSpark />
          <span>CONNECT</span>
          <PixelSpark />
          <span>GROW</span>
          <PixelSpark />
          <span>TOGETHER</span>
        </div>
        <section
          id="community"
          className="community-section section-width"
          aria-labelledby="community-heading"
        >
          <Reveal className="community-copy">
            <p className="eyebrow">
              <span className="section-number">01 /</span> A PLACE TO BELONG
            </p>
            <h2 id="community-heading">
              You don’t have to
              <br />
              figure it out <em>alone.</em>
            </h2>
            <p>
              Kita adalah Google Developer Group on Campus IPB University. Tempat rasa ingin tahu
              bertemu dengan orang-orang yang ingin belajar, berkarya, dan berbagi.
            </p>
            <p>
              Belum jago coding? Lagi mencari minat? Atau sudah punya ide yang ingin diwujudkan?
              Mulai dari tempatmu sekarang.
            </p>
            <a className="text-link" href="#explore">
              There’s a place for you here <Arrow diagonal />
            </a>
          </Reveal>
          <DinoPlayground />
        </section>
        <section id="explore" className="explore-section" aria-labelledby="explore-heading">
          <div className="section-width">
            <Reveal className="section-top">
              <div>
                <p className="eyebrow">
                  <span className="section-number">02 /</span> CHOOSE YOUR NEXT STEP
                </p>
                <h2 id="explore-heading">
                  Different interests.
                  <br />
                  <span className="pixel-accent">Shared possibilities.</span>
                </h2>
              </div>
              <p>
                Nggak perlu tahu semua jawabannya.
                <br />
                Cukup mulai dengan rasa penasaran.
              </p>
            </Reveal>
            <div className="path-grid">
              {paths.map((path) => (
                <Reveal key={path.n}>
                  <a className={`path-card path-${path.color}`} href="#join">
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
                      Let’s explore <Arrow />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section id="join" className="join-section section-width" aria-labelledby="join-heading">
          <Reveal>
            <p className="eyebrow">
              <span className="status-dot" /> YOUR NEXT CHAPTER
            </p>
            <h2 id="join-heading">
              Big things start
              <br />
              with a small <span>hello.</span>
              <PixelSpark />
            </h2>
            <p>
              Temukan cerita, kegiatan, dan kabar terbaru komunitas.
              <br />
              Sampai ketemu di petualangan berikutnya.
            </p>
            <a
              className="button button-blue"
              href="https://www.instagram.com/gdgoc.ipb/"
              target="_blank"
              rel="noreferrer"
            >
              Say hello to GDGoC IPB <Arrow diagonal />
            </a>
            <span className="join-handle">@gdgoc.ipb</span>
          </Reveal>
        </section>
      </main>
      <footer className="footer">
        <p>
          Google Developer Group on Campus
          <br />
          <strong>IPB University</strong>
        </p>
        <span>MADE OF PEOPLE & POSSIBILITIES.</span>
        <Link href="/directions">
          Explore the visual worlds <Arrow diagonal />
        </Link>
      </footer>
    </>
  );
}
