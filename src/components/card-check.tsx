"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { cardStatusLabels } from "@/lib/member-card";
import { memberTagLabel } from "@/lib/onboarding";
import { MemberCardFace, periodLabel } from "./member-card-face";
import { PixelIcon } from "./pixel-icons";

const clock = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The time of the check, ticking each second, so a screenshot of an old check is easy to tell apart. */
function CheckedAt() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return <p className="card-check-time">Diperiksa {now ? `${clock.format(now)} WIB` : "…"}</p>;
}

function Verdict({ valid, title, children }: { valid: boolean; title: string; children?: ReactNode }) {
  return <section className="card-check-verdict" data-valid={valid} aria-labelledby="card-check-title">
    <PixelIcon name={valid ? "check" : "close"} size={40} />
    <div><h1 id="card-check-title">{title}</h1>{children}<CheckedAt /></div>
  </section>;
}

/**
 * What a scanned member card shows (`/k/<token>`, E10 #116). Guests see whether the card is valid with the holder's
 * name, community tag and chapter year; staff and the holder see the whole card.
 */
export function CardCheck({ token }: { token: string }) {
  const auth = useConvexAuth();
  const result = useQuery(api.cards.verify, auth.isLoading ? "skip" : { token });
  if (!result) return <p className="card-check-loading" role="status">Memeriksa kartu…</p>;
  return <CardCheckView result={result} />;
}

export function CardCheckView({ result }: { result: FunctionReturnType<typeof api.cards.verify> }) {
  if (result.viewer === "guest") {
    if (result.status !== "valid") return <Verdict valid={false} title="Kartu tidak berlaku">
      <p>QR ini tidak terhubung ke kartu anggota yang aktif. Kartunya mungkin sudah diganti, diblokir, atau dari tahun chapter sebelumnya.</p>
    </Verdict>;
    const { card } = result;
    return <Verdict valid title="Kartu anggota aktif">
      <dl className="card-check-facts">
        <div><dt>Nama</dt><dd>{card.name}</dd></div>
        {card.memberType && <div><dt>Peran komunitas</dt><dd>{memberTagLabel(card.memberType, card.division)}{card.tagConfirmed && <span className="member-card-verified"><PixelIcon name="check" size={14} />Terverifikasi</span>}</dd></div>}
        <div><dt>Berlaku</dt><dd>{periodLabel(card.period)}</dd></div>
      </dl>
      <p className="card-check-note">Anggota GDGoC IPB University. Cocokkan nama dengan orang yang menunjukkan kartu.</p>
    </Verdict>;
  }

  const { card, status } = result;
  const valid = status === "valid";
  if (!card) return <Verdict valid={false} title="Kartu tidak berlaku"><p>{cardStatusLabels[status]}.</p></Verdict>;
  return <>
    <Verdict valid={valid} title={valid ? "Kartu anggota aktif" : "Kartu tidak berlaku"}>
      {!valid && <p>{cardStatusLabels[status]}.</p>}
      {result.viewer === "self" && <p>Ini kartumu. Pengurus yang memindai QR-nya melihat kartu lengkap untuk mencatat kehadiranmu.</p>}
    </Verdict>
    <div className="card-check-card"><MemberCardFace card={card} /></div>
    <p className="card-check-links">
      {result.viewer === "staff"
        ? <Link className="button button-blue" href={`/dashboard/anggota/${card.ownerId}`}>Buka halaman anggota</Link>
        : <Link className="button button-blue" href="/dashboard/kartu">Buka kartumu di dashboard</Link>}
    </p>
  </>;
}
