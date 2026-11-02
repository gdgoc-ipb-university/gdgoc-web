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
import { siteUrl } from "@/lib/site";
import { PixelIcon } from "../pixel-icons";
import { LoadingPanel } from "../appreciation/shared";
import { MemberCard, PassArt, PassTown, QrCode, passFont } from "../member-card-face";
import { cardImagePng } from "./card-image";
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

/** The back of the card full screen for the door (#142): the head, the QR on its plate, the number and name, and the strip. */
function DoorQr({ card, open, onClose }: { card: Card; open: boolean; onClose: () => void }) {
  useWakeLock(open);
  return <ModalOverlay className="member-qr-overlay" isOpen={open} onOpenChange={(next) => { if (!next) onClose(); }} isDismissable>
    <Modal className="member-qr-modal">
      <Dialog className={`member-qr-dialog ${passFont.className}`}>
        <Button className="icon-button member-qr-close" aria-label="Tutup" onPress={onClose}><PixelIcon name="close" size={24} /></Button>
        <header className="member-qr-org">
          <PassArt name="mark" className="cr80-mark" /><Heading slot="title" className="sr-only">QR kartu anggota</Heading>
          <p className="member-qr-chapter">GDGoC IPB University</p><p className="member-qr-year">{card.period}</p>
        </header>
        <div className="member-qr-main">
          <div className="member-qr-plate"><QrCode className="member-card-qr" value={cardUrl(card.token)} label={`QR kartu anggota ${card.name}`} /></div>
          <div className="member-qr-id"><p className="member-qr-number">{card.number}</p><p className="member-qr-name">{card.name}</p></div>
        </div>
        <PassTown side="back" />
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

async function saveCardImage(card: Card) {
  const blob = await cardImagePng({ ...card, url: cardUrl(card.token) });
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
    <p className="app-small">Sinyal di tempat acara lemah? Simpan kartu sebagai gambar. Gambarnya memuat kedua sisi kartu, siap dicetak seukuran kartu ID (54 × 85,6 mm), dan tetap berlaku sampai kamu mengganti QR.</p>
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
      <MemberCard card={card} back={revoked
        ? <p className="member-card-notice" role="status"><strong>Kartu diblokir</strong>Pengurus memblokir kartu ini, jadi QR-nya tidak berlaku. Hubungi admin GDGoC IPB lewat <a href={communityLinks.instagram} target="_blank" rel="noreferrer">Instagram @gdgoc.ipb</a>.</p>
        : <QrCode className="member-card-qr" value={cardUrl(card.token)} label={`QR kartu anggota ${card.name}. Pengurus memindainya untuk mencatat kehadiran.`} />} />
      <div className="member-card-side">{!revoked && <CardActions card={card} />}<CheckInHistory /></div>
    </div>
  </>;
}
