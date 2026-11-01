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
import { PixelIcon, pixelIconPaths } from "../pixel-icons";
import { LoadingPanel } from "../appreciation/shared";
import { MemberCardFace, PassArt, PassTown, QrCode, passArt, periodLabel } from "../member-card-face";
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
        <div className="member-qr-top">
          <p className="member-qr-org"><PassArt name="mark" className="member-pass-mark" scale={0.6} /><span><strong>GDGoC IPB University</strong><span>Kartu anggota · {card.period}</span></span></p>
          <Button className="icon-button member-qr-close" aria-label="Tutup" onPress={onClose}><PixelIcon name="close" size={24} /></Button>
        </div>
        <Heading slot="title" className="sr-only">QR kartu anggota</Heading>
        <QrCode className="member-card-qr" value={cardUrl(card.token)} label={`QR kartu anggota ${card.name}`} />
        <div className="member-qr-id"><p className="member-qr-name">{card.name}</p><p className="member-qr-number">{card.number}</p></div>
        <PassTown />
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

/** The name in at most two balanced lines, shrinking the font until the longer line fits. */
function nameLines(g: CanvasRenderingContext2D, name: string, family: string, size: number, min: number, width: number) {
  const words = name.trim().split(/\s+/);
  for (let px = size; px >= min; px--) {
    g.font = `600 ${px}px ${family}`;
    if (g.measureText(name).width <= width) return { px, lines: [name] };
    let best: string[] | null = null, widest = Infinity;
    for (let cut = 1; cut < words.length; cut++) {
      const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")], longest = Math.max(...lines.map((line) => g.measureText(line).width));
      if (longest <= width && longest < widest) { best = lines; widest = longest; }
    }
    if (best) return { px, lines: best };
  }
  return { px: min, lines: [fitText(g, name, "600", min, min, family, width)] };
}

/** An image, or null when it does not load; a photo without CORS would taint the canvas, so it falls back to the initial. */
async function loadImage(src: string | null, crossOrigin?: "anonymous") {
  if (!src) return null;
  const image = new window.Image();
  if (crossOrigin) image.crossOrigin = crossOrigin;
  image.src = src;
  return image.decode().then(() => image, () => null);
}

const ink = "#172d43", muted = "#596775", cream = "#fffcf3";

/**
 * The pass drawn for a saved image, for a poor connection at the venue (#135): the same layout as the face at 380 px,
 * drawn at 2× with the strap and landmark strip loaded from the same SVGs. The QR is drawn on whole device pixels, so
 * every module edge stays sharp.
 */
export async function drawCardImage(card: Pick<Card, "name" | "photo" | "campus" | "studyProgram" | "memberType" | "division" | "tagConfirmed" | "number" | "period" | "token">) {
  const scale = 2, margin = 16, width = 380, inner = width - 2, content = inner - 40, shadow = 6;
  const pixel = fontOf("--font-pixel", "monospace"), space = fontOf("--font-space", "sans-serif"), body = fontOf("--font-body", "sans-serif"), mono = fontOf("--font-mono", "monospace");
  // Load each face first, as the mono one is not preloaded. Only the first family: Next's local() fallback faces can fail
  // to load, which would end the wait early. A face that still fails only falls back.
  await Promise.all([`600 36px ${pixel}`, `600 15px ${space}`, `400 13px ${body}`, `500 13px ${mono}`]
    .map((font) => document.fonts.load(font.replace(/,.*$/, "")).catch(() => [])));
  const names = Object.keys(passArt) as (keyof typeof passArt)[];
  const [photo, ...loaded] = await Promise.all([loadImage(photoAt(card.photo, 144), "anonymous"), ...names.map((name) => loadImage(passArt[name].src))]);
  const art = Object.fromEntries(names.map((name, index) => [name, loaded[index]])) as Record<keyof typeof passArt, HTMLImageElement | null>;
  if (names.some((name) => !art[name])) throw new Error("art");
  const draw = (name: keyof typeof passArt, x: number, y: number, times = 1) => g.drawImage(art[name]!, x, y, passArt[name].width * times, passArt[name].height * times);
  const text = (value: string, x: number, y: number, font: string, color: string, spacing = "0px") => {
    g.font = font; g.fillStyle = color; g.letterSpacing = spacing; g.fillText(value, x, y); g.letterSpacing = "0px";
  };
  const icon = (name: "building" | "calendar" | "check" | "close", x: number, y: number, size: number, color: string) => {
    g.save(); g.translate(x, y); g.scale(size / 24, size / 24); g.fillStyle = color;
    for (const path of pixelIconPaths[name]) g.fill(new Path2D(path));
    g.restore();
  };

  // Measure first, so the canvas is as tall as the pass.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas");
  let g = measure;
  const name = nameLines(g, card.name, pixel, 35, 24, content);
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : "";
  g.font = `600 15px ${space}`;
  const tagWidth = g.measureText(tag).width;
  g.font = `500 11px ${mono}`; g.letterSpacing = ".44px";
  const verifiedWidth = card.tagConfirmed ? 12 + 16 + 4 + g.measureText("TERVERIFIKASI").width : 0;
  g.letterSpacing = "0px";
  const roleRows = tag && tagWidth + (verifiedWidth ? 12 + verifiedWidth : 0) > content - 26 ? 2 : 1;
  const campus = [card.campus, card.studyProgram].filter(Boolean).join(" · ");
  const matrix = qrMatrix(cardUrl(card.token)), cell = Math.floor(280 * scale / matrix.length), qr = cell * matrix.length / scale;
  const top = margin + 72, nameHeight = name.lines.length * name.px * 1.05;
  const heights = { head: 40 + 34 + 6 + 21 + 2 + 18, avatar: 16 + 78, name: 12 + nameHeight, number: 6 + 24, role: tag ? 18 + 20 * roleRows + 20 : 0, facts: 14 + (campus ? 37 : 0) + 37, qr: 18 + qr + 2, town: 14 + 150 };
  const height = 1 + Object.values(heights).reduce((sum, value) => sum + value, 0) + 1;

  const canvas = document.createElement("canvas");
  canvas.width = (margin * 2 + width + shadow) * scale; canvas.height = (top + height + shadow + 44) * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  g = context;
  g.scale(scale, scale);
  g.fillStyle = "#faf9f2"; g.fillRect(0, 0, canvas.width, canvas.height);
  const left = margin, x0 = left + 1, y0 = top + 1, mid = x0 + inner / 2;
  g.fillStyle = ink; g.fillRect(left + shadow, top + shadow, width, height); g.fillRect(left, top, width, height);
  g.fillStyle = cream; g.fillRect(x0, y0, inner, height - 2);
  // The punched slot, the sky's clouds and confetti.
  g.fillStyle = ink; g.fillRect(mid - 23, y0 + 10, 46, 14);
  g.fillStyle = "#c9c4b0"; g.fillRect(mid - 21, y0 + 12, 42, 10);
  g.fillStyle = "#e3e0d2"; g.fillRect(mid - 21, y0 + 15, 42, 7);
  draw("cloud", x0 + 12, y0 + 28, 3); draw("cloud", x0 + inner - 70, y0 + 58, 3);
  for (const [dx, dy, color] of [[70, 18, "#ea4335"], [84, 42, "#fbbc05"], [26, 64, "#4285f4"], [inner - 66, 30, "#4285f4"], [inner - 30, 92, "#34a853"], [inner - 42, 104, "#fbbc05"]] as const) {
    g.fillStyle = color; g.fillRect(x0 + dx, y0 + dy, 6, 6);
  }
  // The head: brackets mark, chapter name and year.
  let y = y0 + 40;
  g.textAlign = "center";
  draw("mark", mid - 27, y, 54 / passArt.mark.width);
  y += 34 + 6;
  text("GDGoC IPB University", mid, y + 16, `600 17px ${space}`, ink);
  text(card.period, mid, y + 21 + 2 + 14, `500 13px ${mono}`, muted, "1.04px");
  y += 21 + 2 + 18 + 16;
  // The photo or pixel initial in a pixel frame with notched corners.
  g.fillStyle = ink; g.fillRect(mid - 39, y, 78, 78);
  g.fillStyle = cream; for (const [cx, cy] of [[0, 0], [75, 0], [0, 75], [75, 75]]) g.fillRect(mid - 39 + cx, y + cy, 3, 3);
  if (photo) g.drawImage(photo, mid - 36, y + 3, 72, 72);
  else { g.fillStyle = "#e6eddc"; g.fillRect(mid - 36, y + 3, 72, 72); text(card.name.trim().slice(0, 1).toUpperCase(), mid, y + 3 + 50, `400 38px ${pixel}`, ink); }
  y += 78 + 12;
  // The name, large, and the number in mono.
  name.lines.forEach((line, index) => text(line, mid, y + name.px * (1.05 * index + .85), `600 ${name.px}px ${pixel}`, ink));
  y += nameHeight + 6;
  text(card.number, mid, y + 18, `500 17px ${mono}`, ink, "2.38px");
  y += 24;
  // The role bar in the division's colour, with the verified mark.
  if (tag) {
    y += 18;
    const barHeight = 20 * roleRows + 18, x = x0 + 20;
    g.fillStyle = ink; g.fillRect(x + 3, y + 3, content, barHeight); g.fillRect(x, y, content, barHeight);
    g.fillStyle = divisionAccent(card.division); g.fillRect(x + 1, y + 1, content - 2, barHeight - 2);
    const rowWidth = roleRows === 1 ? tagWidth + (verifiedWidth ? 12 + verifiedWidth : 0) : tagWidth;
    let tx = mid - rowWidth / 2;
    g.textAlign = "left";
    text(tag, tx, y + 23, `600 15px ${space}`, "#fff");
    if (verifiedWidth) {
      const vy = roleRows === 1 ? y : y + 20;
      tx = roleRows === 1 ? tx + tagWidth + 12 : mid - verifiedWidth / 2;
      g.fillStyle = "rgb(255 255 255 / .55)"; g.fillRect(tx, vy + 11, 1, 16);
      icon("check", tx + 12, vy + 11, 16, "#fff");
      text("TERVERIFIKASI", tx + 32, vy + 23, `500 11px ${mono}`, "#fff", ".44px");
    }
    g.textAlign = "center";
    y += barHeight + 2;
  }
  // Campus and validity, each on a row with its icon.
  y += 14;
  g.textAlign = "left";
  const row = (name: "building" | "calendar", draw: (x: number) => void) => {
    icon(name, x0 + 22, y + 9.5, 18, ink); draw(x0 + 22 + 18 + 10);
    g.fillStyle = "rgb(23 45 67 / .2)"; g.fillRect(x0 + 20, y + 36, content, 1);
    y += 37;
  };
  if (campus) row("building", (x) => text(fitText(g, campus, "400", 13, 10, body, content - 32), x, y + 23, g.font, ink));
  row("calendar", (x) => {
    text("BERLAKU", x, y + 22, `500 10px ${mono}`, muted, "1px");
    g.font = `500 10px ${mono}`; g.letterSpacing = "1px";
    const labelWidth = g.measureText("BERLAKU").width + 10;
    g.letterSpacing = "0px";
    text(fitText(g, periodLabel(card.period), "500", 13, 10, mono, content - 32 - labelWidth), x + labelWidth, y + 23, g.font, ink);
  });
  g.textAlign = "center";
  // The QR: an ink frame, then white with the quiet zone, then the modules, all on whole device pixels.
  y += 18;
  const qx = Math.round((mid - qr / 2) * scale), qy = Math.round((y + 1) * scale), size = cell * matrix.length;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = ink; g.fillRect(qx - scale, qy - scale, size + scale * 2, size + scale * 2);
  g.fillStyle = "#fff"; g.fillRect(qx, qy, size, size);
  g.fillStyle = "#000";
  matrix.forEach((cells, my) => cells.forEach((dark, mx) => { if (dark) g.fillRect(qx + mx * cell, qy + my * cell, cell, cell); }));
  g.setTransform(scale, 0, 0, scale, 0, 0);
  y += qr + 2 + 14;
  // The landmark strip, under the QR: clouds, confetti, Tugu Kujang, Gedung AHN, the gate, trees, grass and road.
  const base = y + 150 - 17;
  draw("cloud", x0 + inner * .22, y + 10, 3); draw("cloud", x0 + inner * .76 - 60, y + 2, 3);
  for (const [dx, dy, color] of [[-96, 0, "#34a853"], [-80, 26, "#ea4335"], [70, -8, "#fbbc05"], [88, 18, "#4285f4"]] as const) {
    g.fillStyle = color; g.fillRect(mid + dx, y + 40 + dy, 6, 6);
  }
  draw("kujang", x0 + 6, base - passArt.kujang.height);
  draw("ahn", x0 + inner - 4 - passArt.ahn.width, base - passArt.ahn.height);
  draw("gate", mid - passArt.gate.width * .56, base - passArt.gate.height);
  draw("tree", x0 + 70, base - 36, 3); draw("tree", x0 + inner - 106 - 30, base - 36, 3); draw("tree", x0 + inner - 2 - 20, base - 24, 2);
  const ground = y + 150 - 22;
  for (const [from, to, color] of [[0, 2, "#2f6b3a"], [2, 9, "#4f9441"], [9, 10, ink], [10, 22, "#778e8c"]] as const) { g.fillStyle = color; g.fillRect(x0, ground + from, inner, to - from); }
  g.fillStyle = "#6fb24f"; for (let x = 0; x < inner; x += 8) g.fillRect(x0 + x, ground + 2, 2, 2);
  g.fillStyle = "#d9e2dd"; for (let x = 0; x < inner; x += 22) g.fillRect(x0 + x, ground + 15, Math.min(10, inner - x), 2);
  // The strap and clip last, over the card's top edge into the slot.
  draw("lanyard", mid - 36, margin, 3);
  g.textAlign = "left";
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
