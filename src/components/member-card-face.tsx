"use client";

import localFont from "next/font/local";
import Image from "next/image";
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { chapterPeriod } from "@/lib/chapter";
import { cr80, divisionAccent, nameFit, photoAt } from "@/lib/member-card";
import { memberTagLabel, type MemberType } from "@/lib/onboarding";
import { qrMatrix, qrPath } from "@/lib/qr";
import { PixelIcon } from "./pixel-icons";
import "./member-card.css";

/**
 * VCR OSD Mono for the card's titling (#135): the name, year, number and stamp. Scoped to the card. No
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
 * The card's art in `public/cards/` (#135): the landmarks and brackets mark from the Design System page of the GDGOC
 * 26/27 Figma file, cropped to their pixels, and the cloud and tree drawn to match. From the "ID Card" page (#142): the
 * background, its render of a pixel fade and 4% grid on the paper cropped to the trim, and the back's "Tiket masuk
 * program" scene, a ticket printing, with Figma's frame removed. Sizes are the art's own pixels; the "ID Card" page
 * scales them. The saved image loads the same files.
 */
export const passArt = {
  background: { src: "/cards/card-background.webp", width: 638, height: 1011 },
  mark: { src: "/cards/gdgoc-mark.svg", width: 76.7, height: 47.7 },
  cloud: { src: "/cards/cloud.svg", width: 20, height: 5 },
  tree: { src: "/cards/tree.svg", width: 10, height: 12 },
  kujang: { src: "/cards/tugu-kujang.svg", width: 69, height: 119 },
  ahn: { src: "/cards/gedung-ahn.svg", width: 123, height: 106 },
  ticket: { src: "/cards/tiket-masuk-program.svg", width: 798, height: 618 },
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

/** One piece of the card art, decorative; the stylesheet sizes it. */
export const PassArt = ({ name, className }: { name: keyof typeof passArt; className: string }) =>
  <Image className={className} src={passArt[name].src} alt="" width={passArt[name].width} height={passArt[name].height} unoptimized />;

/**
 * Where the art sits on each side, in trim pixels from the "ID Card" page (#142): x, y from the top of the strip, and
 * width. The strip runs from `top` to the bottom of the card, behind the content, and the card's edges crop it. Shared
 * with the door view and the saved image.
 */
export const townLayout = {
  // Tugu Kujang and Gedung AHN oversized and cut by the edges, trees on the grass.
  front: {
    top: 433,
    art: [["kujang", -129, 0, 320], ["ahn", 397, 44, 567], ["tree", 140, 484, 40], ["tree", 405, 484, 40], ["tree", 611, 484, 40]],
  },
  // The ticket scene centred, its base on the grass and under it. The back, the door view and the saved image follow this.
  back: {
    top: 785,
    art: [["ticket", 199, 0, 240]],
  },
} as const satisfies Record<string, { top: number; art: readonly (readonly [keyof typeof passArt, number, number, number])[] }>;

/**
 * The art along the bottom of a side, standing on grass, then the road. It scales with its own width, so
 * the door view can draw the back's strip on its own.
 */
export function PassTown({ side }: { side: keyof typeof townLayout }) {
  return <div className="cr80-town" data-side={side} style={{ "--h": cr80.height - townLayout[side].top } as CSSProperties} aria-hidden="true">
    {townLayout[side].art.map(([name, x, y, width], index) => <span key={index} className="cr80-town-art" style={{ "--x": x, "--y": y, "--w": width } as CSSProperties}>
      <PassArt name={name} className="cr80-art" />
    </span>)}
    <span className="cr80-ground" />
  </div>;
}

/**
 * The back's illustration, on the back and in the door view: the "Tiket masuk program" scene on grass and road. Its
 * layout is `townLayout.back`, which the saved image draws too, so a new illustration is changed in one place.
 */
export const BackIllustration = () => <PassTown side="back" />;

/** The brackets mark, the chapter's name and the chapter year at the top of each side. */
function CardHead({ period }: { period?: string }) {
  return <header className="cr80-head">
    <PassArt name="mark" className="cr80-mark" />
    <p className="cr80-org">GDGoC IPB University</p>
    {period && <p className="cr80-year">{period}</p>}
  </header>;
}

/** The punch slot, clouds and confetti: everything above the head that is not text. */
function CardSky() {
  return <>
    <span className="cr80-slot" aria-hidden="true" />
    <span className="cr80-sky" aria-hidden="true"><PassArt name="cloud" className="cr80-cloud" /><PassArt name="cloud" className="cr80-cloud" /></span>
  </>;
}

/**
 * The front of the card (#142). It shows the fields it is given: the holder's own card and staff get everything, a
 * guest only the name, tag and chapter year (epic #113, decision 5), and an invalid card for a guest nothing. The scan
 * page adds an "Aktif" or "Tidak berlaku" stamp under the role bar.
 */
export function MemberCardFront({ card, stamp }: { card: Partial<CardFace>; stamp?: "valid" | "invalid" }) {
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : null;
  const name = card.name ? nameFit(card.name) : null;
  return <div className={`cr80 ${vcr.variable}`} data-side="front" style={{ "--accent": divisionAccent(card.division) } as CSSProperties}>
    <CardSky />
    <div className="cr80-column">
      <CardHead period={card.period} />
      {card.photo !== undefined && card.name && <span className="cr80-photo"><CardPhoto name={card.name} photo={card.photo} size={200} /></span>}
      {card.name && name && <h2 className="cr80-name" style={{ "--size": name.px } as CSSProperties}>{card.name}</h2>}
      {card.number && <p className="cr80-number">{card.number}</p>}
      {tag && <p className="cr80-role">{tag}</p>}
      {stamp && <p className="cr80-stamp" data-stamp={stamp} aria-hidden="true"><PixelIcon name={stamp === "valid" ? "check" : "close"} size={26} />{stamp === "valid" ? "Aktif" : "Tidak berlaku"}</p>}
    </div>
    <PassTown side="front" />
  </div>;
}

/**
 * The back of the card (#142): the QR, or a notice in its place, on an opaque white plate that no art reaches, then the
 * number, campus and validity.
 */
export function MemberCardBack({ card, children }: { card: Partial<CardFace>; children: ReactNode }) {
  const campus = [card.campus, card.studyProgram].filter(Boolean).join(" · ");
  return <div className={`cr80 ${vcr.variable}`} data-side="back">
    <CardSky />
    <div className="cr80-column">
      <CardHead period={card.period} />
      <div className="cr80-plate">{children}</div>
      {card.number && <p className="cr80-number">{card.number}</p>}
      {(campus || card.period) && <ul className="cr80-facts">
        {campus && <li><PixelIcon name="building" size={20} /><span>{campus}</span></li>}
        {card.period && <li><PixelIcon name="calendar" size={20} /><span className="cr80-label">Berlaku</span><span>{periodLabel(card.period)}</span></li>}
      </ul>}
    </div>
    <BackIllustration />
  </div>;
}

/**
 * The card as printed (#142): both sides of a CR80 badge, each labelled. Without `back` only the front is shown, as on
 * the scan page for a guest.
 */
export function MemberCard({ card, stamp, back }: { card: Partial<CardFace>; stamp?: "valid" | "invalid"; back?: ReactNode }) {
  const id = useId();
  return <div className="cr80-pair" role="group" aria-label={card.name ? `Kartu anggota ${card.name}` : "Kartu anggota"}>
    <figure className="cr80-figure" aria-labelledby={`${id}-front`}><figcaption id={`${id}-front`}>Bagian depan</figcaption><MemberCardFront card={card} stamp={stamp} /></figure>
    {back !== undefined && <figure className="cr80-figure" aria-labelledby={`${id}-back`}><figcaption id={`${id}-back`}>Bagian belakang</figcaption><MemberCardBack card={card}>{back}</MemberCardBack></figure>}
  </div>;
}
