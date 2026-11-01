"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components/Modal";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { communityLinks } from "@/lib/community";
import { readableError } from "@/lib/draft-session";
import { clockLabel, gatheringTimeLabel } from "@/lib/gathering";
import { cardPath, divisionAccent, photoAt } from "@/lib/member-card";
import { memberTagLabel } from "@/lib/onboarding";
import { qrMatrix } from "@/lib/qr";
import { siteUrl } from "@/lib/site";
import { BrandLogo } from "../brand-logo";
import { PixelIcon, pixelIconPaths } from "../pixel-icons";
import { LoadingPanel } from "../appreciation/shared";
import { MemberCardFace, QrCode, periodLabel } from "../member-card-face";
import { ConfirmDialog } from "./data-table";

type Card = NonNullable<FunctionReturnType<typeof api.cards.mine>>;

const cardUrl = (token: string) => `${siteUrl}${cardPath(token)}`;

/** Keeps the screen on while the QR is shown, where the browser allows it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null, done = false;
    navigator.wakeLock.request("screen").then((sentinel) => { if (done) void sentinel.release(); else lock = sentinel; }).catch(() => {});
    return () => { done = true; void lock?.release(); };
  }, [active]);
}

function DoorQr({ card, open, onClose }: { card: Card; open: boolean; onClose: () => void }) {
  useWakeLock(open);
  return <ModalOverlay className="member-qr-overlay" isOpen={open} onOpenChange={(next) => { if (!next) onClose(); }} isDismissable>
    <Modal className="member-qr-modal">
      <Dialog className="member-qr-dialog">
        <div className="member-card-stripe" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="member-qr-top"><BrandLogo /><Button className="icon-button member-qr-close" aria-label="Tutup" onPress={onClose}><PixelIcon name="close" size={24} /></Button></div>
        <Heading slot="title" className="sr-only">QR kartu anggota</Heading>
        <QrCode className="member-card-qr" value={cardUrl(card.token)} label={`QR kartu anggota ${card.name}`} />
        <div className="member-qr-id">
          <p className="member-qr-name">{card.name}</p>
          <p className="member-qr-number">{card.number}</p>
          <p className="member-qr-year">Kartu anggota · {card.period}</p>
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

/** The family a CSS font variable resolves to, so the saved image uses the site's fonts. */
function fontOf(variable: string, fallback: string) {
  return `${getComputedStyle(document.body).getPropertyValue(variable).trim() || fallback}, ${fallback}`;
}

/** Shrinks a line until it fits, then cuts it with an ellipsis. */
function fitText(g: CanvasRenderingContext2D, text: string, weight: string, size: number, min: number, family: string, width: number) {
  for (let px = size; px >= min; px--) {
    g.font = `${weight} ${px}px ${family}`;
    if (g.measureText(text).width <= width) return text;
  }
  let cut = text;
  while (cut.length > 1 && g.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** An image, or null when it does not load; a photo without CORS would taint the canvas, so it falls back to the initial. */
async function loadImage(src: string | null, crossOrigin?: "anonymous") {
  if (!src) return null;
  const image = new window.Image();
  if (crossOrigin) image.crossOrigin = crossOrigin;
  image.src = src;
  return image.decode().then(() => image, () => null);
}

const ink = "#172d43", muted = "#596775", paper = "#faf9f2";

/**
 * The card drawn for a saved image, for a poor connection at the venue: the portrait face at 2× (#135), texture and
 * all, with the QR on its own white panel drawn on whole device pixels so every module stays sharp.
 */
export async function drawCardImage(card: Pick<Card, "name" | "photo" | "campus" | "studyProgram" | "memberType" | "division" | "tagConfirmed" | "number" | "period" | "token">) {
  const scale = 2, margin = 16, width = 360, shadow = 6, inner = width - 2, accent = divisionAccent(card.division);
  const pixel = fontOf("--font-pixel", "monospace"), body = fontOf("--font-body", "sans-serif"), mono = fontOf("--font-mono", "monospace");
  // Load each face first, as the mono one is not preloaded. Only the first family: Next's local() fallback faces can fail
  // to load, which would end the wait early. A face that still fails only falls back.
  await Promise.all([`600 22px ${pixel}`, `400 13px ${body}`, `500 13px ${body}`, `500 10px ${mono}`, `600 21px ${mono}`]
    .map((font) => document.fonts.load(font.replace(/,.*$/, "")).catch(() => [])));
  const [logo, photo] = await Promise.all([loadImage("/brand/gdgoc-ipb.svg"), loadImage(photoAt(card.photo, 144), "anonymous")]);
  if (!logo) throw new Error("logo");
  const matrix = qrMatrix(cardUrl(card.token)), cell = Math.floor(280 * scale / matrix.length), qr = cell * matrix.length / scale;
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : "";
  const personHeight = 24 + 6 + 19 + (tag ? 10 + 22 : 0) + (tag && card.tagConfirmed ? 6 + 18 : 0);
  const height = 60 + 6 + 18 + Math.max(72, personHeight) + 18 + 97 + 18 + qr + 2 + 18 + 2;
  const canvas = document.createElement("canvas");
  canvas.width = (margin * 2 + width + shadow) * scale; canvas.height = (margin + height + shadow + 44) * scale;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  g.scale(scale, scale);
  g.textBaseline = "alphabetic";
  const text = (value: string, x: number, y: number, font: string, color: string, spacing = "0px") => {
    g.font = font; g.fillStyle = color; g.letterSpacing = spacing; g.fillText(value, x, y); g.letterSpacing = "0px";
  };
  g.fillStyle = paper; g.fillRect(0, 0, canvas.width, canvas.height);
  const left = margin, top = margin;
  g.fillStyle = ink; g.fillRect(left + shadow, top + shadow, width, height); g.fillRect(left, top, width, height);
  // Header band: lockup on white, the chapter year on navy.
  const x0 = left + 1, y0 = top + 1;
  g.fillStyle = "#fff"; g.fillRect(x0, y0, inner, 58);
  g.drawImage(logo, x0 + 12, y0 + 29 - 190 * 50 / 375 / 2, 190, 190 * 50 / 375);
  g.font = `600 19px ${pixel}`;
  const periodWidth = g.measureText(card.period).width;
  g.font = `500 9px ${mono}`; g.letterSpacing = "1.26px";
  const yearWidth = Math.max(periodWidth, g.measureText("KARTU ANGGOTA").width) + 24;
  g.letterSpacing = "0px";
  g.fillStyle = ink; g.fillRect(x0 + inner - yearWidth, y0, yearWidth, 58);
  g.textAlign = "right";
  text("KARTU ANGGOTA", x0 + inner - 12, y0 + 24, `500 9px ${mono}`, "#c9d3de", "1.26px");
  text(card.period, x0 + inner - 12, y0 + 45, `600 19px ${pixel}`, "#fff");
  g.textAlign = "left";
  ["#4285f4", "#ea4335", "#fbbc05", "#34a853"].forEach((color, index) => { g.fillStyle = color; g.fillRect(x0 + index * inner / 4, y0 + 58, inner / 4, 6); });
  // Body: paper, the guilloche's two rosettes, the division's edge.
  const by = y0 + 64, bh = height - 2 - 64;
  g.save();
  g.beginPath(); g.rect(x0, by, inner, bh); g.clip();
  g.fillStyle = paper; g.fillRect(x0, by, inner, bh);
  g.lineWidth = 1;
  for (const [cx, cy, color] of [[x0, by + bh, "rgb(66 133 244 / .09)"], [x0 + inner, by, "rgb(52 168 83 / .08)"]] as const) {
    g.strokeStyle = color;
    for (let r = 7.5; r < 900; r += 8) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  }
  g.restore();
  g.fillStyle = accent; g.fillRect(x0, by, 6, bh);
  // The holder: photo or pixel initial with the seal, then name, campus, tag.
  const cx = x0 + 20, textX = cx + 72 + 14, textWidth = inner - 20 - 14 - 72 - 14;
  let y = by + 18;
  g.fillStyle = "#e6eddc"; g.fillRect(cx, y, 72, 72);
  if (photo) g.drawImage(photo, cx, y, 72, 72);
  else { g.textAlign = "center"; text(card.name.trim().slice(0, 1).toUpperCase(), cx + 36, y + 49, `400 36px ${pixel}`, ink); g.textAlign = "left"; }
  g.strokeStyle = ink; g.strokeRect(cx + .5, y + .5, 71, 71);
  const seal = g.createConicGradient(0, cx + 68, y + 68), gloss = g.createRadialGradient(cx + 64, y + 62, 0, cx + 64, y + 62, 7);
  ["#c6dafc", "#fad2cf", "#feefc3", "#ceead6", "#c6dafc"].forEach((color, index) => seal.addColorStop(index / 4, color));
  gloss.addColorStop(.4, "rgb(255 255 255 / .9)"); gloss.addColorStop(1, "rgb(255 255 255 / 0)");
  g.fillStyle = seal; g.fillRect(cx + 54, y + 54, 28, 28); g.fillStyle = gloss; g.fillRect(cx + 54, y + 54, 28, 28);
  g.strokeRect(cx + 54.5, y + 54.5, 27, 27);
  g.save(); g.translate(cx + 68, y + 68); g.rotate(Math.PI / 4); g.strokeStyle = "rgb(23 45 67 / .45)"; g.strokeRect(-5.5, -5.5, 11, 11); g.restore();
  text(fitText(g, card.name, "600", 22, 15, pixel, textWidth), textX, y + 20, g.font, ink);
  const campus = [card.campus, card.studyProgram].filter(Boolean).join(" · ");
  if (campus) text(fitText(g, campus, "400", 13, 10, body, textWidth), textX, y + 44, g.font, muted);
  if (tag) {
    const label = fitText(g, tag, "500", 13, 10, body, textWidth - 24), font = g.font, chip = g.measureText(label).width + 30;
    g.fillStyle = "#fff"; g.fillRect(textX, y + 59, chip, 22); g.strokeStyle = ink; g.strokeRect(textX + .5, y + 59.5, chip - 1, 21);
    g.fillStyle = accent; g.fillRect(textX + 7, y + 65.5, 9, 9);
    text(label, textX + 22, y + 75, font, ink);
    if (card.tagConfirmed) {
      g.font = `500 10px ${mono}`; g.letterSpacing = ".4px";
      const verified = g.measureText("TERVERIFIKASI").width + 30;
      g.letterSpacing = "0px";
      g.fillStyle = "#e5f3e6"; g.fillRect(textX, y + 87, verified, 18); g.strokeStyle = "#9fceaa"; g.strokeRect(textX + .5, y + 87.5, verified - 1, 17);
      g.save(); g.translate(textX + 5, y + 89); g.scale(14 / 24, 14 / 24); g.fillStyle = "#13652d"; g.fill(new Path2D(pixelIconPaths.check[0])); g.restore();
      text("TERVERIFIKASI", textX + 22, y + 100, `500 10px ${mono}`, "#13652d", ".4px");
    }
  }
  // The number and validity, set like a card number.
  y += Math.max(72, personHeight) + 18;
  g.fillStyle = "rgb(23 45 67 / .2)"; g.fillRect(cx, y, inner - 20 - 14, 1);
  text("NO. ANGGOTA", cx, y + 26, `500 9px ${mono}`, muted, "1.08px");
  text(card.number, cx, y + 52, `600 21px ${mono}`, ink, "2.1px");
  text("BERLAKU", cx, y + 77, `500 9px ${mono}`, muted, "1.08px");
  text(fitText(g, periodLabel(card.period), "500", 13, 10, mono, inner - 34), cx, y + 95, g.font, ink);
  // The QR: an ink frame, then white with the quiet zone, then the modules, all on whole device pixels.
  y += 97 + 18;
  const qx = Math.round((x0 + (inner - qr) / 2) * scale), qy = Math.round((y + 1) * scale), size = cell * matrix.length;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = ink; g.fillRect(qx - scale, qy - scale, size + scale * 2, size + scale * 2);
  g.fillStyle = "#fff"; g.fillRect(qx, qy, size, size);
  g.fillStyle = "#000";
  matrix.forEach((row, my) => row.forEach((dark, mx) => { if (dark) g.fillRect(qx + mx * cell, qy + my * cell, cell, cell); }));
  g.setTransform(scale, 0, 0, scale, 0, 0);
  text(fitText(g, "Gambar ini tidak berlaku lagi jika QR diganti.", "400", 12, 9, body, width), left, top + height + shadow + 28, g.font, muted);
  return canvas;
}

async function saveCardImage(card: Card) {
  const canvas = await drawCardImage(card);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png");
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `kartu-anggota-${card.number}.png` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function CardActions({ card }: { card: Card }) {
  const reissue = useMutation(api.cards.reissue);
  const [door, setDoor] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [replaced, setReplaced] = useState(false);
  return <section className="app-panel member-card-actions" aria-labelledby="card-actions">
    <h2 id="card-actions">Di pintu masuk</h2>
    <p>Tunjukkan QR ke pengurus saat datang. Naikkan kecerahan layar jika ruangannya redup.</p>
    <div className="member-card-buttons">
      <Button className="button button-blue" onPress={() => setDoor(true)}>Tampilkan QR<PixelIcon name="eye" size={18} /></Button>
      <Button className="button button-quiet" onPress={() => { setSaveError(""); saveCardImage(card).catch(() => setSaveError("Gambar kartu belum bisa dibuat di browser ini. Coba browser lain, atau tunjukkan QR dari halaman ini.")); }}>
        <PixelIcon name="download" size={18} />Simpan kartu
      </Button>
    </div>
    {saveError && <p className="field-error" role="alert">{saveError}</p>}
    <p className="app-small">Sinyal di tempat acara lemah? Simpan kartu sebagai gambar. Gambar itu tetap berlaku sampai kamu mengganti QR.</p>
    <h3>QR tersebar?</h3>
    <p className="app-small">Kalau QR-mu difoto atau dibagikan ke orang lain, ganti QR. QR lama langsung tidak berlaku. Nomor anggotamu tetap sama.</p>
    <Button className="button button-quiet" onPress={() => { setError(""); setConfirm(true); }}><PixelIcon name="redo" size={18} />Ganti QR</Button>
    {replaced && <p className="app-small" role="status">QR baru sudah aktif. Simpan ulang kartu jika kamu memakai gambar.</p>}
    <DoorQr card={card} open={door} onClose={() => setDoor(false)} />
    <ConfirmDialog open={confirm} title="Ganti QR kartu?" confirmLabel="Ganti QR" danger busy={busy} error={error}
      message="QR lama, termasuk gambar kartu yang sudah disimpan dan tangkapan layarnya, langsung tidak berlaku. Nomor anggotamu tetap sama."
      onClose={() => setConfirm(false)}
      onConfirm={async () => {
        setBusy(true); setError("");
        try { await reissue({}); setConfirm(false); setReplaced(true); } catch (reason) { setError(readableError(reason)); } finally { setBusy(false); }
      }} />
  </section>;
}

/** The member's own check-ins at gatherings (#117). Lists only; rates wait for one check-in model with Catalyst (#109). */
function CheckInHistory() {
  const rows = useQuery(api.gatherings.mine);
  if (!rows) return null;
  return <section className="app-panel member-card-history" aria-labelledby="history-title">
    <h2 id="history-title">Riwayat kehadiran</h2>
    {!rows.length ? <p className="app-small">Kehadiranmu di rapat dan kumpul member akan tercatat di sini setelah kartumu dipindai.</p>
      : <ul>{rows.map((row) => <li key={row._id}><strong>{row.title}</strong><span className="app-small">{gatheringTimeLabel(row)} · {row.venue}</span><span className="app-small">Hadir {clockLabel(row.checkedInAt)}</span></li>)}</ul>}
  </section>;
}

export function MemberCardPage() {
  const ensure = useMutation(api.cards.ensure);
  const card = useQuery(api.cards.mine);
  const [error, setError] = useState("");
  useEffect(() => { ensure({}).catch((reason) => setError(readableError(reason))); }, [ensure]);
  const intro = <div className="dash-intro"><p className="eyebrow">AKUN</p><h1>Kartu anggota.</h1><p>Kartu untuk hadir di kegiatan GDGoC IPB, seperti rapat dan kumpul member. Event publik tetap memakai RSVP di Bevy.</p></div>;
  if (!card) return <>{intro}{error ? <p className="field-error" role="alert">{error}</p> : <LoadingPanel label="Menyiapkan kartu anggotamu…" />}</>;
  const revoked = card.status === "revoked";
  return <>
    {intro}
    <div className="member-card-layout">
      <MemberCardFace card={card}>
        {revoked
          ? <p className="member-card-notice" role="status"><strong>Kartu diblokir</strong>Pengurus memblokir kartu ini, jadi QR-nya tidak berlaku. Hubungi admin GDGoC IPB lewat <a href={communityLinks.instagram} target="_blank" rel="noreferrer">Instagram @gdgoc.ipb</a>.</p>
          : <QrCode className="member-card-qr" value={cardUrl(card.token)} label={`QR kartu anggota ${card.name}. Pengurus memindainya untuk mencatat kehadiran.`} />}
      </MemberCardFace>
      <div className="member-card-side">{!revoked && <CardActions card={card} />}<CheckInHistory /></div>
    </div>
  </>;
}
