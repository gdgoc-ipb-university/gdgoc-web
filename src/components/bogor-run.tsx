"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import { useExperience } from "./experience-provider";
import { Arrow } from "./icons";
import { weekKey, weekLabel } from "@/lib/bogor-run/leaderboard";
import type { Board, Period, Saved } from "@/lib/bogor-run/online";
import type { FinishedRun, Runner, Snapshot } from "@/lib/bogor-run/runtime";
import { readSkin, type DinoSkin } from "@/lib/bogor-run/skin";
import styles from "./bogor-run.module.css";

type Online = typeof import("@/lib/bogor-run/online");
type Save =
  | { kind: "idle" | "saving" }
  | { kind: "unranked"; reason: "ticket" | "log" }
  | { kind: "saved"; result: Saved }
  | { kind: "guest"; run: FinishedRun; endedAt: number; error?: string; leaving?: boolean }
  | { kind: "error"; message: string; retry?: { run: FinishedRun; endedAt: number } };
type Boards = Partial<Record<Period, { state: "loading" | "ready" | "error"; board?: Board }>>;

// For whoever opens the console on the landing page: the dino points at the /rai easter egg.
const CONSOLE_DINO = [
  "            ▄██████▄",
  "            ██▄█████",
  "            ████████",
  "            ████▄▄▄",
  "  █      ▄██████",
  "  ██▄  ▄████████▀█",
  "   ▀████████████",
  "     ▀███████▀",
  "       █▀  █▄",
  "psst… ada dino biru yang sembunyi di /rai",
].join("\n");
let hinted = false;

const initial: Snapshot = { phase: "idle", score: 0, best: 0, message: "", autoplay: false, flash: 0, sound: true, finished: false };
const number = (value: number) => String(value).padStart(3, "0");
const PERIODS: readonly { id: Period; label: string }[] = [{ id: "week", label: "Minggu ini" }, { id: "all", label: "Sepanjang masa" }];
const BOARD_TTL = 30_000;
const HINT_MS = 3600;
const OFFLINE = "Server skor belum bisa dihubungi. Periksa koneksi, lalu coba lagi.";
// Why a run carried no ticket (FinishedRun.unranked). 10.000 is LIMITS.maxInputNumbers / 2; the engine stays out of this bundle.
const UNRANKED = {
  ticket: "Putaran ini tidak masuk papan skor: tiket skornya belum sampai dari server saat kamu mulai. Main lagi untuk ikut peringkat.",
  log: "Putaran ini tidak masuk papan skor: tombolnya ditekan lebih dari 10.000 kali, lebih dari yang bisa diperiksa server. Main lagi untuk ikut peringkat.",
} as const;

// Convex and Better Auth stay out of the landing bundle: this chunk loads only once the game is on screen.
let online: Online | null = null;
let onlineLoad: Promise<Online | null> | null = null;
const loadOnline = () => onlineLoad ??= import("@/lib/bogor-run/online")
  .then((module) => (online = module))
  .catch(() => { onlineLoad = null; return null; });

const rankOf = (rank: number | null) => rank === null ? "1000+" : `#${rank}`;
/** The server files a run under the week its ticket was issued in, so a run begun late on Sunday lands on last week. */
function savedText({ week }: Saved, now = Date.now()) {
  const when = week.key < weekKey(now) ? "minggu lalu" : "minggu ini";
  if (week.rank === null) return `Tersimpan · rekor ${when} ${week.best}`;
  return week.improved ? `Tersimpan · peringkat ${rankOf(week.rank)} ${when}` : `Tersimpan · rekor ${when} tetap ${week.best} (${rankOf(week.rank)})`;
}

export function BogorRun({ invitation, children }: { invitation?: ReactNode; children?: ReactNode }) {
  const { animated } = useExperience();
  const id = useId();
  const arena = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const wasPlaying = useRef(false);
  const action = useRef<HTMLButtonElement>(null);
  const controller = useRef<Runner | null>(null);
  const reduced = useRef(!animated);
  const returning = useRef<"simpan" | "gagal" | null>(null);
  const lastPhase = useRef<Snapshot["phase"]>("idle");
  const saveId = useRef(0);
  const boardAt = useRef<Record<Period, number>>({ week: 0, all: 0 });
  const pressed = useRef({ active: false, at: -Infinity }); // a press the tap area already acted on, so its click is skipped
  const duckPointers = useRef(new Set<number>()); // every finger on the duck zone; the dino stands when the last one lifts
  const stopTickets = useRef<() => void>(undefined);
  const lastWidth = useRef(0);
  const hintShown = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [snapshot, setSnapshot] = useState(initial);
  const [load, setLoad] = useState<"waiting" | "ready" | "error">("waiting");
  const [skin, setSkin] = useState<DinoSkin>("classic");
  const [attempt, setAttempt] = useState(0);
  const [save, setSave] = useState<Save>({ kind: "idle" });
  const [boards, setBoards] = useState<Boards>({});
  const [period, setPeriod] = useState<Period>("week");
  const [closed, setClosed] = useState(false);
  const [closedFor, setClosedFor] = useState(snapshot.phase);
  const [hint, setHint] = useState(false);
  const [notice, setNotice] = useState("");
  const { phase, score, best, message, autoplay, flash, sound, finished } = snapshot;
  const playing = phase !== "idle";
  // The board opens on every pause and game over; closing it only lasts until the phase changes.
  if (closedFor !== phase) { setClosedFor(phase); setClosed(false); }
  const panelOpen = (phase === "paused" || phase === "over") && !closed;
  const shown = boards[period];

  function fetchBoard(which: Period, force = false) {
    if (!force && Date.now() - boardAt.current[which] < BOARD_TTL) return;
    boardAt.current[which] = Date.now();
    setBoards((all) => ({ ...all, [which]: { ...all[which], state: all[which]?.board ? "ready" : "loading" } }));
    void loadOnline()
      .then((api) => api ? api.leaderboard(which) : Promise.reject(new Error("offline")))
      .then((board) => setBoards((all) => ({ ...all, [which]: { state: "ready", board } })))
      .catch(() => {
        boardAt.current[which] = 0;
        setBoards((all) => ({ ...all, [which]: { ...all[which], state: all[which]?.board ? "ready" : "error" } }));
      });
  }

  /** Saves a crashed run for a signed-in player, or offers the Google sign-in to a guest. Only the latest run reports back. */
  async function submit(run: FinishedRun, endedAt: number) {
    const mine = ++saveId.current;
    const current = () => mine === saveId.current;
    if (!run.token) { setSave({ kind: "unranked", reason: run.unranked ?? "ticket" }); return; }
    setSave({ kind: "idle" });
    const api = await loadOnline();
    if (!current()) return;
    const signedIn = api ? await api.signedIn().catch(() => null) : null;
    if (!current()) return;
    if (signedIn === null) { setSave({ kind: "error", message: OFFLINE, retry: { run, endedAt } }); return; }
    if (!signedIn || !api) { setSave({ kind: "guest", run, endedAt }); return; }
    setSave({ kind: "saving" });
    const result = await api.submitRun(run).catch(() => null);
    if (!current()) return;
    if (!result) setSave({ kind: "error", message: "Skor belum tersimpan karena koneksi terputus.", retry: { run, endedAt } });
    else if (result.ok) {
      setSave({ kind: "saved", result });
      fetchBoard("week", true); fetchBoard("all", true);
    } else if (result.code === "UNAUTHENTICATED") setSave({ kind: "guest", run, endedAt });
    else setSave({ kind: "error", message: result.message, retry: result.code === "TOO_EARLY" ? { run, endedAt } : undefined });
  }

  async function signIn() {
    if (save.kind !== "guest" || save.leaving) return;
    const { run, endedAt } = save;
    setSave({ kind: "guest", run, endedAt, leaving: true });
    const api = await loadOnline();
    const { error } = api ? await api.signInToSave(run, endedAt) : { error: OFFLINE };
    setSave({ kind: "guest", run, endedAt, error });
  }

  const onSnapshot = useEffectEvent((value: Snapshot) => {
    setSnapshot(value);
    if (value.phase === lastPhase.current) return;
    lastPhase.current = value.phase;
    if (value.phase === "paused" || value.phase === "over") fetchBoard(period);
  });

  const onFinish = useEffectEvent((run: FinishedRun) => { void submit(run, Date.now()); });

  const onReady = useEffectEvent((gone: () => boolean) => {
    void loadOnline().then((api) => {
      if (!api || gone()) return;
      stopTickets.current?.();
      stopTickets.current = api.keepTicketFresh();
      const kind = returning.current;
      returning.current = null;
      // Back from Google (or back from its page without signing in): show the run that was left behind, then save it.
      const pending = api.takePendingRun();
      if (!pending || !controller.current?.restore(pending)) {
        if (kind) setNotice(kind === "gagal" ? "Login Google belum berhasil. Main lagi, lalu coba simpan skornya." : "Skor tadi sudah lewat 30 menit, jadi tidak bisa disimpan. Main lagi, yuk!");
        return;
      }
      if (kind === "simpan") void submit(pending, pending.endedAt);
      else setSave({ kind: "guest", run: pending, endedAt: pending.endedAt, error: kind ? "Login Google belum berhasil. Coba lagi?" : "Skor tadi belum tersimpan. Masuk untuk menyimpannya." });
    });
  });

  // The skin is a per-browser preference, so it is read after hydration; the server renders the classic poster.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSkin(readSkin()));
    if (!hinted && process.env.NODE_ENV !== "test") {
      hinted = true;
      console.log(`%c${CONSOLE_DINO}`, "color:#1a73e8;font:12px/1.2 ui-monospace,monospace");
    }
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    reduced.current = !animated;
    controller.current?.setReduced(!animated);
  }, [animated]);

  // Google sends a guest back to /?skor=simpan#join (or ?skor=gagal): tidy the URL and bring the game into view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("skor");
    if (kind !== "simpan" && kind !== "gagal") return;
    returning.current = kind;
    params.delete("skor");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}#join`);
    const frame = requestAnimationFrame(() => arena.current?.scrollIntoView?.({ behavior: "instant", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, []);

  // A return notice lands above the invitation once the game has loaded, and scroll anchoring would push it up under
  // the header: line the arena up again so the notice is what the player sees first.
  useEffect(() => {
    if (!notice) return;
    const frame = requestAnimationFrame(() => arena.current?.scrollIntoView?.({ behavior: "instant", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [notice]);

  useEffect(() => {
    const element = arena.current;
    const screen = canvas.current;
    if (!element || !screen) return;
    let disposed = false;
    let loading = false;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      controller.current?.setVisible(visible);
      if (!visible || loading) return;
      loading = true;
      void import("@/lib/bogor-run/runtime")
        .then(({ mountRunner }) => {
          if (disposed) return;
          return mountRunner(screen, (value) => { if (!disposed) onSnapshot(value); }, reduced.current, {
            ticket: () => online?.takeTicket() ?? null,
            ticketPending: () => online?.ticketPending() ?? false,
            finish: (run) => { if (!disposed) onFinish(run); },
            skin: readSkin(),
          });
        })
        .then((runner) => {
          if (!runner) return;
          if (disposed) { runner.dispose(); return; }
          controller.current = runner;
          runner.setReduced(reduced.current);
          runner.setVisible(visible);
          setLoad("ready");
          onReady(() => disposed);
        })
        .catch(() => { if (!disposed) setLoad("error"); });
    }, { threshold: [0, 0.15] });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
      stopTickets.current?.();
      stopTickets.current = undefined;
    };
  }, [attempt]);

  // A page restored from the back/forward cache after leaving for Google never hears back from signInToSave.
  useEffect(() => {
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) setSave((current) => current.kind === "guest" && current.leaving ? { ...current, leaving: false } : current);
    };
    window.addEventListener("pageshow", shown);
    return () => window.removeEventListener("pageshow", shown);
  }, []);

  useEffect(() => {
    if (!playing && !wasPlaying.current) return;
    wasPlaying.current = playing;
    // Wait for the arena to take its playing size (it fits the screen under the header) before lining it up.
    const frame = requestAnimationFrame(() => {
      if (!playing) copy.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      arena.current?.scrollIntoView?.({ behavior: "instant", block: "start" });
    });
    if (!playing) return () => cancelAnimationFrame(frame);
    // Turning a phone mid-run resizes the arena (and pauses): line it up again. Height-only resizes are the mobile
    // toolbar showing or hiding, often while the player scrolls away, so they are left alone.
    lastWidth.current = window.innerWidth;
    let settle = 0;
    const resized = () => {
      if (window.innerWidth === lastWidth.current) return;
      lastWidth.current = window.innerWidth;
      cancelAnimationFrame(settle);
      settle = requestAnimationFrame(() => arena.current?.scrollIntoView?.({ behavior: "instant", block: "start" }));
    };
    window.addEventListener("resize", resized);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(settle); window.removeEventListener("resize", resized); };
  }, [playing]);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const label = phase === "running" ? "Lompat" : phase === "paused" ? "Lanjut main" : phase === "over" ? "Main lagi" : "Ikut main";
  const announcement = phase === "over"
    ? `${message} Skor ${score}. Rekor ${best}. Main lagi kalau mau.`
    : phase === "paused" ? "Permainan dijeda. Pilih Lanjut main untuk meneruskan."
    : phase === "running" ? "Sekarang giliranmu. Spasi atau panah atas untuk lompat, tahan panah bawah untuk menunduk. P untuk jeda."
    : "";
  const saveAnnouncement = phase === "idle" ? notice : phase !== "over" ? ""
    : save.kind === "saving" ? "Menyimpan skor."
    : save.kind === "saved" ? `${savedText(save.result)}.`
    : save.kind === "guest" ? save.error ?? "Skor belum tersimpan. Masuk dengan akun Google untuk menyimpannya."
    : save.kind === "error" ? save.message
    : save.kind === "unranked" ? UNRANKED[save.reason] : "";
  const summary = phase !== "over" ? "Lanjut kapan pun kamu siap." : finished ? `Kamu bertahan satu jam penuh: ${score} poin.` : `Kamu dapat ${score} poin.`;

  function focusGame() { action.current?.focus({ preventScroll: true }); }

  function takeAction() {
    const runner = controller.current;
    if (!runner) return;
    runner.unlock();
    if (runner.action() !== "start") return;
    // A fresh run: forget the last run's save and fingers. The runtime waits a moment for a ticket if none is ready.
    saveId.current += 1;
    duckPointers.current.clear();
    setSave({ kind: "idle" }); setNotice("");
    if (!hintShown.current && window.matchMedia?.("(pointer: coarse)").matches) {
      hintShown.current = true;
      setHint(true);
      hintTimer.current = setTimeout(() => setHint(false), HINT_MS);
    }
  }

  function releaseDuck(pointer: number) {
    if (duckPointers.current.delete(pointer) && !duckPointers.current.size) controller.current?.duck(false);
  }

  /**
   * Game keys work from anywhere in the arena, so a click on mute or a tab into the board never strands them. P and Esc
   * pause and resume from any control; jump and duck keys belong to the game button, and during a run to every game
   * control outside the board, whose tabs, list and links keep their own keys. Space keeps activating other buttons.
   */
  function onKey(event: React.KeyboardEvent<HTMLElement>) {
    const runner = controller.current;
    if (!runner || event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    const target = event.target as HTMLElement;
    if (key === "Escape" || key.toLowerCase() === "p") {
      if (phase !== "running" && phase !== "paused") return;
      event.preventDefault();
      if (event.repeat) return;
      runner.togglePause();
      if (phase === "paused") focusGame();
      return;
    }
    const game = target === action.current || (phase === "running" && !panel.current?.contains(target) && key !== " ");
    if (!game) return;
    if (key === " " || key === "ArrowUp") {
      event.preventDefault();
      if (!event.repeat) takeAction();
    } else if (key === "ArrowDown" && phase === "running") {
      event.preventDefault();
      runner.unlock();
      if (!event.repeat) runner.duck(true);
    }
  }

  function choosePeriod(next: Period) { setPeriod(next); fetchBoard(next); }

  const entries = shown?.board?.entries ?? [];
  const you = shown?.board?.you;
  const youListed = entries.some((entry) => entry.you);

  return (
    <div className={styles.world} data-playing={playing} data-panel={panelOpen}>
      <section
        ref={arena}
        className={styles.arena}
        aria-label="Bogor Run, Dino keliling Bogor"
        data-phase={phase}
        data-autoplay={autoplay}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) controller.current?.pause(); }}
        onKeyDown={onKey}
        onKeyUp={(event) => { if (event.key === "ArrowDown") controller.current?.duck(false); }}
        onMouseDown={(event) => {
          // A press on the scenery, the score or between the controls keeps focus in the game; its blur would pause the run.
          if (playing && !(event.target as Element).closest("button, a, [tabindex]")) event.preventDefault();
        }}
      >
        <div className={styles.scenery} aria-hidden="true" />
        <div className={styles.mist} aria-hidden="true" />
        {notice && !playing && <div className={`section-width ${styles.noticeRow}`}>
          <div className={styles.notice}>
            <p>{notice}</p>
            <button type="button" aria-label="Tutup pesan" onClick={() => { setNotice(""); focusGame(); }}>
              <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path d="M3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 9h2v2H9zM11 11h2v2h-2zM11 3h2v2h-2zM9 5h2v2H9zM5 9h2v2H5zM3 11h2v2H3z" /></svg>
            </button>
          </div>
        </div>}
        <div ref={copy} className={`section-width ${styles.invitation}`} inert={playing} aria-hidden={playing || undefined}>
          {invitation}
        </div>
        <div className={styles.poster} data-ready={load === "ready"} data-skin={skin} aria-hidden="true" />
        <canvas ref={canvas} className={styles.canvas} width="1600" height="640" aria-hidden="true" />

        {playing && <div className={`section-width ${styles.topbar}`}>
          <div className={styles.gameTitle}>
            <p className={styles.eyebrow}><span aria-hidden="true" />BOGOR RUN <span className={styles.edition}>/ 01</span></p>
            <h3>Dino keliling Bogor.</h3>
          </div>
          <button type="button" className={styles.back} onClick={() => controller.current?.leave()}>Kembali ke komunitas <span aria-hidden="true">↗</span></button>
        </div>}

        {playing && <>
          <div className={styles.hud} aria-label="Skor permainan">
            <span>SKOR <b data-flash={flash ? "" : undefined}>{number(flash || score)}</b></span><span>REKOR <b>{number(best)}</b></span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className={styles.tapArea}
            aria-label="Arena Bogor Run: ketuk bagian atas untuk lompat, tahan bagian bawah untuk menunduk"
            aria-describedby="bogor-run-controls"
            onPointerDown={(event) => {
              // While running, react on press for timing; otherwise wait for the click so a scroll swipe never restarts.
              if (phase !== "running" || (event.pointerType === "mouse" && event.button !== 0)) return;
              pressed.current = { active: true, at: event.timeStamp };
              const area = event.currentTarget.getBoundingClientRect();
              if (event.clientY > area.top + area.height / 2) {
                duckPointers.current.add(event.pointerId);
                controller.current?.duck(true);
                // Keeps pointerup coming here even if the finger slides off, so the crouch always ends.
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
              } else takeAction();
            }}
            onPointerUp={(event) => {
              if (pressed.current.active) pressed.current = { active: false, at: event.timeStamp };
              releaseDuck(event.pointerId);
              controller.current?.unlock();
            }}
            onPointerCancel={(event) => releaseDuck(event.pointerId)}
            onLostPointerCapture={(event) => releaseDuck(event.pointerId)}
            onMouseDown={(event) => event.preventDefault()} // keeps focus (and a held crouch) on the game button
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => {
              if (event.timeStamp - pressed.current.at > 500) takeAction();
              focusGame();
            }}
          />
          {hint && phase === "running" && <div className={styles.zones} aria-hidden="true">
            <span><b>↑ Ketuk di sini untuk lompat</b></span><span><b>↓ Tahan di sini untuk menunduk</b></span>
          </div>}
          {(phase === "paused" || phase === "over") && <div className={styles.result} aria-hidden="true"><p>{phase === "over" ? message : "Tarik napas dulu."}</p><span>{phase === "over" ? `${summary} Satu putaran lagi?` : summary}</span></div>}
        </>}

        <div className={`section-width ${styles.controls}`}>
          <div className={styles.actions}>
            <button
              ref={action}
              type="button"
              className={styles.action}
              disabled={load !== "ready"}
              aria-label={`${label}: Bogor Run`}
              aria-describedby="bogor-run-controls"
              onClick={takeAction}
              onBlur={() => controller.current?.duck(false)}
            >
              {load === "ready" ? label : load === "error" ? "Game belum termuat" : "Menyiapkan Dino…"}<Arrow diagonal />
            </button>
            <button
              type="button"
              className={styles.pause}
              disabled={load !== "ready" || (playing && phase === "over") || (!playing && !animated)}
              aria-label={playing ? (phase === "paused" ? "Lanjutkan permainan" : "Jeda permainan") : (autoplay ? "Jeda permainan otomatis" : "Lanjutkan permainan otomatis")}
              onClick={() => {
                if (playing) { controller.current?.togglePause(); focusGame(); }
                else controller.current?.toggleAutoplay();
              }}
            >
              {(playing ? phase === "paused" : !autoplay)
                ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z" /></svg>
                : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" /></svg>}
            </button>
            {playing && <>
              <button type="button" className={styles.pause} aria-label="Suara permainan" aria-pressed={sound} onClick={() => { controller.current?.setSound(!sound); focusGame(); }}>
                <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
                  <path d="M1 6h3v4H1zM4 5h1v6H4zM5 4h1v8H5zM6 3h2v10H6z" />
                  {sound
                    ? <path d="M10 6h1v4h-1zM12 4h1v8h-1zM14 2h1v12h-1z" />
                    : <path d="M10 5h1v1h-1zM14 5h1v1h-1zM11 6h1v1h-1zM13 6h1v1h-1zM12 7h1v2h-1zM11 9h1v1h-1zM13 9h1v1h-1zM10 10h1v1h-1zM14 10h1v1h-1z" />}
                </svg>
              </button>
              <button
                type="button"
                className={styles.pause}
                aria-label="Papan skor"
                aria-expanded={panelOpen}
                aria-controls={`${id}-board`}
                onClick={() => {
                  if (phase === "running") controller.current?.pause();
                  else { setClosed(panelOpen); if (!panelOpen) fetchBoard(period); }
                  focusGame(); // the game keys stay live, and P or Esc resumes
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
                  <path d="M4 2h8v6H4zM1 3h3v1H2v2h1v1h1v1H2V7H1zM12 3h3v4h-1v1h-2V7h1V6h1V4h-2zM5 8h6v1H5zM6 9h4v1H6zM7 10h2v2H7zM4 12h8v2H4z" />
                </svg>
              </button>
            </>}
          </div>
          <p id="bogor-run-controls" className={styles.instructions}>
            {playing
              ? <span><kbd>SPASI</kbd> / <kbd>↑</kbd> lompat, tahan <kbd>↓</kbd> untuk menunduk.</span>
              : <span><kbd>SPASI</kbd> / <kbd>↑</kbd> atau tap untuk lompat.</span>}
            <span>{playing ? <>Awas angkot, talas, genangan & elang jawa. <kbd>P</kbd> jeda.</> : autoplay ? "Dino main sendiri. Mau ikut?" : "Ambil alih, lalu kejar rekor sendiri."}</span>
          </p>
          {load === "error" && <button type="button" className={styles.retry} onClick={() => { setLoad("waiting"); setAttempt((value) => value + 1); }}>Muat ulang game</button>}
        </div>

        {playing && <section ref={panel} id={`${id}-board`} className={styles.panel} hidden={!panelOpen} aria-labelledby={`${id}-board-title`}>
          <div className={styles.summary}>
            <div className={styles.panelResult} aria-hidden="true">
              <p>{phase === "over" ? message : "Tarik napas dulu."}</p>
              <span>{summary}</span>
            </div>
            {phase === "over" && save.kind !== "idle" && <div className={styles.status} data-kind={save.kind}>
              {save.kind === "saving" && <p><span className={styles.dot} aria-hidden="true" />Menyimpan skor…</p>}
              {save.kind === "saved" && <p><span className={styles.dot} aria-hidden="true" />{savedText(save.result)}</p>}
              {save.kind === "unranked" && <p>{UNRANKED[save.reason]}</p>}
              {save.kind === "error" && <>
                <p>{save.message}</p>
                {save.retry && <button type="button" className={styles.link} onClick={() => save.retry && void submit(save.retry.run, save.retry.endedAt)}>Coba simpan lagi</button>}
              </>}
              {save.kind === "guest" && <>
                <button type="button" className={styles.signIn} disabled={save.leaving} onClick={() => void signIn()}>
                  {save.leaving ? "Membuka Google…" : "Masuk untuk simpan skor"}<Arrow diagonal />
                </button>
                <p className={styles.note}>{save.error ?? `Skor ${save.run.score} ikut tersimpan setelah login Google.`}</p>
              </>}
            </div>}
          </div>
          <div className={styles.boardHead}>
            <h4 id={`${id}-board-title`}>Papan skor</h4>
            <span>{period === "all" ? "Sejak awal" : shown?.board ? weekLabel(shown.board.key) : ""}</span>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Periode papan skor">
            {PERIODS.map(({ id: tab, label: name }) => <button
              key={tab}
              type="button"
              role="tab"
              id={`${id}-tab-${tab}`}
              aria-selected={period === tab}
              aria-controls={`${id}-list`}
              tabIndex={period === tab ? 0 : -1}
              onClick={() => choosePeriod(tab)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const at = PERIODS.findIndex((p) => p.id === tab), step = event.key === "ArrowLeft" ? -1 : 1;
                const next = PERIODS[event.key === "Home" ? 0 : event.key === "End" ? PERIODS.length - 1 : (at + step + PERIODS.length) % PERIODS.length];
                choosePeriod(next.id);
                document.getElementById(`${id}-tab-${next.id}`)?.focus();
              }}
            >{name}</button>)}
          </div>
          <div className={styles.list} role="tabpanel" id={`${id}-list`} aria-labelledby={`${id}-tab-${period}`} tabIndex={0} aria-busy={shown?.state === "loading" || undefined}>
            {!shown || shown.state === "loading" ? <p className={styles.empty}>Memuat papan skor…</p>
              : shown.state === "error" && !shown.board ? <p className={styles.empty}>Papan skor belum bisa dimuat. <button type="button" className={styles.link} onClick={() => fetchBoard(period, true)}>Coba lagi</button></p>
              : !entries.length ? <p className={styles.empty}>{period === "week" ? "Belum ada skor minggu ini. Jadilah yang pertama!" : "Belum ada skor tersimpan. Jadilah yang pertama!"}</p>
              : <ol>
                {entries.map((entry) => <li key={entry.id} data-you={entry.you || undefined}>
                  <span className={styles.rank}>{String(entry.rank).padStart(2, "0")}</span>
                  <span className={styles.name}>{entry.name}{entry.you && <em> · kamu</em>}</span>
                  <b>{entry.score}</b>
                </li>)}
              </ol>}
            {shown?.board?.signedIn && !youListed && <p className={styles.you}>
              {you ? <>Kamu <span>{you.hidden ? "disembunyikan admin" : `peringkat ${rankOf(you.rank)}`}</span><b>{you.score}</b></> : <>Kamu <span>belum ada skor {period === "week" ? "minggu ini" : "tersimpan"}</span></>}
            </p>}
          </div>
          <Link href="/dashboard/papan-skor" className={styles.more}>Lihat 100 besar <Arrow diagonal /></Link>
        </section>}

        <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
        <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{saveAnnouncement}</span>
      </section>
      <div className={styles.directory}>{children}</div>
    </div>
  );
}
