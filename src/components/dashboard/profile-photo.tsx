"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { chapterPeriod } from "@/lib/chapter";
import { readableError } from "@/lib/draft-session";
import { clampCrop, cropPlacement, cropSide, initialCrop, maxZoom, photoLimits, photoTypes, sizeProblem, type Crop } from "@/lib/profile-photo";
import { sendFile } from "@/lib/upload";
import { MemberCardFront } from "../member-card-face";
import { PixelIcon } from "../pixel-icons";
import { ConfirmDialog } from "./data-table";
import { useDashboardViewer } from "./viewer";

/** A photo chosen for cropping: decoded once, upright (EXIF rotation applied), with a URL for the on-screen image. */
type Source = { bitmap: ImageBitmap; url: string; width: number; height: number };

/** The largest photo the browser opens for cropping; what is uploaded is the 800 px crop, far below the 5 MB limit. */
const maxInputBytes = 25 * 1024 * 1024;

async function openPhoto(file: File): Promise<Source | string> {
  if (!(photoTypes as readonly string[]).includes(file.type)) return "Gunakan foto JPG, PNG, atau WebP.";
  if (file.size > maxInputBytes) return "Ukuran foto maksimal 25 MB.";
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return "Foto ini tidak bisa dibuka. Coba foto lain."; }
  const problem = sizeProblem(bitmap.width, bitmap.height);
  if (problem) { bitmap.close(); return problem; }
  return { bitmap, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height };
}

/** The crop drawn at `size` pixels on white (JPEG has no transparency). */
function drawCrop(source: Source, crop: Crop, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  const side = cropSide(source, crop.zoom);
  g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
  g.imageSmoothingQuality = "high";
  g.drawImage(source.bitmap, crop.x - side / 2, crop.y - side / 2, side, side, 0, 0, size, size);
  return canvas;
}

/** The crop as the 800 × 800 JPEG that is uploaded. */
function exportCrop(source: Source, crop: Crop) {
  return new Promise<Blob>((resolve, reject) => drawCrop(source, crop, photoLimits.output).toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Foto belum bisa diproses di browser ini. Coba browser lain.")), "image/jpeg", photoLimits.quality,
  ));
}

/** Keeps the latest value of a box's width, for the crop area that shrinks on phones. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || fallback));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/**
 * The square crop step: drag (or arrow keys) to position, the slider (or + and -) to zoom, and a live preview on the
 * card front, which is drawn from the same crop as the upload.
 */
function PhotoCropper({ source, progress, error, onCancel, onSave }: {
  source: Source; progress: number | null; error: string; onCancel: () => void; onSave: (crop: Crop) => void;
}) {
  const viewer = useDashboardViewer();
  const [crop, setCrop] = useState(() => initialCrop(source));
  const [frame, box] = useWidth<HTMLDivElement>(320);
  const [preview, setPreview] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const busy = progress !== null, zoomLimit = maxZoom(source);
  const place = cropPlacement(source, crop, box);
  const update = (next: Crop) => setCrop(clampCrop(source, next));

  // The card preview at the card's own photo size, redrawn once per frame at most.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { setPreview(drawCrop(source, crop, 200).toDataURL("image/jpeg", .8)); } catch { setPreview(null); }
    });
    return () => cancelAnimationFrame(id);
  }, [source, crop]);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const last = drag.current;
    if (!last || last.id !== event.pointerId) return;
    drag.current = { id: last.id, x: event.clientX, y: event.clientY };
    update({ ...crop, x: crop.x - (event.clientX - last.x) / place.scale, y: crop.y - (event.clientY - last.y) / place.scale });
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = (event.shiftKey ? 50 : 10) / place.scale;
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { x: crop.x - step }, ArrowRight: { x: crop.x + step }, ArrowUp: { y: crop.y - step }, ArrowDown: { y: crop.y + step },
      "+": { zoom: crop.zoom + .1 }, "=": { zoom: crop.zoom + .1 }, "-": { zoom: crop.zoom - .1 },
    };
    if (busy || !moves[event.key]) return;
    event.preventDefault();
    update({ ...crop, ...moves[event.key] });
  }

  return <div className="dash-photo-crop">
    <div className="dash-photo-crop-main">
      <div ref={frame} className="dash-photo-crop-area" tabIndex={0} role="group" aria-label="Posisi foto" aria-describedby="photo-crop-hint" data-busy={busy}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={key}>
        <Image src={source.url} alt="" width={source.width} height={source.height} unoptimized draggable={false}
          style={{ width: place.width, height: place.height, transform: `translate(${place.left}px, ${place.top}px)` }} />
      </div>
      <p id="photo-crop-hint" className="app-small">Geser foto agar wajahmu di tengah kotak. Di keyboard, pakai tombol panah untuk menggeser, serta + dan - untuk memperbesar.</p>
      <label className="dash-photo-zoom">
        <span>Perbesar</span>
        <input type="range" min={1} max={zoomLimit} step={.01} value={crop.zoom} disabled={busy || zoomLimit === 1}
          aria-valuetext={`${Math.round(crop.zoom * 100)}%`} onChange={(event) => update({ ...crop, zoom: Number(event.target.value) })} />
      </label>
      {zoomLimit === 1 && <p className="app-small">Foto ini tidak bisa diperbesar lagi tanpa jadi buram di kartu cetak.</p>}
    </div>
    <div className="dash-photo-crop-side">
      <p className="dash-photo-label">Di kartu</p>
      <div className="dash-photo-card" aria-hidden="true">
        <MemberCardFront card={{ name: viewer.name, photo: preview, memberType: viewer.memberType, division: viewer.division, period: chapterPeriod.year }} />
      </div>
      <p className="app-small">Kotak foto di kartu cetak sekitar 17 × 17 mm. Pastikan wajahmu tetap jelas di ukuran ini.</p>
      {progress !== null && <div className="dash-photo-progress" role="status">
        <progress max={1} value={progress} aria-label="Unggahan foto" />
        <span>{progress < 1 ? `Mengunggah… ${Math.round(progress * 100)}%` : "Memeriksa foto…"}</span>
      </div>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="dash-photo-buttons">
        <button type="button" className="button button-blue" disabled={busy} onClick={() => onSave(crop)}><PixelIcon name="upload" size={18} />{busy ? "Menyimpan…" : "Simpan foto"}</button>
        <button type="button" className="text-button" onClick={onCancel}>Batal</button>
      </div>
    </div>
  </div>;
}

/**
 * "Foto profil" on the profile page (#146): the photo the dashboard and the printed card use (uploaded, else Google,
 * else the pixel initial), choosing and cropping a new one, and removing it.
 */
export function ProfilePhotoPanel() {
  const viewer = useDashboardViewer();
  const uploadUrl = useMutation(api.photos.uploadUrl);
  const attach = useAction(api.photos.set);
  const removePhoto = useMutation(api.photos.remove);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (source) { source.bitmap.close(); URL.revokeObjectURL(source.url); } }, [source]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(""); setSaved("");
    const opened = await openPhoto(file);
    if (typeof opened === "string") setError(opened);
    else setSource(opened);
  }
  function close() {
    controller.current?.abort();
    setSource(null); setProgress(null); setError("");
  }
  async function save(crop: Crop) {
    if (!source) return;
    const abort = new AbortController();
    controller.current = abort;
    setError(""); setProgress(0);
    try {
      const blob = await exportCrop(source, crop);
      const storageId = await sendFile(await uploadUrl({}), blob, setProgress, abort.signal);
      setProgress(1);
      const result = await attach({ storageId });
      if (result.error) { setError(result.error); setProgress(null); return; }
      setSource(null); setProgress(null); setSaved("Foto profil tersimpan. Kartu anggotamu langsung memakai foto ini.");
    } catch (cause) {
      if (!abort.signal.aborted) { setError(readableError(cause)); setProgress(null); }
    }
  }

  const where = viewer.photoUploaded ? "Foto yang kamu unggah." : viewer.photo ? "Foto dari akun Google-mu." : "Belum ada foto, jadi kartu memakai inisial namamu.";
  return <section className="app-panel dash-photo-panel" aria-labelledby="profile-photo">
    <h2 id="profile-photo">Foto profil</h2>
    <p>Foto ini dicetak di kartu anggota dan dipakai pengurus untuk mengenali wajahmu saat kamu datang ke kegiatan. Pakai foto wajah yang jelas dan menghadap ke depan, tanpa masker atau kacamata hitam.</p>
    <input ref={input} type="file" accept={photoTypes.join(",")} hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    {source
      ? <PhotoCropper source={source} progress={progress} error={error} onCancel={close} onSave={(crop) => void save(crop)} />
      : <div className="dash-photo-current">
        <div className="dash-photo-card"><MemberCardFront card={{ name: viewer.name, photo: viewer.photo, memberType: viewer.memberType, division: viewer.division, period: chapterPeriod.year }} /></div>
        <div className="dash-photo-actions">
          <p><strong>{where}</strong></p>
          <p className="app-small">JPG, PNG, atau WebP, minimal {photoLimits.minEdge} × {photoLimits.minEdge} piksel. Kamu akan memotongnya menjadi persegi sebelum disimpan.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
          {saved && <p className="dash-success" role="status">{saved}</p>}
          <div className="dash-photo-buttons">
            <button type="button" className="button button-blue" onClick={() => input.current?.click()}><PixelIcon name="image" size={18} />{viewer.photoUploaded ? "Ganti foto" : "Pilih foto"}</button>
            {viewer.photoUploaded && <button type="button" className="button button-quiet" onClick={() => { setError(""); setConfirm(true); }}><PixelIcon name="trash" size={18} />Hapus foto</button>}
          </div>
        </div>
      </div>}
    <ConfirmDialog open={confirm} title="Hapus foto profil?" confirmLabel="Hapus foto" danger busy={busy} error={error}
      message="Fotomu dihapus permanen. Dashboard dan kartu anggota kembali memakai foto Google atau inisial namamu."
      onClose={() => setConfirm(false)}
      onConfirm={async () => {
        setBusy(true); setError("");
        try { await removePhoto({}); setConfirm(false); setSaved("Foto profil dihapus."); } catch (cause) { setError(readableError(cause)); } finally { setBusy(false); }
      }} />
  </section>;
}
