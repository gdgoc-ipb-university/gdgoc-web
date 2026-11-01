"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { chapterPeriod } from "@/lib/chapter";
import { divisionAccent, photoAt } from "@/lib/member-card";
import { memberTagLabel, type MemberType } from "@/lib/onboarding";
import { qrMatrix, qrPath } from "@/lib/qr";
import { BrandLogo } from "./brand-logo";
import { PixelIcon } from "./pixel-icons";
import "./member-card.css";

export type CardFace = {
  name: string; photo: string | null; campus: string; studyProgram: string; number: string; period: string;
  memberType: MemberType | null; division: string | null; tagConfirmed: boolean;
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

/** The division's colour as `--accent`, for the card's edge and the tag chip. */
export const accentStyle = (division: string | null) => ({ "--accent": divisionAccent(division) }) as CSSProperties;

/** A few degrees of tilt and a sheen that follow a mouse; the stylesheet uses them only on desktop hover without reduced motion. */
function tilt(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--tx", ((event.clientX - box.left) / box.width * 2 - 1).toFixed(3));
  event.currentTarget.style.setProperty("--ty", ((event.clientY - box.top) / box.height * 2 - 1).toFixed(3));
}
function untilt(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--tx");
  event.currentTarget.style.removeProperty("--ty");
}

/**
 * The card itself, styled as an ID (#135): a header band with the lockup and chapter year, the four-colour stripe, then
 * the facts as real text on a faint guilloche, with the QR (or a notice in its place) as `children` on its own white
 * panel. `invalid` stamps the face for staff looking at a card that does not count.
 */
export function MemberCardFace({ card, invalid, children }: { card: CardFace; invalid?: boolean; children?: ReactNode }) {
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : null;
  return <article className="member-card" aria-label={`Kartu anggota ${card.name}`} data-invalid={invalid || undefined} style={accentStyle(card.division)} onPointerMove={tilt} onPointerLeave={untilt}>
    <header className="member-card-head"><BrandLogo /><p className="member-card-year"><span>Kartu anggota</span><strong>{card.period}</strong></p></header>
    <div className="member-card-stripe" aria-hidden="true"><span /><span /><span /><span /></div>
    <div className="member-card-body">
      <div className="member-card-person">
        <div className="member-card-portrait"><CardPhoto name={card.name} photo={card.photo} size={88} /><span className="member-card-seal" aria-hidden="true" /></div>
        <div>
          <h2>{card.name}</h2>
          {(card.campus || card.studyProgram) && <p>{[card.campus, card.studyProgram].filter(Boolean).join(" · ")}</p>}
          {tag && <p className="member-card-tag"><span className="member-card-chip">{tag}</span>{card.tagConfirmed && <span className="member-card-verified"><PixelIcon name="check" size={14} />Terverifikasi</span>}</p>}
        </div>
      </div>
      <dl className="member-card-facts">
        <div><dt>No. anggota</dt><dd className="member-card-number">{card.number}</dd></div>
        <div><dt>Berlaku</dt><dd>{periodLabel(card.period)}</dd></div>
      </dl>
      {children && <div className="member-card-code">{children}</div>}
      {invalid && <p className="member-card-void" aria-hidden="true">Tidak berlaku</p>}
    </div>
  </article>;
}
