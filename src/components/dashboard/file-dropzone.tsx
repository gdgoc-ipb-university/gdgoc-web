"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { acceptAttribute, maxSubmissionFiles } from "@/lib/assignment";
import { PixelIcon } from "../pixel-icons";

const carriesFiles = (event: { dataTransfer: DataTransfer | null }) => Boolean(event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files"));

/** Drag-and-drop target with a keyboard-accessible picker button. */
export function FileDropzone({ room, disabled, onFiles, describedBy }: { room: number; disabled: boolean; onFiles: (files: File[]) => void; describedBy?: string }) {
  const zone = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const full = room <= 0;
  const inactive = disabled || full;

  // Show where to drop while a file is dragged over the page, and stop a drop elsewhere
  // from opening the file in the browser (which would leave the form).
  useEffect(() => {
    let depth = 0;
    const enter = (event: globalThis.DragEvent) => { if (carriesFiles(event)) { depth += 1; setDragging(true); } };
    const leave = (event: globalThis.DragEvent) => { if (carriesFiles(event) && --depth <= 0) { depth = 0; setDragging(false); } };
    const reset = () => { depth = 0; setDragging(false); };
    const guard = (event: globalThis.DragEvent) => {
      if (!carriesFiles(event)) return;
      if (event.type === "drop") reset();
      if (zone.current?.contains(event.target as Node)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
      window.removeEventListener("dragend", reset);
    };
  }, []);

  function hover(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = inactive ? "none" : "copy";
    setOver(true);
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setOver(false);
    if (!inactive) onFiles(Array.from(event.dataTransfer.files));
  }

  return <div ref={zone} className="dropzone" data-testid="dropzone" data-over={over} data-dragging={dragging && !over} data-disabled={inactive}
    onDragEnter={hover} onDragOver={hover} onDragLeave={(event) => { if (!zone.current?.contains(event.relatedTarget as Node)) setOver(false); }} onDrop={drop}
    onClick={(event) => { if (!inactive && !(event.target as HTMLElement).closest("button")) input.current?.click(); }}>
    <PixelIcon name="upload" size={32} className="dropzone-icon" />
    <p className="dropzone-title">{full ? "Slot lampiran sudah penuh." : over ? "Lepaskan untuk mengunggah." : "Tarik & lepas file ke sini"}</p>
    {!full && <p className="dropzone-or">atau</p>}
    <button type="button" className="button button-quiet dropzone-button" disabled={inactive} aria-describedby={describedBy} onClick={() => input.current?.click()}>Pilih file</button>
    <input ref={input} data-testid="file-input" hidden type="file" multiple accept={acceptAttribute} onChange={(event) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length) onFiles(files);
    }} />
    <p className="dropzone-meta">{full ? "Hapus lampiran lain untuk menambah file." : `${room} dari ${maxSubmissionFiles} slot tersisa · maksimal 10 MB per file`}</p>
  </div>;
}
