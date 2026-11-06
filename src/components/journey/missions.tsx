import Image from "next/image";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icons";
import { Reveal } from "@/components/reveal";
import { about } from "@/lib/about";
import { Chapter, ChapterTitle } from "./chapter";

type MissionName = (typeof about.missions)[number]["name"];

/** Each mission's icon, accent and scene from the Figma pixel scenes (960 x 768, in `public/landing/`). */
const missionArt: Record<MissionName, { icon: PixelIconName; color: "blue" | "green" | "red"; src: string; alt: string }> = {
  "Structured Learning": {
    icon: "code",
    color: "blue",
    src: "/landing/meja-ngoding.svg",
    alt: "Meja belajar dengan laptop yang menampilkan kode, catatan yang ditempel, dan secangkir minuman",
  },
  "Applied Growth": {
    icon: "trophy",
    color: "green",
    src: "/landing/podium-pencapaian.svg",
    alt: "Dua member bersorak di samping piala emas di atas podium juara satu, dihujani konfeti",
  },
  "Connected Ecosystem": {
    icon: "users",
    color: "red",
    src: "/landing/jembatan-kolaborasi.svg",
    alt: "Dua member dari dua sisi menyambung jembatan di tengah, saling berbagi catatan",
  },
};

const missions = about.missions.map((mission, index) => ({ ...mission, ...missionArt[mission.name], number: `0${index + 1}` }));

/**
 * Chapter 2: the three missions as scrollytelling. On a wide screen without reduced motion the steps scroll beside a
 * sticky panel; `Journey` marks the step crossing the middle of the screen as `data-active` (and the one before as
 * `data-prev`), and the panel swaps scenes with a stepped dither. Anywhere else each step shows its own scene inline.
 * The panel repeats what the steps say, so it is hidden from assistive tech; each step's own image carries the alt
 * text (visually hidden while the panel shows it).
 */
export function TigaMisi() {
  return (
    <Chapter id="misi" number="02" label="Tiga misi" side="left" className="chapter-misi">
      <Reveal className="chapter-head">
        <ChapterTitle id="misi" lead="Tiga misi," accent="satu perjalanan" />
        <p className="chapter-lead">Arah GDGoC IPB sepanjang 2026/2027, dari belajar sampai berkolaborasi</p>
      </Reveal>
      <div className="story" data-story data-active="0">
        <ol className="story-steps">
          {missions.map((mission, index) => (
            <li key={mission.name} className="story-step" data-step={index} data-color={mission.color}>
              <div className="story-copy">
                <span className="story-icon" aria-hidden="true">
                  <PixelIcon name={mission.icon} size={32} />
                </span>
                <p className="eyebrow">Misi {mission.number}</p>
                <h3>{mission.name}</h3>
                <p>{mission.text}</p>
              </div>
              <figure className="story-inline">
                <Image src={mission.src} alt={mission.alt} width={960} height={768} unoptimized />
              </figure>
            </li>
          ))}
        </ol>
        <div className="story-panel" aria-hidden="true">
          <div className="story-frame">
            <div className="story-bar">
              {missions.map((mission, index) => (
                <span key={mission.name} className="story-tag" data-step={index} data-color={mission.color}>
                  <span className="story-tag-icon">
                    <PixelIcon name={mission.icon} size={24} />
                  </span>
                  <span>
                    Misi {mission.number} / 0{missions.length} · {mission.name}
                  </span>
                </span>
              ))}
            </div>
            <div className="story-scenes">
              {missions.map((mission, index) => (
                <Image
                  key={mission.name}
                  className="story-scene"
                  data-step={index}
                  src={mission.src}
                  alt=""
                  width={960}
                  height={768}
                  unoptimized
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
