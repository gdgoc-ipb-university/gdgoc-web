"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components/Modal";
import { pageSizes, pageWindow } from "@/lib/member-table";
import { Select } from "../select";
import { PixelIcon, type PixelIconName } from "../pixel-icons";

// Building blocks for staff data tables: icon buttons, sortable headers, numbered pagination, and confirm dialogs.
// The members page uses them first; other lists can follow.

/** Keeps the last result while a query reloads for new arguments, so the table does not flash empty between pages. */
export function useKeptResult<T>(result: T | undefined) {
  const [kept, setKept] = useState(result);
  if (result !== undefined && result !== kept) setKept(result);
  return { data: result ?? kept, reloading: result === undefined && kept !== undefined };
}

/** A square icon-only control. `label` is its accessible name and its hover/focus tooltip. */
export function IconButton({ icon, label, onClick, disabled, tone }: { icon: PixelIconName; label: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return <button type="button" className="icon-button" data-tip={label} data-tone={tone} aria-label={label} disabled={disabled} onClick={onClick}><PixelIcon name={icon} size={24} /></button>;
}

export function IconLink({ icon, label, href }: { icon: PixelIconName; label: string; href: string }) {
  return <Link className="icon-button" data-tip={label} aria-label={label} href={href}><PixelIcon name={icon} size={24} /></Link>;
}

/** Copies `text` and confirms in place; if the clipboard is blocked, the text is still on screen to copy by hand. */
export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("failed"); }
    setTimeout(() => setState("idle"), 2500);
  }
  return <>
    <IconButton icon={state === "copied" ? "check" : "copy"} label={state === "copied" ? "Tersalin" : state === "failed" ? "Tidak bisa menyalin otomatis" : label} onClick={() => void copy()} />
    <span className="sr-only" role="status">{state === "copied" ? "Tersalin." : ""}</span>
  </>;
}

export type SortDirection = "ascending" | "descending";

/** A column header that sorts on click. `direction` is set only on the column the table is sorted by. */
export function SortHeader({ label, direction, onSort, className }: { label: string; direction?: SortDirection; onSort: () => void; className?: string }) {
  return <th scope="col" className={className} aria-sort={direction ?? "none"}>
    <button type="button" className="dash-sort" onClick={onSort}>
      {label}<PixelIcon name={direction === "ascending" ? "chevron-up" : direction === "descending" ? "chevron-down" : "sort-vertical"} size={18} />
    </button>
  </th>;
}

const count = new Intl.NumberFormat("id-ID");

/** "1–25 dari 312", rows per page, and numbered pages joined into one control with previous and next. */
export function Pagination({ label, noun, page, pageCount, pageSize, total, onPage, onPageSize }: {
  label: string; noun: string; page: number; pageCount: number; pageSize: number; total: number;
  onPage: (page: number) => void; onPageSize: (size: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);
  return <div className="dash-pagination">
    <p className="dash-pagination-range" role="status">{total ? <>Menampilkan <strong>{count.format(first)}–{count.format(last)}</strong> dari <strong>{count.format(total)}</strong> {noun}</> : `Tidak ada ${noun}`}</p>
    <Select variant="inline" label="Baris per halaman" value={pageSize} onChange={onPageSize} options={pageSizes.map((size) => ({ value: size, label: String(size) }))} />
    {pageCount > 1 && <nav className="dash-pager" aria-label={label}><ul>
      <li><button type="button" className="dash-page dash-page-step" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}><PixelIcon name="chevron-left" size={18} /><span>Sebelumnya</span></button></li>
      <li className="dash-pager-compact" aria-hidden="true">{page} / {pageCount}</li>
      {pageWindow(page, pageCount).map((item, index) => item === "gap"
        ? <li key={`gap-${index}`} className="dash-page-gap" aria-hidden="true">…</li>
        : <li key={item}><button type="button" className="dash-page" aria-current={item === page ? "page" : undefined} aria-label={`Halaman ${item}`} onClick={() => onPage(item)}>{item}</button></li>)}
      <li><button type="button" className="dash-page dash-page-step" aria-label="Halaman berikutnya" disabled={page >= pageCount} onClick={() => onPage(page + 1)}><span>Berikutnya</span><PixelIcon name="chevron-right" size={18} /></button></li>
    </ul></nav>}
  </div>;
}

/**
 * A modal dialog over the page: centred on wide screens, a sheet from the bottom on phones, both animated. It closes on
 * Escape, the close button, or a click outside unless `busy`; focus returns to whatever opened it.
 */
export function DashboardDialog({ open, onClose, busy = false, title, alert = false, wide = false, children }: { open: boolean; onClose: () => void; busy?: boolean; title: string; alert?: boolean; wide?: boolean; children: ReactNode }) {
  return <ModalOverlay className="dash-modal-overlay" isOpen={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }} isDismissable={!busy} isKeyboardDismissDisabled={busy}>
    <Modal className="dash-modal" data-wide={wide || undefined}>
      <Dialog className="dash-dialog" role={alert ? "alertdialog" : "dialog"}>
        <div className="dash-dialog-header">
          <Heading slot="title" className="dash-dialog-title">{title}</Heading>
          {!alert && <Button className="icon-button dash-dialog-close" aria-label="Tutup" isDisabled={busy} onPress={onClose}><PixelIcon name="close" size={24} /></Button>}
        </div>
        {children}
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

/** Asks before a change: the consequence, then cancel and confirm. A failed change keeps the dialog open with the reason. */
export function ConfirmDialog({ open, title, message, confirmLabel, danger = false, busy, error, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmLabel: string; danger?: boolean; busy: boolean; error: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return <DashboardDialog open={open} onClose={onClose} busy={busy} title={title} alert>
    <p className="dash-dialog-body">{message}</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="dash-dialog-actions">
      <Button className="dash-dialog-button" isDisabled={busy} onPress={onClose}>Batal</Button>
      <Button className="dash-dialog-button" data-primary data-tone={danger ? "danger" : undefined} isDisabled={busy} onPress={onConfirm}>{busy ? "Menyimpan…" : confirmLabel}</Button>
    </div>
  </DashboardDialog>;
}
