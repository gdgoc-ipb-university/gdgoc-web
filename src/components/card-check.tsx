"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { readableError } from "@/lib/draft-session";
import { clockLabel } from "@/lib/gathering";
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

type Result = FunctionReturnType<typeof api.cards.verify>;
type Door = NonNullable<Extract<Result, { gatherings?: unknown }>["gatherings"]>[number];

/**
 * "Catat hadir" for staff and door helpers: today's open gatherings they can check the holder into (#117), the only one
 * preselected. Someone outside a gathering's audience is checked in only after a warning.
 */
function DoorCheckIn({ token, name, doors }: { token: string; name: string; doors: Door[] }) {
  const checkIn = useMutation(api.gatherings.checkIn);
  const [chosen, setChosen] = useState(doors.length === 1 ? doors[0]._id : "");
  const [outside, setOutside] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const door = doors.find((item) => item._id === chosen);
  async function record(allowOutside: boolean) {
    if (!door) return;
    setBusy(true); setError("");
    try {
      const result = await checkIn({ id: door._id, token, allowOutside });
      setOutside(result.result === "outside");
    } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
  }
  return <section className="card-check-door" aria-labelledby="door-title">
    <h2 id="door-title">Catat kehadiran</h2>
    {doors.length > 1
      ? <fieldset disabled={busy}><legend>Kegiatan hari ini</legend>{doors.map((item) => <label key={item._id} className="card-check-option">
        <input type="radio" name="gathering" value={item._id} checked={chosen === item._id} onChange={() => { setChosen(item._id); setOutside(false); setError(""); }} />
        <span><strong>{item.title}</strong><small>{item.venue}{item.checkedInAt !== null ? ` · hadir ${clockLabel(item.checkedInAt)}` : ""}</small></span>
      </label>)}</fieldset>
      : <p><strong>{doors[0].title}</strong> · {doors[0].venue}</p>}
    {door && (door.checkedInAt !== null
      ? <p className="card-check-done" role="status"><PixelIcon name="check" size={18} />{name} sudah tercatat hadir pukul {clockLabel(door.checkedInAt)}.</p>
      : outside
        ? <div className="card-check-warning" role="alert"><p>{name} tidak termasuk sasaran kegiatan ini. Tetap catat sebagai tamu?</p>
          <div className="card-check-buttons"><button type="button" className="button button-blue" disabled={busy} onClick={() => void record(true)}>Tetap catat hadir</button><button type="button" className="text-button" disabled={busy} onClick={() => setOutside(false)}>Batal</button></div></div>
        : <button type="button" className="button button-blue card-check-record" disabled={busy} onClick={() => void record(false)}>{busy ? "Mencatat…" : "Catat hadir"}</button>)}
    {!door && <p className="app-small">Pilih kegiatannya dulu.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}

/**
 * What a scanned member card shows (`/k/<token>`, E10 #116). Guests see whether the card is valid with the holder's
 * name, community tag and chapter year; staff, door helpers and the holder see the whole card.
 */
export function CardCheck({ token }: { token: string }) {
  const auth = useConvexAuth();
  const result = useQuery(api.cards.verify, auth.isLoading ? "skip" : { token });
  if (!result) return <p className="card-check-loading" role="status">Memeriksa kartu…</p>;
  return <CardCheckView result={result} />;
}

export function CardCheckView({ result }: { result: Result }) {
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
  const valid = status === "valid", doors = ("gatherings" in result ? result.gatherings : undefined) ?? [];
  if (!card) return <Verdict valid={false} title="Kartu tidak berlaku"><p>{cardStatusLabels[status]}.</p></Verdict>;
  return <>
    <Verdict valid={valid} title={valid ? "Kartu anggota aktif" : "Kartu tidak berlaku"}>
      {!valid && <p>{cardStatusLabels[status]}.</p>}
      {result.viewer === "self" && <p>Ini kartumu. Pengurus yang memindai QR-nya melihat kartu lengkap untuk mencatat kehadiranmu.</p>}
    </Verdict>
    {valid && doors.length > 0 && <DoorCheckIn token={card.token} name={card.name} doors={doors} />}
    <div className="card-check-card"><MemberCardFace card={card} /></div>
    {result.viewer !== "helper" && <p className="card-check-links">
      {result.viewer === "staff"
        ? <Link className="button button-blue" href={`/dashboard/anggota/${card.ownerId}`}>Buka halaman anggota</Link>
        : <Link className="button button-blue" href="/dashboard/kartu">Buka kartumu di dashboard</Link>}
    </p>}
  </>;
}
