"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import type { Runner, Snapshot } from "@/lib/bogor-run/runtime";
import styles from "./bogor-run.module.css";

const initial: Snapshot = { phase: "idle", score: 0, best: 0, message: "" };
const number = (value: number) => String(value).padStart(3, "0");

export function BogorRun() {
  const { animated } = useExperience();
  const host = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const controller = useRef<Runner | null>(null);
  const reduced = useRef(!animated);
  const [snapshot, setSnapshot] = useState(initial);
  const [load, setLoad] = useState<"waiting" | "ready" | "error">("waiting");
  const [attempt, setAttempt] = useState(0);
  const { phase, score, best, message } = snapshot;

  useEffect(() => {
    reduced.current = !animated;
    controller.current?.setReduced(!animated);
  }, [animated]);

  useEffect(() => {
    const element = host.current;
    const screen = canvas.current;
    if (!element || !screen) return;
    let disposed = false;
    let loading = false;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      if (!visible) { controller.current?.pause(); return; }
      if (loading) return;
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
          if (!visible) runner.pause();
          setLoad("ready");
        })
        .catch(() => { if (!disposed) setLoad("error"); });
    }, { threshold: [0, 0.15] });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); controller.current?.dispose(); controller.current = null; };
  }, [attempt]);

  const label = phase === "running" ? "Lompat" : phase === "paused" ? "Lanjut main" : phase === "over" ? "Main lagi" : "Mulai main";
  const announcement = phase === "over" ? `${message} Skor ${score}. Rekor ${best}. Main lagi kalau mau.` : phase === "paused" ? "Permainan dijeda. Pilih Lanjut main untuk meneruskan." : phase === "running" ? "Permainan dimulai. Spasi atau panah atas untuk lompat. P untuk jeda." : "";

  function focusGame() { stage.current?.focus({ preventScroll: true }); }

  return <section ref={host} className={styles.game} aria-labelledby="bogor-run-title" data-phase={phase} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) controller.current?.pause(); }}>
    <div className={styles.heading}><div><p className={styles.eyebrow}><span aria-hidden="true"/>REHAT SEBENTAR</p><h3 id="bogor-run-title">Dino keliling Bogor.</h3></div><span className={styles.edition} aria-hidden="true">BGR<br/>01</span></div>
    <div className={styles.console}>
      <div className={styles.hud}><span>SKOR <b>{number(score)}</b></span><span>REKOR <b>{number(best)}</b></span><button type="button" aria-label={phase === "paused" ? "Lanjutkan permainan" : "Jeda permainan"} disabled={phase !== "running" && phase !== "paused"} onClick={() => { controller.current?.togglePause(); focusGame(); }}>{phase === "paused" ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z"/></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>}</button></div>
      <button ref={stage} type="button" className={styles.stage} disabled={load !== "ready"} aria-label={`${label}: Bogor Run`} aria-describedby="bogor-run-controls" data-ready={load === "ready"} onClick={() => controller.current?.action()} onKeyDown={(event) => {
        if (event.key === " " || event.key === "ArrowUp") { event.preventDefault(); if (!event.repeat) controller.current?.action(); }
        if (event.key.toLowerCase() === "p" || event.key === "Escape") { event.preventDefault(); if (!event.repeat) controller.current?.togglePause(); }
      }}>
        <span className={styles.poster} aria-hidden="true"/>
        <canvas ref={canvas} width="960" height="460" aria-hidden="true" />
        {phase !== "running" && <span className={styles.overlay} aria-hidden="true">{phase === "over" && <strong>{message}</strong>}{phase === "paused" && <strong>Tarik napas dulu.</strong>}<span>{load === "ready" ? label : load === "error" ? "Game belum termuat" : "Menyiapkan game…"}<span className={styles.play} aria-hidden="true">↗</span></span></span>}
      </button>
    </div>
    <div className={styles.instructions} id="bogor-run-controls"><span><kbd>SPASI</kbd> / <kbd>↑</kbd> atau tap untuk lompat.</span><span>Hindari angkot, talas & genangan. <kbd>P</kbd> jeda.</span></div>
    {load === "error" && <button type="button" className={styles.retry} onClick={() => { setLoad("waiting"); setAttempt((value) => value + 1); }}>Muat ulang game</button>}
    <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </section>;
}
