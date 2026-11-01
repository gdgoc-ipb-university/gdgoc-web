"use client";

import localFont from "next/font/local";
import Image from "next/image";
import { useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { chapterPeriod } from "@/lib/chapter";
import { divisionAccent, photoAt } from "@/lib/member-card";
import { memberTagLabel, type MemberType } from "@/lib/onboarding";
import { qrMatrix, qrPath } from "@/lib/qr";
import { PixelIcon } from "./pixel-icons";
import "./member-card.css";

/**
 * VCR OSD Mono for the pass's titling (#135): the name, chapter, year, number and stamp. Scoped to the card. No
 * generated Arial fallback, so a glyph it lacks (Latin Extended letters, the middle dot) falls back to Pixelify Sans.
 */
const vcr = localFont({ src: "../fonts/vcr-osd-mono.woff2", variable: "--font-vcr", weight: "400", display: "swap", adjustFontFallback: false });
/** The class that defines `--font-vcr`, for the door view, and the family for the saved image. */
export const passFont = { className: vcr.variable, family: vcr.style.fontFamily };

export type CardFace = {
  name: string; photo: string | null; campus: string; studyProgram: string; number: string; period: string;
  memberType: MemberType | null; division: string | null; tagConfirmed: boolean;
};

/**
 * The pass's art in `public/cards/` (#135): the landmarks and brackets mark from the Design System page of the GDGOC
 * 26/27 Figma file, cropped to their pixels so one art pixel is one CSS pixel, and the lanyard, cloud and tree drawn to
 * match. The saved image loads the same files.
 */
export const passArt = {
  mark: { src: "/cards/gdgoc-mark.svg", width: 76.7, height: 47.7 },
  lanyard: { src: "/cards/lanyard.svg", width: 24, height: 32 },
  cloud: { src: "/cards/cloud.svg", width: 20, height: 5 },
  tree: { src: "/cards/tree.svg", width: 10, height: 12 },
  kujang: { src: "/cards/tugu-kujang.svg", width: 69, height: 119 },
  gate: { src: "/cards/gerbang-ipb-dramaga.svg", width: 123, height: 88 },
  ahn: { src: "/cards/gedung-ahn.svg", width: 123, height: 106 },
};

/** The QR as SVG, drawn here and never by an outside service: the link in it is the card. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  return <svg className={className} viewBox={`0 0 ${matrix.length} ${matrix.length}`} role="img" aria-label={label} shapeRendering="crispEdges">
    <rect width={matrix.length} height={matrix.length} fill="#fff" /><path d={qrPath(matrix)} fill="#000" />
  </svg>;
}

/** The Google profile photo, or the pixel initial when there is none or it fails to load. */
export function CardPhoto({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = photoAt(photo, size * 2);
  if (!src || failed) return <span className="account-avatar member-card-photo" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>;
  return <Image className="member-card-photo" src={src} alt={`Foto profil ${name}`} width={size} height={size} referrerPolicy="no-referrer" unoptimized onError={() => setFailed(true)} />;
}

export function periodLabel(period: string) {
  return period === chapterPeriod.year ? chapterPeriod.label : `Tahun chapter ${period}`;
}

/** One piece of the pass art at a whole multiple of its pixel size, decorative. */
export const PassArt = ({ name, className, scale = 1 }: { name: keyof typeof passArt; className: string; scale?: number }) =>
  <Image className={className} src={passArt[name].src} alt="" width={passArt[name].width * scale} height={passArt[name].height * scale} unoptimized />;

/**
 * The Bogor skyline along the bottom of the pass: Tugu Kujang, the IPB Dramaga gate and Gedung AHN on grass and road.
 * On the pass it is drawn at two CSS pixels per art pixel and rises behind the QR's plate; the door view keeps it small.
 */
export function PassTown({ large = false }: { large?: boolean }) {
  const scale = large ? 2 : 1;
  return <div className="member-pass-town" data-large={large || undefined} aria-hidden="true">
    <PassArt name="cloud" className="member-pass-cloud" scale={3} /><PassArt name="cloud" className="member-pass-cloud" scale={3} />
    <PassArt name="kujang" className="member-pass-kujang" scale={scale} /><PassArt name="ahn" className="member-pass-ahn" scale={scale} /><PassArt name="gate" className="member-pass-gate" scale={scale} />
    <PassArt name="tree" className="member-pass-tree" scale={3 + scale - 1} /><PassArt name="tree" className="member-pass-tree" scale={3 + scale - 1} /><PassArt name="tree" className="member-pass-tree" scale={2 + scale - 1} />
    <span className="member-pass-ground" />
  </div>;
}

/** A swing of a degree or so from the strap, following a mouse; the stylesheet uses it only on desktop hover without reduced motion. */
function swing(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--tx", ((event.clientX - box.left) / box.width * 2 - 1).toFixed(3));
}
const still = (event: PointerEvent<HTMLElement>) => event.currentTarget.style.removeProperty("--tx");

/**
 * The card itself, as an event lanyard pass (#135). It shows the fields it is given: the holder's own card and staff get
 * everything, a guest only the name, tag and chapter year (epic #113, decision 5), and an invalid card for a guest
 * nothing. The QR (or a notice in its place) comes as `children` on an opaque white plate that the landmark strip rises
 * behind; the scan page puts a stamp there instead.
 */
export function MemberCardFace({ card, stamp, children }: { card: Partial<CardFace>; stamp?: "valid" | "invalid"; children?: ReactNode }) {
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : null;
  const campus = [card.campus, card.studyProgram].filter(Boolean).join(" · ");
  return <div className={`member-pass ${vcr.variable}`} style={{ "--accent": divisionAccent(card.division) } as CSSProperties} onPointerMove={swing} onPointerLeave={still}>
    <PassArt name="lanyard" className="member-pass-lanyard" scale={3} />
    <article className="member-card" aria-label={card.name ? `Kartu anggota ${card.name}` : "Kartu anggota"}>
      <span className="member-pass-slot" aria-hidden="true" />
      <span className="member-pass-sky" aria-hidden="true"><PassArt name="cloud" className="member-pass-cloud" scale={3} /><PassArt name="cloud" className="member-pass-cloud" scale={3} /></span>
      <header className="member-pass-head">
        <PassArt name="mark" className="member-pass-mark" scale={0.7} />
        <p className="member-pass-org">GDGoC IPB University</p>
        {card.period && <p className="member-pass-year">{card.period}</p>}
      </header>
      {card.photo !== undefined && card.name && <span className="member-pass-avatar"><CardPhoto name={card.name} photo={card.photo} size={72} /></span>}
      {card.name && <h2>{card.name}</h2>}
      {card.number && <p className="member-pass-number">{card.number}</p>}
      {tag && <p className="member-pass-role"><span>{tag}</span>{card.tagConfirmed && <span className="member-card-verified"><PixelIcon name="check" size={16} />Terverifikasi</span>}</p>}
      {(campus || card.period) && <ul className="member-pass-facts">
        {campus && <li><PixelIcon name="building" size={18} /><span>{campus}</span></li>}
        {card.period && <li><PixelIcon name="calendar" size={18} /><span className="member-pass-label">Berlaku</span><span>{periodLabel(card.period)}</span></li>}
      </ul>}
      {children && <div className="member-pass-code">{children}</div>}
      {stamp && <p className="member-pass-stamp" data-stamp={stamp} aria-hidden="true"><PixelIcon name={stamp === "valid" ? "check" : "close"} size={26} />{stamp === "valid" ? "Aktif" : "Tidak berlaku"}</p>}
      <PassTown large />
    </article>
  </div>;
}
