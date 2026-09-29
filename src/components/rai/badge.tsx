import type { CSSProperties } from "react";

/**
 * The Tier Gemini Rising Star badge, redrawn as SVG for the /rai easter egg: a white enamel rim with curved type, a
 * glassy dome, and the Bogor Run dino in Google Blue. The dino is the standing frame of dino.svg on its 2-unit grid
 * (o outline, h highlight, c body, s shade), so it is the same character as the one in the footer game.
 */
const DINO = [
  "...........oooooooooo.",
  "..........ohhhhhhhhhho",
  ".........ohcccccccccso",
  ".........ohcecccccccso",
  ".........ohcecccccccso",
  ".........ohcccccccccso",
  ".........ohcccccccccso",
  ".........ohccccccooooo",
  ".........ohcccssssssso",
  ".........ohcccsooooooo",
  ".......oocccccso......",
  "......ohccccccsooo....",
  ".....ohccccccccccoo...",
  "o....ohccccccccccco...",
  "oo..ohccccccccsoooo...",
  "ohoohcccccccccso......",
  ".occcccccccccsso......",
  "..ooccccccccsso.......",
  "....oosssssssoo.......",
  "......oooooooso.......",
  "......occo..oso.......",
  "......occoo.osooo.....",
  "......ooooo.ooooo.....",
];
/** A chunky pixel star; each row is a run-length friendly grid, merged into one path. */
const STAR = [
  "......#......",
  ".....###.....",
  ".....###.....",
  "....#####....",
  "#############",
  ".###########.",
  "..#########..",
  "...#######...",
  "...###.###...",
  "..###...###..",
  "..##.....##..",
  ".##.......##.",
];
export function starPath(cell: number, left = 0, top = 0) {
  return STAR.flatMap((row, y) => [...row.matchAll(/#+/g)].map((run) => `M${left + (run.index ?? 0) * cell} ${top + y * cell}h${run[0].length * cell}v${cell}h-${run[0].length * cell}z`)).join("");
}

const CELL = 9;
const DINO_X = 96;
const DINO_Y = 92;
const FILL: Record<string, string> = { o: "#0b3d91", h: "#d2e3fc", c: "url(#rai-dino-glass)", s: "#185abc" };

/** Scatter for the reveal: every cell flies in from its own spot, the same on every render. */
function scatter(index: number): CSSProperties {
  const hash = Math.imul(index + 1, 2654435761) >>> 0;
  const dx = ((hash & 1023) / 1023 - 0.5) * 460;
  const dy = (((hash >>> 10) & 1023) / 1023 - 0.5) * 460;
  return { "--dx": `${dx.toFixed(1)}px`, "--dy": `${dy.toFixed(1)}px`, "--delay": `${((index % 19) / 19 * 0.5).toFixed(3)}s` } as CSSProperties;
}

const cells = DINO.flatMap((row, y) => [...row].flatMap((kind, x) => (kind === "." || kind === "e" ? [] : [{ kind, x, y }])));
const text = { fontFamily: "var(--font-body), Poppins, sans-serif", fontWeight: 600 } as const;

export function BadgeFront({ pixelClass, eyeClass, dinoClass, sparkClass }: { pixelClass: string; eyeClass: string; dinoClass: string; sparkClass: string }) {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-labelledby="rai-badge-title">
      <title id="rai-badge-title">Lencana Rising Star: dino biru dari piksel di dalam kubah kaca, dikelilingi tulisan #TEAMGOOGLE, Google Student Ambassador, dan Rising Star</title>
      <defs>
        <radialGradient id="rai-rim" cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f1f6ff" />
          <stop offset="1" stopColor="#d6e5fd" />
        </radialGradient>
        <radialGradient id="rai-dome" cx="0.42" cy="0.36" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#e4eefe" />
          <stop offset="1" stopColor="#a9c8fa" />
        </radialGradient>
        <linearGradient id="rai-dino-glass" gradientUnits="userSpaceOnUse" x1="120" y1="95" x2="260" y2="300">
          <stop offset="0" stopColor="#aecbfa" />
          <stop offset="0.4" stopColor="#669df6" />
          <stop offset="1" stopColor="#1a73e8" />
        </linearGradient>
        <pattern id="rai-grid" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0V14" fill="none" stroke="#8ab4f8" strokeWidth="1" />
        </pattern>
        <clipPath id="rai-dome-clip"><circle cx="200" cy="200" r="146" /></clipPath>
        {/* A white halo around the pixels, like the badge's enamel outline. */}
        <filter id="rai-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="grown" />
          <feFlood floodColor="#ffffff" />
          <feComposite in2="grown" operator="in" result="halo" />
          <feGaussianBlur in="halo" stdDeviation="1.5" result="soft" />
          <feMerge><feMergeNode in="soft" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rai-blur"><feGaussianBlur stdDeviation="6" /></filter>
        <path id="rai-arc-top" d="M 42 200 A 158 158 0 0 1 358 200" />
        <path id="rai-arc-bottom" d="M 18 200 A 182 182 0 0 0 382 200" />
        <path id="rai-arc-inner" d="M 245 317 A 125 125 0 0 0 302 128" />
      </defs>

      <circle cx="200" cy="200" r="197" fill="url(#rai-rim)" stroke="#aecbfa" strokeWidth="3" />
      <circle cx="200" cy="200" r="190" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
      <text style={{ ...text, fontSize: 27, letterSpacing: 3 }} fill="#1a73e8"><textPath href="#rai-arc-top" startOffset="40%" textAnchor="middle">#TEAMGOOGLE</textPath></text>
      <text style={{ ...text, fontSize: 22, letterSpacing: 1.6 }} fill="#1a73e8"><textPath href="#rai-arc-bottom" startOffset="57%" textAnchor="middle">GOOGLE STUDENT AMBASSADOR</textPath></text>

      <circle cx="200" cy="200" r="150" fill="#ffffff" stroke="#c6dafc" strokeWidth="4" />
      <g clipPath="url(#rai-dome-clip)">
        <circle cx="200" cy="200" r="146" fill="url(#rai-dome)" />
        <rect x="54" y="54" width="292" height="292" fill="url(#rai-grid)" opacity="0.28" />
        <ellipse cx="200" cy="318" rx="92" ry="20" fill="#4285f4" opacity="0.14" />
      </g>
      <text style={{ ...text, fontSize: 19, letterSpacing: 2.4, fontWeight: 700 }} fill="#1a73e8"><textPath href="#rai-arc-inner" startOffset="50%" textAnchor="middle">RISING STAR</textPath></text>

      <g className={sparkClass} stroke="#1a73e8" strokeWidth="6" strokeLinecap="round">
        <path d="M 300 120 L 318 96" />
        <path d="M 312 152 L 340 150" />
      </g>

      <g className={dinoClass} filter="url(#rai-glow)">
        {cells.map(({ kind, x, y }, index) => (
          <rect key={`${x}-${y}`} className={pixelClass} style={scatter(index)} x={DINO_X + x * CELL} y={DINO_Y + y * CELL} width={CELL + 0.4} height={CELL + 0.4} fill={FILL[kind]} />
        ))}
        {/* The eye blinks on its own element; everything else stays still. */}
        <rect className={eyeClass} x={DINO_X + 12 * CELL} y={DINO_Y + 3 * CELL} width={CELL} height={CELL * 2} fill="#0b3d91" />
      </g>

      {/* Glass: a soft highlight across the upper-left of the dome, above the dino. */}
      <g clipPath="url(#rai-dome-clip)" pointerEvents="none">
        <ellipse cx="150" cy="118" rx="92" ry="46" fill="#ffffff" opacity="0.38" filter="url(#rai-blur)" transform="rotate(-28 150 118)" />
        <path d="M 96 160 A 110 110 0 0 1 168 86" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
      </g>
    </svg>
  );
}

export function BadgeBack() {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-labelledby="rai-back-title">
      <title id="rai-back-title">Sisi belakang lencana: bintang piksel kuning dan tulisan GDGoC IPB University, Bogor</title>
      <defs>
        <radialGradient id="rai-back-disc" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="1" stopColor="#174ea6" />
        </radialGradient>
        <path id="rai-back-top" d="M 42 200 A 158 158 0 0 1 358 200" />
        <path id="rai-back-bottom" d="M 18 200 A 182 182 0 0 0 382 200" />
      </defs>
      <circle cx="200" cy="200" r="197" fill="#f1f6ff" stroke="#aecbfa" strokeWidth="3" />
      <text style={{ ...text, fontSize: 24, letterSpacing: 3 }} fill="#1a73e8"><textPath href="#rai-back-top" startOffset="50%" textAnchor="middle">GDGOC IPB UNIVERSITY</textPath></text>
      <text style={{ ...text, fontSize: 22, letterSpacing: 3 }} fill="#1a73e8"><textPath href="#rai-back-bottom" startOffset="50%" textAnchor="middle">BOGOR · 2026</textPath></text>
      <circle cx="200" cy="200" r="150" fill="url(#rai-back-disc)" stroke="#c6dafc" strokeWidth="4" />
      {/* A chunky pixel star on the same 9-unit grid as the dino. */}
      <path fill="#fbbc05" stroke="#0b3d91" strokeWidth="3" paintOrder="stroke" d={starPath(11, 128.5, 102)} />
      <text x="200" y="296" textAnchor="middle" style={{ fontFamily: "var(--font-pixel), monospace", fontSize: 30 }} fill="#ffffff">/rai</text>
      <text x="200" y="322" textAnchor="middle" style={{ ...text, fontSize: 11, letterSpacing: 1.5, fontWeight: 500 }} fill="#d2e3fc">KAMU MENEMUKANNYA</text>
    </svg>
  );
}
