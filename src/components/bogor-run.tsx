"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useExperience } from "./experience-provider";
import { Arrow } from "./icons";
import type { Runner, Snapshot } from "@/lib/bogor-run/runtime";
import styles from "./bogor-run.module.css";

const initial: Snapshot = { phase: "idle", score: 0, best: 0, message: "", autoplay: false };
const number = (value: number) => String(value).padStart(3, "0");

export function BogorRun({ invitation, children }: { invitation?: ReactNode; children?: ReactNode }) {
  const { animated } = useExperience();
  const arena = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const wasPlaying = useRef(false);
  const action = useRef<HTMLButtonElement>(null);
  const controller = useRef<Runner | null>(null);
  const reduced = useRef(!animated);
  const [snapshot, setSnapshot] = useState(initial);
  const [load, setLoad] = useState<"waiting" | "ready" | "error">("waiting");
  const [attempt, setAttempt] = useState(0);
  const { phase, score, best, message, autoplay } = snapshot;
  const playing = phase !== "idle";

  useEffect(() => {
    reduced.current = !animated;
    controller.current?.setReduced(!animated);
  }, [animated]);

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
          return mountRunner(screen, (value) => { if (!disposed) setSnapshot(value); }, reduced.current);
        })
        .then((runner) => {
          if (!runner) return;
          if (disposed) { runner.dispose(); return; }
          controller.current = runner;
          runner.setReduced(reduced.current);
          runner.setVisible(visible);
          setLoad("ready");
        })
        .catch(() => { if (!disposed) setLoad("error"); });
    }, { threshold: [0, 0.15] });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (!playing && !wasPlaying.current) return;
    wasPlaying.current = playing;
    // Wait for the compact mobile arena to lay out before positioning its controls.
    const frame = requestAnimationFrame(() => {
      if (!playing) copy.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      arena.current?.scrollIntoView?.({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const label = phase === "running" ? "Lompat" : phase === "paused" ? "Lanjut main" : phase === "over" ? "Main lagi" : "Ikut main";
  const announcement = phase === "over"
    ? `${message} Skor ${score}. Rekor ${best}. Main lagi kalau mau.`
    : phase === "paused" ? "Permainan dijeda. Pilih Lanjut main untuk meneruskan."
    : phase === "running" ? "Sekarang giliranmu. Spasi atau panah atas untuk lompat. P untuk jeda."
    : "";

  function focusGame() { action.current?.focus({ preventScroll: true }); }
  function takeAction() { controller.current?.action(); }

  return (
    <div className={styles.world} data-playing={playing}>
      <section
        ref={arena}
        className={styles.arena}
        aria-label="Bogor Run, Dino keliling Bogor"
        data-phase={phase}
        data-autoplay={autoplay}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) controller.current?.pause(); }}
      >
        <div className={styles.scenery} aria-hidden="true" />
        <div className={styles.mist} aria-hidden="true" />
        <div ref={copy} className={`section-width ${styles.invitation}`} inert={playing} aria-hidden={playing || undefined}>
          {invitation}
        </div>
        <div className={styles.poster} data-ready={load === "ready"} aria-hidden="true" />
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
            <span>SKOR <b>{number(score)}</b></span><span>REKOR <b>{number(best)}</b></span>
          </div>
          <button type="button" tabIndex={-1} className={styles.tapArea} aria-label="Lompat di arena: Bogor Run" aria-describedby="bogor-run-controls" onClick={() => { takeAction(); focusGame(); }} />
          {phase !== "running" && <div className={styles.result} aria-hidden="true"><p>{phase === "over" ? message : "Tarik napas dulu."}</p><span>{phase === "over" ? `Kamu dapat ${score} poin. Satu putaran lagi?` : "Lanjut kapan pun kamu siap."}</span></div>}
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
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!event.repeat) takeAction();
                }
                if (event.key.toLowerCase() === "p" || event.key === "Escape") {
                  event.preventDefault();
                  if (!event.repeat) controller.current?.togglePause();
                }
              }}
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
          </div>
          <p id="bogor-run-controls" className={styles.instructions}>
            <span><kbd>SPASI</kbd> / <kbd>↑</kbd> atau tap untuk lompat.</span>
            <span>{playing ? <>Lewati angkot, talas & genangan. <kbd>P</kbd> jeda.</> : autoplay ? "Dino main sendiri. Mau ikut?" : "Ambil alih, lalu kejar rekor sendiri."}</span>
          </p>
          {load === "error" && <button type="button" className={styles.retry} onClick={() => { setLoad("waiting"); setAttempt((value) => value + 1); }}>Muat ulang game</button>}
        </div>
        <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
      </section>
      <div className={styles.directory}>{children}</div>
    </div>
  );
}
