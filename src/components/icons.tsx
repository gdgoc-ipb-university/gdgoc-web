import { PixelIcon } from "./pixel-icons";

/**
 * Pixelarticons arrows for links and buttons: `external` marks a link that leaves the site (a new tab, Google, GDG,
 * Instagram, WhatsApp), `down` points down the page, `download` saves a file; otherwise it points ahead.
 */
export function Arrow({ external = false, down = false, download = false, size = 24 }: { external?: boolean; down?: boolean; download?: boolean; size?: number }) {
  return <PixelIcon name={download ? "download" : external ? "external-link" : down ? "arrow-down" : "arrow-right"} size={size} />;
}

/** The Pixelarticons sparkle, for empty states and headings. */
export function PixelSpark({ className = "" }: { className?: string }) {
  return <PixelIcon name="sparkle" size={28} className={className} />;
}

export function PixelDino() {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 30" fill="currentColor" shapeRendering="crispEdges">
      <path d="M14 0h12v2h2v10h-8v3h5v2h-7v4h-3v3h-2v6H9v-2h2v-4H7v4H3v-2h2v-5H3v-3H1V8h2v5h2v3h4v-3h3V2h2z" />
      <path fill="var(--paper, #faf9f2)" d="M16 3h2v2h-2zM20 10h8v2h-8z" />
    </svg>
  );
}
