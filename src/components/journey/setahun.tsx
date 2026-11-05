import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { catalyst } from "@/lib/catalyst";
import { techLeague } from "@/lib/tech-league";
import { Chapter, ChapterTitle } from "./chapter";
import { YearTimeline, type Track } from "./year-timeline";

/** The dates come from the program modules, so the landing follows their pages. */
const tracks: Track[] = [
  { name: "GDGoC Catalyst", href: catalyst.path, color: "blue", milestones: catalyst.timeline },
  { name: "Tech League", href: techLeague.path, color: "green", milestones: techLeague.timeline },
];

/** Chapter 4: the 2026/27 year of Catalyst and Tech League on one timeline. */
export function SetahunBersama() {
  return (
    <Chapter id="setahun" number="04" label="Setahun bersama" side="left" className="chapter-setahun">
      <div className="setahun-head">
        <Reveal className="chapter-head">
          <ChapterTitle id="setahun" lead="Setahun bersama" accent="GDGoC IPB" />
          <p className="chapter-lead">
            Jadwal Catalyst dan Tech League 2026/2027, dari pendaftaran sampai final dan showcase. Detail tiap
            tahap ada di halaman programnya
          </p>
        </Reveal>
        <Image
          className="setahun-art"
          src="/landing/kalender-hitung-mundur.svg"
          alt=""
          width={960}
          height={768}
          unoptimized
        />
      </div>
      <YearTimeline tracks={tracks} />
    </Chapter>
  );
}
