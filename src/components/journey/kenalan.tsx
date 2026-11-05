import Link from "next/link";
import { Fragment } from "react";
import { DinoPlayground } from "@/components/dino-playground";
import { Arrow, PixelSpark } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { about } from "@/lib/about";
import { Chapter, ChapterTitle } from "./chapter";

const keywords = ["CODING", "UI/UX", "DATA & AI", "PROJECT", "KOMPETISI"];

/** Where the road starts: the keyword strip, drawn as a starting line under the hero. */
export function StartLine() {
  return (
    <div className="start-line">
      <div className="community-strip" aria-label="Nilai komunitas">
        {keywords.map((keyword, index) => (
          <Fragment key={keyword}>
            {index > 0 && <PixelSpark />}
            <span>{keyword}</span>
          </Fragment>
        ))}
      </div>
      <div className="start-flag" aria-hidden="true">
        <span>START</span>
      </div>
    </div>
  );
}

/** Chapter 1: who GDGoC IPB is and its vision, beside the dino panel. */
export function Kenalan() {
  return (
    <Chapter id="community" number="01" label="Kenalan" side="right" className="chapter-kenalan">
      <div className="kenalan">
        <Reveal className="kenalan-copy">
          <ChapterTitle id="community" lead="Kenalan dengan" accent="GDGoC IPB" />
          <p className="chapter-lead">
            Google Developer Group on Campus IPB University adalah komunitas mahasiswa Bogor
            untuk belajar dan berkarya di bidang teknologi, apa pun kampus dan jurusannya
          </p>
          <figure className="vision">
            <figcaption className="eyebrow">Visi 2026/2027</figcaption>
            <blockquote>
              <p>{about.vision}</p>
            </blockquote>
          </figure>
          <div className="chapter-links">
            <a className="text-link" href="#explore">
              Temukan program yang cocok <Arrow down />
            </a>
            <Link className="text-link" href={about.path}>
              Visi dan misi lengkap <Arrow />
            </Link>
          </div>
        </Reveal>
        <DinoPlayground />
      </div>
    </Chapter>
  );
}
