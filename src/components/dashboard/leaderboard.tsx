"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BOARD_SIZE, weekKey, weekLabel } from "@/lib/bogor-run/leaderboard";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelDino } from "../icons";
import { useNow } from "./shared";
import { useDashboardViewer, type DashboardViewer } from "./viewer";
import { PixelIcon } from "../pixel-icons";

export type Board = FunctionReturnType<typeof api.bogorRun.board>;
export type BoardPeriod = "week" | "all";
export type SetHidden = (entryId: Id<"gameBests">, hidden: boolean) => Promise<unknown>;
type Role = DashboardViewer["role"];
type Entry = Board["entries"][number];
type HiddenEntry = Board["hiddenEntries"][number];

const tabs: { value: BoardPeriod; label: string }[] = [{ value: "week", label: "Minggu ini" }, { value: "all", label: "Sepanjang masa" }];
const number = new Intl.NumberFormat("id-ID");
const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const clock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const staffNote: Record<Role, string> = {
  owner: " Sebagai pemilik, kamu bisa menyembunyikan pemain yang skornya janggal.",
  admin: " Sebagai admin, kamu bisa menyembunyikan member yang skornya janggal. Skor admin dan pemilik hanya bisa diatur pemilik.",
  member: "",
};

/**
 * The phone layout of dashboard.css. The moderation column no longer fits beside the score at 320px, and the hidden
 * players' reasons need the room at 390px, so the control moves under the score instead.
 */
const NARROW = "(max-width: 640px)";
function watchNarrow(change: () => void) {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(NARROW) : null;
  query?.addEventListener("change", change);
  return () => query?.removeEventListener("change", change);
}
const isNarrow = () => typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches;

export function LeaderboardPage() {
  const viewer = useDashboardViewer();
  // The week is passed explicitly: query results don't re-run as time passes, but useNow does, across Monday 00:00 WIB.
  const week = weekKey(useNow());
  // Both periods stay subscribed so switching tabs is instant.
  const boards = { week: useQuery(api.bogorRun.board, { period: "week", week }), all: useQuery(api.bogorRun.board, { period: "all" }) };
  const setHidden = useMutation(api.bogorRun.setHidden);
  return <Leaderboard week={week} role={viewer.role} boards={boards} onSetHidden={(entryId, hidden) => setHidden({ entryId, hidden })} />;
}

/** The page body, driven by props so it can be tested and previewed without Convex. */
export function Leaderboard({ week, role, boards, onSetHidden }: { week: string; role: Role; boards: Record<BoardPeriod, Board | undefined>; onSetHidden: SetHidden }) {
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [announcement, setAnnouncement] = useState("");
  const tabRefs = useRef<Partial<Record<BoardPeriod, HTMLButtonElement | null>>>({});
  const board = boards[period];
  function select(tab: BoardPeriod) { setPeriod(tab); setAnnouncement(""); }
  // Tabs follow focus (APG automatic activation): both boards are already loaded.
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.value === period);
    const next = ({ ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length].value;
    select(tab);
    tabRefs.current[tab]?.focus();
  }
  return <div className="dash-board-area">
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">BOGOR RUN · PAPAN SKOR</p><h1>Papan skor.</h1>
      <p>Skor terbaik Bogor Run, game lari di beranda GDGoC IPB. Papan mingguan dimulai lagi tiap Senin pukul 00.00 WIB.{staffNote[role]}</p></div>
      <Link className="button button-quiet" href="/#join">Main Bogor Run <Arrow /></Link></div>
    <div className="dash-tabs" role="tablist" aria-label="Periode papan skor" onKeyDown={move}>
      {tabs.map((tab) => <button key={tab.value} ref={(element) => { tabRefs.current[tab.value] = element; }} id={`board-tab-${tab.value}`} type="button" role="tab" className="dash-tab"
        aria-selected={period === tab.value} aria-controls="board-panel" tabIndex={period === tab.value ? 0 : -1} onClick={() => select(tab.value)}>
        <span>{tab.label}</span>{tab.value === "week" && <small>{weekLabel(week)}</small>}
      </button>)}
    </div>
    <div id="board-panel" className="dash-board-panel" role="tabpanel" aria-labelledby={`board-tab-${period}`} tabIndex={0}>
      {board ? <BoardView key={period} board={board} period={period} week={week} role={role} onSetHidden={onSetHidden} onAnnounce={setAnnouncement} /> : <LoadingPanel label="Memuat papan skor…" />}
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </div>;
}

/** Date and time are separate unbreakable parts, so a narrow column wraps between them rather than inside either. */
function When({ at, className, zone = false, label }: { at: number; className?: string; zone?: boolean; label?: string }) {
  const time = new Date(at);
  return <time className={className} dateTime={time.toISOString()}>{label && `${label} `}<span>{day.format(time)}</span>, <span>{clock.format(time)}{zone && " WIB"}</span></time>;
}

/** Past the counted range the server returns no rank; the board then only says the player is further down. */
function rankText(rank: number | null) { return rank === null ? `${number.format(1000)}+` : `#${number.format(rank)}`; }

/** What rows need from the board to moderate: rows are keyed per list, since hiding moves a player from one table to the other. */
type Moderation = {
  role: Role; narrow: boolean; onSetHidden: SetHidden; onAnnounce: (message: string) => void;
  register: (key: string) => (element: HTMLButtonElement | null) => void; focus: (key: string) => void;
  nextOf: (key: string) => string[]; settle: (key: string, next: string[]) => void;
};

function BoardView({ board, period, week, role, onSetHidden, onAnnounce }: { board: Board; period: BoardPeriod; week: string; role: Role; onSetHidden: SetHidden; onAnnounce: (message: string) => void }) {
  const { entries, hiddenEntries, you, stats, canModerate } = board;
  const narrow = useSyncExternalStore(watchNarrow, isNarrow, () => false);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const hiddenHeading = useRef<HTMLHeadingElement>(null);
  const leaving = useRef<{ key: string; next: string[] } | null>(null);
  // A moderated row leaves its table (or loses its button) once the board reflects the change, which can land before or
  // after the mutation resolves. Focus then goes to the nearest row that still has a button, as after deleting from a list.
  useLayoutEffect(() => {
    const plan = leaving.current;
    if (!plan || triggers.current.has(plan.key)) return;
    leaving.current = null;
    if (!document.activeElement || document.activeElement === document.body) focusNext(plan.next);
  });
  function focusNext(next: string[]) { (next.map((key) => triggers.current.get(key)).find(Boolean) ?? hiddenHeading.current)?.focus(); }
  const mod: Moderation | null = canModerate ? {
    role, narrow, onSetHidden, onAnnounce,
    register: (key) => (element) => { if (element) triggers.current.set(key, element); else triggers.current.delete(key); },
    focus: (key) => triggers.current.get(key)?.focus(),
    nextOf: (key) => {
      const keys = key.startsWith("hidden:") ? hiddenEntries.map((row) => `hidden:${row.id}`) : entries.map((row) => `shown:${row.id}`);
      const index = keys.indexOf(key);
      return [...keys.slice(index + 1), ...keys.slice(0, Math.max(index, 0)).reverse()];
    },
    settle: (key, next) => {
      const trigger = triggers.current.get(key);
      if (!trigger) return focusNext(next);
      trigger.focus();
      leaving.current = { key, next };
    },
  } : null;
  const mine = entries.find((entry) => entry.you);
  const scope = period === "week" ? "minggu ini" : "sepanjang masa";
  const empty = period === "week" ? "Belum ada skor minggu ini." : "Belum ada skor tersimpan.";
  const note = !you ? (period === "week" ? "Belum ada skormu minggu ini." : "Kamu belum punya skor tersimpan.")
    : `Skor terbaik ${number.format(you.score)}${you.hidden ? " · disembunyikan" : mine ? "" : ` · di luar ${BOARD_SIZE} besar`}`;
  const hiddenCount = `${number.format(hiddenEntries.length)} pemain`;
  return <>
    <dl className="dash-stats dash-board-stats">
      <div><dt>Peringkatmu {scope}</dt><dd>{you && !you.hidden ? rankText(you.rank) : "—"}</dd>
        <dd className="dash-board-note">{note}{mine && mine.rank > 10 && <> · <a href="#board-you">Lihat barismu</a></>}</dd></div>
      <div><dt>Pemain</dt><dd>{number.format(stats.players)}</dd></div>
      <div><dt>Permainan tercatat</dt><dd>{number.format(stats.runs)}</dd></div>
    </dl>
    {you?.hidden && <p className="app-notice">{canModerate ? <>Skormu sedang disembunyikan, jadi tidak tampil di papan skor. <a href="#board-hidden">Lihat keterangannya</a></>
      : "Skormu sedang disembunyikan admin, jadi tidak tampil di papan skor. Hubungi admin GDGoC IPB jika menurutmu ini keliru."}</p>}
    {mod && hiddenEntries.length > 0 && <p className="dash-board-off-note">{hiddenCount} disembunyikan dari papan {scope}. <a href="#board-hidden">Lihat daftarnya</a></p>}
    {entries.length ? <div className="dash-board-wrap"><table className="dash-board">
      <caption className="sr-only">{BOARD_SIZE} besar Bogor Run {period === "week" ? `minggu ini, ${weekLabel(week)}` : "sepanjang masa"}</caption>
      <thead><tr><th scope="col" className="dash-board-rank"><span>Peringkat</span></th><th scope="col">Pemain</th><th scope="col" className="dash-board-score">Skor</th><th scope="col" className="dash-board-when">Dicapai (WIB)</th>{mod && !narrow && <th scope="col" className="dash-board-actions"><span className="sr-only">Moderasi</span></th>}</tr></thead>
      <tbody>{entries.map((entry) => <BoardRow key={entry.id} entry={entry} mod={mod} />)}</tbody>
    </table></div>
      : <div className="app-empty"><PixelDino /><h2>{empty}</h2>
        <p>{period === "week" ? `Jadilah yang pertama di papan ${weekLabel(week)}. ` : "Jadilah yang pertama. "}Main Bogor Run di beranda, lalu simpan skormu dengan akun Google ini.</p>
        <Link className="button button-blue" href="/#join">Main Bogor Run <Arrow /></Link></div>}
    {mod && <section id="board-hidden" className="dash-board-off-area" aria-labelledby="board-hidden-title">
      <div className="app-section-heading"><div><p className="eyebrow">KHUSUS ADMIN · {hiddenCount.toUpperCase()}</p><h2 id="board-hidden-title" ref={hiddenHeading} tabIndex={-1}>Disembunyikan</h2></div></div>
      <p className="dash-board-off-intro">Pemain di sini tidak tampil di papan skor mana pun dan tidak diberi peringkat. Pemain yang akunnya dinonaktifkan ikut tersembunyi sampai akunnya diaktifkan kembali.
        {hiddenEntries.length >= BOARD_SIZE && ` Yang tampil hanya ${BOARD_SIZE} skor tertinggi.`}</p>
      {hiddenEntries.length ? <div className="dash-board-wrap"><table className="dash-board dash-board-off">
        <caption className="sr-only">Pemain yang disembunyikan dari papan {period === "week" ? `minggu ini, ${weekLabel(week)}` : "sepanjang masa"}</caption>
        <thead><tr><th scope="col">Pemain</th><th scope="col" className="dash-board-score">Skor</th><th scope="col" className="dash-board-when">Dicapai (WIB)</th>{!narrow && <th scope="col" className="dash-board-actions"><span className="sr-only">Moderasi</span></th>}</tr></thead>
        <tbody>{hiddenEntries.map((entry) => <BoardRow key={entry.id} entry={entry} mod={mod} />)}</tbody>
      </table></div> : <p className="dash-board-off-empty">Tidak ada pemain yang disembunyikan dari papan {scope}.</p>}
    </section>}
  </>;
}

/** Marks a refusal as a locked state, so it doesn't read as one more of the quiet moderation links beside it. */
function Lock() {
  return <PixelIcon name="lock" size={12} />;
}

/** Why staff see no button on a row, i.e. what setHidden would refuse. Your own row needs no explanation. */
function refusalOf(entry: Entry | HiddenEntry) {
  if (entry.you) return null;
  return "canRestore" in entry && entry.inactive && entry.hiddenAt === null ? "Tampil saat akun aktif" : "Khusus pemilik";
}

/** Who hid a player and when, or that a deactivated account keeps them hidden. */
function hiddenReason(entry: HiddenEntry): ReactNode {
  if (entry.hiddenAt === null) return entry.inactive ? "Akunnya dinonaktifkan, jadi skornya ikut disembunyikan sampai akunnya aktif lagi." : "Disembunyikan.";
  const role = entry.hiddenByRole === "owner" ? "pemilik" : "admin";
  return <>Disembunyikan oleh {entry.hiddenBy ? `${entry.hiddenBy} (${role})` : role} pada <When at={entry.hiddenAt} zone />.{entry.inactive && " Akunnya juga sedang nonaktif."}</>;
}

function BoardRow({ entry, mod }: { entry: Entry | HiddenEntry; mod: Moderation | null }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) confirmButton.current?.focus(); }, [confirming]);
  const off = "canRestore" in entry ? entry : null;
  const key = `${off ? "hidden" : "shown"}:${entry.id}`;
  const action = off ? "Tampilkan lagi" : "Sembunyikan";
  const question = off
    ? `Tampilkan lagi ${entry.name} di semua papan skor, mingguan dan sepanjang masa?${off.inactive ? " Akunnya masih nonaktif, jadi skornya baru tampil setelah akunnya diaktifkan kembali." : ""}`
    : `Sembunyikan ${entry.name} dari semua papan skor? Skornya tetap tersimpan, dan skor berikutnya dari pemain ini ikut tersembunyi sampai ditampilkan lagi.${mod?.role === "owner" ? " Karena kamu pemilik, hanya pemilik yang bisa menampilkannya lagi." : ""}`;
  const allowed = off ? off.canRestore : "canHide" in entry && entry.canHide;
  const refusal = mod && !allowed ? refusalOf(entry) : null;
  const control = !mod ? null : allowed
    ? <button ref={mod.register(key)} type="button" className={`text-button ${off ? "" : "text-danger"}`} aria-expanded={confirming} aria-controls={confirming ? `confirm-${entry.id}` : undefined}
      disabled={busy} onClick={() => { setConfirming(true); setError(""); }}>{action} <span className="sr-only">{entry.name}</span></button>
    : refusal && <span className="dash-board-refusal"><Lock />{refusal}</span>;
  async function confirm() {
    if (!mod) return;
    const next = mod.nextOf(key);
    setBusy(true); setError("");
    try { await mod.onSetHidden(entry.id, !off); }
    catch (cause) { setError(readableError(cause)); setBusy(false); return; }
    // Re-enable the trigger synchronously so focus can return to it until the row leaves this table.
    flushSync(() => { setBusy(false); setConfirming(false); });
    mod.onAnnounce(!off ? `${entry.name} disembunyikan dari semua papan skor dan kini ada di daftar Disembunyikan.`
      : off.inactive ? `${entry.name} tidak lagi disembunyikan admin, tapi skornya baru tampil setelah akunnya diaktifkan kembali.`
      : `${entry.name} ditampilkan lagi di semua papan skor.`);
    mod.settle(key, next);
  }
  function cancel() { setConfirming(false); setError(""); mod?.focus(key); }
  const narrow = mod?.narrow ?? false;
  const top = !off && entry.rank !== null && entry.rank <= 3 ? entry.rank : undefined;
  return <>
    <tr id={entry.you && !off ? "board-you" : undefined} data-you={entry.you || undefined} data-confirming={(mod && (confirming || Boolean(error))) || undefined}>
      {!off && <td className="dash-board-rank"><span className="dash-rank" data-top={top}>{entry.rank}</span></td>}
      <th scope="row"><span className="dash-board-player"><span className="dash-board-name">{entry.name}</span>
        {entry.you && <span className="app-status dash-status" data-status="you">Kamu</span>}
        {off?.inactive && <span className="app-status dash-status" data-status="missing">Nonaktif</span>}</span>
        {off && <span className="dash-board-why">{hiddenReason(off)}</span>}
        <When at={entry.achievedAt} className="dash-board-when-inline" zone label={off ? "Skor dicapai" : undefined} /></th>
      <td className="dash-board-score">{number.format(entry.score)}{narrow && control && <span className="dash-board-actions-inline">{control}</span>}</td>
      <td className="dash-board-when"><When at={entry.achievedAt} /></td>
      {mod && !narrow && <td className="dash-board-actions">{control}</td>}
    </tr>
    {mod && (confirming || error) && <tr className="dash-board-confirm"><td colSpan={(off ? 3 : 4) + (narrow ? 0 : 1)}>
      {confirming && <div id={`confirm-${entry.id}`} className="dash-confirm" role="group" aria-label={`${action} ${entry.name}`}><p>{question}</p>
        <button ref={confirmButton} type="button" className={`text-button ${off ? "" : "text-danger"}`} disabled={busy} onClick={() => void confirm()}>{busy ? "Menyimpan…" : `Ya, ${action.toLowerCase()}`}</button>
        <button type="button" className="text-button" disabled={busy} onClick={cancel}>Batal</button></div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </td></tr>}
  </>;
}
