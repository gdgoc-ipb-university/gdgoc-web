export function Arrow({ diagonal = false, down = false }: { diagonal?: boolean; down?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      style={{ transform: diagonal ? "rotate(-45deg)" : down ? "rotate(90deg)" : undefined }}
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function PixelSpark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 28 28" fill="currentColor">
      <path d="M11 0h6v8h3v3h8v6h-8v3h-3v8h-6v-8H8v-3H0v-6h8V8h3z" />
    </svg>
  );
}

export function PixelDino() {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 30" fill="currentColor" shapeRendering="crispEdges">
      <path d="M14 0h12v2h2v10h-8v3h5v2h-7v4h-3v3h-2v6H9v-2h2v-4H7v4H3v-2h2v-5H3v-3H1V8h2v5h2v3h4v-3h3V2h2z" />
      <path fill="var(--paper, #faf9f2)" d="M16 3h2v2h-2zM20 10h8v2h-8z" />
    </svg>
  );
}
