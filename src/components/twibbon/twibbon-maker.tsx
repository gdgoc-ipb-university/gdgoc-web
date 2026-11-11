"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import {
  clampPlacement, initialPlacement, isInAppBrowser, isMobileBrowser, photoRect, twibbon, twibbonCaption, type CaptionFields, type ImageSize, type Placement,
} from "@/lib/twibbon";
import { PixelIcon } from "../pixel-icons";

/** A chosen photo, decoded once and upright (EXIF rotation applied). It never leaves the browser. */
type Photo = ImageSize & { bitmap: ImageBitmap };

const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 25 * 1024 * 1024;

async function openPhoto(file: File): Promise<Photo | string> {
  if (!photoTypes.includes(file.type)) return "Gunakan foto JPG, PNG, atau WebP.";
  if (file.size > maxBytes) return "Ukuran foto maksimal 25 MB.";
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    return "Foto ini tidak bisa dibuka. Coba foto lain.";
  }
}

/** The photo under the frame at full size, on white wherever the photo does not reach. */
function compose(canvas: HTMLCanvasElement, frame: HTMLImageElement | null, photo: Photo | null, place: Placement) {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.fillStyle = twibbon.background;
  g.fillRect(0, 0, twibbon.width, twibbon.height);
  if (photo) {
    const rect = photoRect(photo, place);
    g.imageSmoothingQuality = "high";
    g.drawImage(photo.bitmap, rect.left, rect.top, rect.width, rect.height);
  }
  if (frame) g.drawImage(frame, 0, 0, twibbon.width, twibbon.height);
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Touch screens and phone browsers, where the share sheet is how a picture reaches the gallery. Desktops keep the download. */
const touchDevice = () => Boolean(window.matchMedia?.("(pointer: coarse)").matches) || isMobileBrowser(navigator.userAgent);

/**
 * Saves an image (#219). On a phone it goes to the share sheet, whose "Simpan gambar" puts it in the gallery: in-app and
 * older browsers drop a `blob:` download without a word, and iOS files a download under Files. Closing the sheet is the
 * member's choice, not an error. Where sharing is unavailable or fails, the image downloads as before.
 */
async function deliver(blob: Blob, name: string) {
  const files = [new File([blob], name, { type: blob.type })];
  if (touchDevice() && navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; } catch (error) { if ((error as Error).name === "AbortError") return; }
  }
  save(blob, name);
}

const noStore = () => () => {};

/**
 * Puts a photo under the 2026/27 member frame (#203): choose or drop a photo, drag it (or use the arrow keys) and zoom,
 * then download a 1080 × 1440 JPEG. The second slide and a caption to copy sit beside it.
 */
export function TwibbonMaker() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [frame, setFrame] = useState<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [place, setPlace] = useState<Placement>(initialPlacement);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** What was saved, shown so a long press can save it where the download or share did not (#219). */
  const [result, setResult] = useState<string | null>(null);
  const [slideShown, setSlideShown] = useState(false);
  const [touch, setTouch] = useState(false);
  const inApp = useSyncExternalStore(noStore, () => isInAppBrowser(navigator.userAgent), () => false);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setFrame(image);
    image.src = twibbon.frame;
  }, []);

  useEffect(() => {
    if (canvas.current) compose(canvas.current, frame, photo, place);
  }, [frame, photo, place]);

  useEffect(() => () => photo?.bitmap.close(), [photo]);
  // The finished twibbon's object URL lives while it is shown: until the photo moves or changes, or the page closes.
  useEffect(() => () => { if (result) URL.revokeObjectURL(result); }, [result]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    const opened = await openPhoto(file);
    if (typeof opened === "string") { setError(opened); return; }
    setPhoto(opened);
    setPlace(initialPlacement);
    setResult(null);
  }

  const update = (next: Placement) => { if (photo) { setPlace(clampPlacement(photo, next)); setResult(null); } };
  /** Canvas pixels per screen pixel, since the canvas is shown smaller than its 1080 px width. */
  const ratio = () => twibbon.width / (canvas.current?.getBoundingClientRect().width || twibbon.width);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (!photo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const last = drag.current;
    if (!last || last.id !== event.pointerId) return;
    drag.current = { id: last.id, x: event.clientX, y: event.clientY };
    const scale = ratio();
    update({ ...place, x: place.x + (event.clientX - last.x) * scale, y: place.y + (event.clientY - last.y) * scale });
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 100 : 20;
    const moves: Record<string, Partial<Placement>> = {
      ArrowLeft: { x: place.x - step }, ArrowRight: { x: place.x + step }, ArrowUp: { y: place.y - step }, ArrowDown: { y: place.y + step },
      "+": { zoom: place.zoom + .1 }, "=": { zoom: place.zoom + .1 }, "-": { zoom: place.zoom - .1 },
    };
    if (!photo || !moves[event.key]) return;
    event.preventDefault();
    update({ ...place, ...moves[event.key] });
  }
  function dropped(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void choose(event.dataTransfer.files[0]);
  }

  function download() {
    const target = canvas.current;
    if (!target || !photo) return;
    setBusy(true);
    setError("");
    target.toBlob(async (blob) => {
      if (!blob) { setBusy(false); setError("Twibbon belum bisa diunduh di browser ini. Coba browser lain."); return; }
      setResult(URL.createObjectURL(blob));
      setTouch(touchDevice());
      try { await deliver(blob, twibbon.fileName); } finally { setBusy(false); }
    }, "image/jpeg", .92);
  }

  /** The second slide is a plain file, so the link downloads it, unless a phone can share it to the gallery instead. */
  async function downloadSlide(event: MouseEvent<HTMLAnchorElement>) {
    setSlideShown(true);
    setTouch(touchDevice());
    if (!touchDevice() || typeof navigator.canShare !== "function") return;
    event.preventDefault();
    try {
      const response = await fetch(twibbon.slide);
      if (!response.ok) throw new Error(response.statusText);
      await deliver(await response.blob(), twibbon.slideFileName);
    } catch {
      setError("Slide 2 belum bisa diunduh. Tekan lama gambarnya di bawah, lalu Simpan.");
    }
  }

  return <div className="twibbon-maker">
    <div className="twibbon-stage">
      <div className="twibbon-canvas" data-photo={Boolean(photo)} tabIndex={photo ? 0 : -1} role="group" aria-label="Pratinjau twibbon"
        aria-describedby="twibbon-hint" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }} onKeyDown={key} onDragOver={(event) => event.preventDefault()} onDrop={dropped}>
        <canvas ref={canvas} width={twibbon.width} height={twibbon.height} aria-hidden="true" />
        {!photo && <button type="button" className="twibbon-empty" onClick={() => input.current?.click()}>
          <PixelIcon name="image" size={24} /> Pilih foto
        </button>}
      </div>
      <p id="twibbon-hint" className="league-note">{photo
        ? "Geser foto agar wajahmu pas di dalam bingkai, dan perkecil kalau ingin seluruh foto terlihat. Di keyboard, pakai tombol panah untuk menggeser, serta + dan - untuk memperbesar atau memperkecil."
        : "Pilih atau seret foto ke sini. Foto diproses di perangkatmu dan tidak diunggah."}</p>
      <label className="twibbon-zoom">
        <span>Ukuran foto</span>
        <input type="range" min={twibbon.minZoom} max={twibbon.maxZoom} step={.01} value={place.zoom} disabled={!photo}
          aria-valuetext={`${Math.round(place.zoom * 100)}%`} onChange={(event) => update({ ...place, zoom: Number(event.target.value) })} />
      </label>
    </div>

    <div className="twibbon-side">
      {inApp && <p className="twibbon-in-app" role="note">
        Halaman ini terbuka di dalam aplikasi (misalnya Instagram), yang kadang tidak bisa menyimpan gambar. Kalau twibbon tidak
        tersimpan, ketuk menu ⋯ di pojok kanan atas, lalu buka di Chrome atau Safari.
      </p>}
      <div className="twibbon-actions">
        <input ref={input} type="file" accept={photoTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
        <button type="button" className="button button-quiet" onClick={() => input.current?.click()}>
          <PixelIcon name="image" size={18} /> {photo ? "Ganti foto" : "Pilih foto"}
        </button>
        <button type="button" className="button button-blue" disabled={!photo || busy} onClick={download}>
          <PixelIcon name="download" size={18} /> {busy ? "Menyiapkan…" : "Unduh twibbon"}
        </button>
        <a className="button button-quiet" href={twibbon.slide} download={twibbon.slideFileName} onClick={(event) => void downloadSlide(event)}>
          <PixelIcon name="download" size={18} /> Unduh slide 2
        </a>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {(result || slideShown) && <div className="twibbon-saved">
        <p className="field-hint">{touch ? "Belum tersimpan? Tekan lama gambar, lalu Simpan." : "Belum terunduh? Klik kanan gambar, lalu Simpan gambar."}</p>
        <div className="twibbon-saved-images">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL of the member's own twibbon, made in the browser */}
          {result && <img src={result} alt="Twibbon kamu" width={twibbon.width} height={twibbon.height} />}
          {/* eslint-disable-next-line @next/next/no-img-element -- shown full size so a long press saves the original */}
          {slideShown && <img src={twibbon.slide} alt="Slide 2" width={twibbon.width} height={twibbon.height} />}
        </div>
      </div>}
      <CaptionComposer />
    </div>
  </div>;
}

function CaptionComposer() {
  const [fields, setFields] = useState<CaptionFields>({ name: "", origin: "", friends: "" });
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const caption = twibbonCaption(fields);
  const set = (field: keyof CaptionFields) => (value: string) => { setFields((current) => ({ ...current, [field]: value })); setCopied(""); };

  async function copy() {
    try { await navigator.clipboard.writeText(caption); setCopied("done"); } catch { setCopied("failed"); }
  }

  return <section className="twibbon-caption" aria-labelledby="twibbon-caption-title">
    <h2 id="twibbon-caption-title">Caption</h2>
    <div className="app-field"><label htmlFor="twibbon-name">Nama panggilan</label>
      <input id="twibbon-name" value={fields.name} maxLength={60} autoComplete="given-name" onChange={(event) => set("name")(event.target.value)} /></div>
    <div className="app-field"><label htmlFor="twibbon-origin">Sekolah atau kampus</label>
      <input id="twibbon-origin" value={fields.origin} maxLength={150} placeholder="Contoh: SMKN 1 Bogor" onChange={(event) => set("origin")(event.target.value)} /></div>
    <div className="app-field"><label htmlFor="twibbon-friends">Tag 3 teman</label>
      <input id="twibbon-friends" value={fields.friends} maxLength={200} placeholder="@teman1 @teman2 @teman3" autoCapitalize="none" spellCheck={false}
        aria-describedby="twibbon-friends-hint" onChange={(event) => set("friends")(event.target.value)} />
      <p id="twibbon-friends-hint" className="field-hint">Username Instagram, dipisah spasi atau koma.</p></div>
    <p className="twibbon-caption-text">{caption}</p>
    <div className="twibbon-actions">
      <button type="button" className="button button-quiet" onClick={() => void copy()}>
        <PixelIcon name={copied === "done" ? "check" : "copy"} size={18} /> Salin caption
      </button>
      <span role="status" className="field-hint">{copied === "done" ? "Caption disalin." : copied === "failed" ? "Tidak bisa menyalin otomatis. Pilih teks caption, lalu salin." : ""}</span>
    </div>
  </section>;
}
