"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useExperience } from "@/components/experience-provider";
import { createSound, readSoundEnabled, type Sound } from "@/lib/bogor-run/sound";
import { readSkin, writeSkin } from "@/lib/bogor-run/skin";
import { BadgeBack, BadgeFront, starPath } from "./badge";
import styles from "./rising-star.module.css";
import { PixelIcon } from "@/components/pixel-icons";
import { Arrow } from "@/components/icons";

type Stage = "sealed" | "opening" | "open";
const REVEAL_MS = 1700;
const JUMP_MS = 560;
const EDGES = 12; // stacked discs that give the coin its thickness
const COLORS = ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "#ffffff"];

// Twinkling pixel stars at fixed spots, so server and client render the same sky.
const STARS = Array.from({ length: 28 }, (_, i) => {
  const hash = Math.imul(i + 7, 2246822519) >>> 0;
  return { left: `${(hash % 1000) / 10}%`, top: `${((hash >>> 10) % 1000) / 10}%`, size: 2 + (hash >>> 20) % 3, delay: `${((hash >>> 12) % 40) / 10}s` };
});
const CONFETTI = Array.from({ length: 40 }, (_, i) => {
  const hash = Math.imul(i + 3, 2654435761) >>> 0;
  const angle = (i / 40) * Math.PI * 2 + ((hash & 255) / 255) * 0.4;
  const reach = 150 + (hash >>> 8) % 170;
  return { "--tx": `${Math.round(Math.cos(angle) * reach)}px`, "--ty": `${Math.round(Math.sin(angle) * reach)}px`, "--spin": `${(hash >>> 16) % 540}deg`, background: COLORS[i % COLORS.length], animationDelay: `${((hash >>> 4) % 25) / 100}s` } as CSSProperties;
});

export function RisingStar() {
  const { animated } = useExperience();
  const [stage, setStage] = useState<Stage>("sealed");
  const [jumping, setJumping] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [equipped, setEquipped] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [status, setStatus] = useState("");
  const sound = useRef<Sound | null>(null);
  const coin = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);
  const open = stage !== "sealed";
  // The gate owns the page heading until it leaves; then the badge's title takes over as the h1.
  const Title = stage === "open" ? "h1" : "h2";

  useEffect(() => {
    sound.current = createSound();
    const frame = requestAnimationFrame(() => { setEquipped(readSkin() === "rising-star"); setSoundOn(readSoundEnabled()); });
    const pending = timers.current;
    return () => { cancelAnimationFrame(frame); pending.forEach(clearTimeout); sound.current?.dispose(); sound.current = null; };
  }, []);

  function later(ms: number, task: () => void) { timers.current.push(window.setTimeout(task, ms)); }

  function reveal() {
    if (open) return;
    sound.current?.unlock();
    // The context resumes asynchronously inside the gesture; the fanfare lands as the badge appears.
    later(animated ? 380 : 60, () => sound.current?.play("fanfare"));
    setStatus("Rahasia terbuka: lencana Rising Star dengan dino biru.");
    if (!animated) { setStage("open"); later(0, () => heading.current?.focus()); return; }
    setStage("opening");
    later(REVEAL_MS, () => { setStage("open"); heading.current?.focus({ preventScroll: true }); });
  }

  function jump() {
    if (!open || jumping) return;
    sound.current?.unlock();
    sound.current?.play("jump");
    setJumping(true);
    later(JUMP_MS, () => setJumping(false));
  }

  // Space or ↑ anywhere on the page jumps the dino, unless a control has focus (it keeps its own keys).
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "ArrowUp") return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a, input")) return;
      event.preventDefault();
      if (!event.repeat) jump();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  function tilt(event: PointerEvent<HTMLDivElement>) {
    const element = coin.current;
    if (!element || (event.pointerType !== "mouse" && event.buttons === 0)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    element.style.setProperty("--ry", `${((x - 0.5) * 34).toFixed(2)}deg`);
    element.style.setProperty("--rx", `${((0.5 - y) * 30).toFixed(2)}deg`);
    element.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    element.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    element.dataset.tilting = "true";
  }

  function settle() {
    const element = coin.current;
    if (!element) return;
    for (const name of ["--rx", "--ry", "--mx", "--my"]) element.style.removeProperty(name);
    delete element.dataset.tilting;
  }

  function toggleSkin() {
    const next = !equipped;
    writeSkin(next ? "rising-star" : "classic");
    setEquipped(next);
    setStatus(next ? "Dino biru dipasang di Bogor Run." : "Bogor Run kembali memakai dino krem.");
  }

  function toggleSound() {
    const next = !soundOn;
    sound.current?.setEnabled(next);
    setSoundOn(next);
  }

  return (
    <main className={styles.page} data-stage={stage} data-animated={animated}>
      <div className={styles.sky} aria-hidden="true">
        <svg className={styles.swoosh} viewBox="0 0 1600 900" preserveAspectRatio="none">
          <path d="M0 250 C 380 330 700 470 820 560 C 560 500 250 560 0 720 Z" />
          <path d="M1600 170 C 1250 250 980 420 880 520 C 1120 470 1380 520 1600 640 Z" />
        </svg>
        <div className={styles.dots} />
        <div className={styles.shade} />
        {STARS.map((star, i) => <span key={i} className={styles.twinkle} style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay }} />)}
      </div>

      <Link className={styles.home} href="/"><PixelIcon name="arrow-left" size={24} />Beranda</Link>

      {stage !== "open" && (
        <section className={styles.gate} aria-labelledby="rai-gate">
          <p className={styles.eyebrow}>GDGOC IPB · ???</p>
          <h1 id="rai-gate" className={styles.whisper}>Psst… kamu menemukan jalan rahasia.</h1>
          <button type="button" className={styles.star} onClick={reveal} aria-label="Buka rahasianya" disabled={open}>
            <svg viewBox="0 0 130 120" aria-hidden="true"><path d={starPath(10)} /></svg>
          </button>
          <p className={styles.hint}>Ketuk bintangnya</p>
        </section>
      )}

      <section className={styles.stage} aria-labelledby="rai-title" hidden={!open}>
        <div className={styles.scene} onPointerMove={tilt} onPointerLeave={settle} onPointerUp={settle} onPointerCancel={settle}>
          <div className={styles.floater}>
          <div ref={coin} className={styles.coin} data-flipped={flipped}>
            {Array.from({ length: EDGES }, (_, i) => <div key={i} className={styles.edge} style={{ "--i": i } as CSSProperties} aria-hidden="true" />)}
            <div className={styles.front} aria-hidden={flipped || undefined}>
              <BadgeFront pixelClass={styles.pixel} eyeClass={styles.eye} dinoClass={jumping ? `${styles.dino} ${styles.jump}` : styles.dino} sparkClass={styles.spark} />
              <div className={styles.sheen} aria-hidden="true" />
              <button type="button" className={styles.dinoHit} onClick={jump} aria-label="Lompatkan dino biru" tabIndex={flipped ? -1 : 0} />
            </div>
            <div className={styles.back} aria-hidden={!flipped || undefined}><BadgeBack /><div className={styles.sheen} aria-hidden="true" /></div>
          </div>
          </div>
          {stage === "opening" && <div className={styles.confetti} aria-hidden="true">{CONFETTI.map((style, i) => <span key={i} style={style} />)}</div>}
        </div>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>RAHASIA TERBUKA · /RAI</p>
          <Title id="rai-title" ref={heading} className={styles.title} tabIndex={-1}>Rising Star.</Title>
          <p className={styles.lead}>Lencana Tier Gemini Rising Star dari Google Student Ambassador, versi GDGoC IPB. Dino birunya ikut keluar dari lencana, dan boleh kamu ajak lari di Bogor Run.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} aria-pressed={equipped} onClick={toggleSkin}>
              {equipped ? <>Dino biru terpasang <PixelIcon name="check" size={24} /></> : "Pakai dino biru di Bogor Run"}
            </button>
            <Link className={styles.secondary} href="/#join">Main Bogor Run <Arrow /></Link>
          </div>
          <div className={styles.tools}>
            <button type="button" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>Balik lencana</button>
            <button type="button" aria-pressed={soundOn} onClick={toggleSound}>{soundOn ? "Suara nyala" : "Suara mati"}</button>
          </div>
          <p className={styles.tip}>Ketuk dinonya atau tekan <kbd>Spasi</kbd> untuk melompat. Gerakkan kursor atau geser lencananya untuk memiringkan.</p>
          <p className={styles.credit}>Lencana penghormatan buatan GDGoC IPB, terinspirasi lencana Tier Gemini Rising Star program Google Student Ambassador. Bukan lencana resmi Google.</p>
        </div>
      </section>
      <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
    </main>
  );
}
