"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components/Modal";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { communityLinks } from "@/lib/community";
import { readableError } from "@/lib/draft-session";
import { clockLabel, gatheringTimeLabel } from "@/lib/gathering";
import { cardPath } from "@/lib/member-card";
import { memberTagLabel } from "@/lib/onboarding";
import { qrMatrix } from "@/lib/qr";
import { siteUrl } from "@/lib/site";
import { BrandLogo } from "../brand-logo";
import { PixelIcon } from "../pixel-icons";
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

/** The card drawn for a saved image, for a poor connection at the venue: what the door needs, with the QR large. */
export async function drawCardImage(card: Pick<Card, "name" | "memberType" | "division" | "tagConfirmed" | "number" | "period" | "token">) {
  const width = 360, height = 580, scale = 3, pad = 24, inner = width - pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  await document.fonts.ready;
  const logo = new window.Image();
  logo.src = "/brand/gdgoc-ipb.svg";
  await logo.decode();
  const pixel = fontOf("--font-pixel", "monospace"), body = fontOf("--font-body", "sans-serif"), mono = fontOf("--font-mono", "monospace");
  g.scale(scale, scale);
  g.fillStyle = "#fff"; g.fillRect(0, 0, width, height);
  ["#4285f4", "#ea4335", "#fbbc05", "#34a853"].forEach((color, index) => { g.fillStyle = color; g.fillRect(index * width / 4, 0, width / 4, 8); });
  g.drawImage(logo, pad, 30, 280, 280 * 50 / 375);
  g.fillStyle = "#596775"; g.font = `500 10px ${mono}`; g.fillText("KARTU ANGGOTA", pad, 92);
  g.fillStyle = "#172d43"; g.fillText(fitText(g, card.name, "600", 26, 16, pixel, inner), pad, 124);
  const tag = card.memberType ? memberTagLabel(card.memberType, card.division) + (card.tagConfirmed ? " · Terverifikasi" : "") : "";
  if (tag) { g.fillStyle = "#172d43"; g.fillText(fitText(g, tag, "500", 14, 11, body, inner), pad, 148); }
  g.fillStyle = "#596775"; g.font = `500 10px ${mono}`; g.fillText("NO. ANGGOTA", pad, 182);
  g.fillStyle = "#172d43"; g.font = `500 16px ${mono}`; g.fillText(card.number, pad, 202);
  const matrix = qrMatrix(cardUrl(card.token)), size = 280, cell = size / matrix.length, left = (width - size) / 2, top = 222;
  g.fillStyle = "#000";
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) g.fillRect(left + x * cell, top + y * cell, cell + 0.02, cell + 0.02); }));
  g.fillStyle = "#596775"; g.fillText(fitText(g, `Berlaku ${periodLabel(card.period)}`, "500", 11, 9, mono, inner), pad, 538);
  g.fillText(fitText(g, "Gambar ini tidak berlaku lagi jika QR diganti.", "400", 11, 9, body, inner), pad, 558);
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
