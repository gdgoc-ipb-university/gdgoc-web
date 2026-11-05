import Image from "next/image";
import { Fragment } from "react";
import { Arrow } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { Chapter, ChapterTitle } from "./chapter";

/**
 * The landmarks along the skyline, in the order they stand, with their art's native pixel size. The places come from
 * the GDGOC 26/27 Figma file (exported into `public/landing/`); Tugu Kujang and Gedung AHN are the member pass's art.
 */
const landmarks = [
  { name: "Gerbang IPB Dramaga", src: "/landing/gerbang-ipb-dramaga.svg", width: 123, height: 88 },
  { name: "Tugu Kujang", src: "/cards/tugu-kujang.svg", width: 69, height: 119 },
  { name: "Lawang Salapan", src: "/landing/lawang-salapan.svg", width: 119, height: 87 },
  { name: "Istana Bogor", src: "/landing/istana-bogor.svg", width: 119, height: 108 },
  { name: "Stasiun Bogor", src: "/landing/stasiun-bogor.svg", width: 116, height: 86 },
  { name: "Graha Widya Wisuda", src: "/landing/graha-widya-wisuda.svg", width: 119, height: 118 },
  { name: "Gedung AHN", src: "/cards/gedung-ahn.svg", width: 123, height: 106 },
] as const;

/** Trees stand after these landmarks; clouds float at these spots (percent of the skyline's width, and px from the top). */
const treesAfter = new Set([0, 2, 4, 5]);
const clouds = [
  { left: 4, top: 10, scale: 7 },
  { left: 30, top: 44, scale: 5 },
  { left: 55, top: 4, scale: 8 },
  { left: 82, top: 38, scale: 6 },
];

function Tree() {
  return <Image className="skyline-tree" src="/cards/tree.svg" alt="" width={30} height={36} unoptimized style={{ "--w": 26 } as React.CSSProperties} />;
}

/** Chapter 5: the skyline from campus to the city, then the band that hands off to the footer. */
export function DariIpbUntukBogor() {
  return (
    <Chapter id="bogor" number="05" label="Dari IPB untuk Bogor" side="left" className="chapter-bogor">
      <Reveal className="chapter-head">
        <ChapterTitle id="bogor" lead="Dari IPB" accent="untuk Bogor" />
        <p className="chapter-lead">
          Komunitas ini tumbuh di kampus IPB dan terbuka untuk mahasiswa dari seluruh Bogor, apa pun kampus
          dan jurusannya
        </p>
      </Reveal>
      {/* On phones the skyline scrolls sideways; Lenis leaves that scroll to the browser. */}
      <div className="skyline" role="region" aria-label="Dari kampus IPB sampai Kota Bogor" tabIndex={0} data-lenis-prevent>
        <div className="skyline-clouds" aria-hidden="true">
          {clouds.map((cloud) => (
            <Image
              key={cloud.left}
              src="/cards/cloud.svg"
              alt=""
              width={20 * cloud.scale}
              height={5 * cloud.scale}
              unoptimized
              style={{ left: `${cloud.left}%`, top: cloud.top, width: 20 * cloud.scale }}
            />
          ))}
        </div>
        <div className="skyline-row">
          {landmarks.map((place, index) => (
            <Fragment key={place.name}>
              <figure className="skyline-place" style={{ "--w": place.width } as React.CSSProperties}>
                <Image src={place.src} alt="" width={place.width} height={place.height} unoptimized />
                <figcaption>{place.name}</figcaption>
              </figure>
              {treesAfter.has(index) && <Tree />}
            </Fragment>
          ))}
        </div>
        <div className="skyline-ground" aria-hidden="true" />
      </div>
      <Reveal className="finish">
        <span className="finish-flag" aria-hidden="true" />
        <div>
          <h3>Siap mulai perjalananmu?</h3>
          <p>Belajar, bangun proyek, ikut kompetisi, dan berkolaborasi bareng komunitas teknologi IPB dan Bogor</p>
        </div>
        <a className="text-link" href="#join">
          Gabung jadi member <Arrow down />
        </a>
      </Reveal>
    </Chapter>
  );
}
