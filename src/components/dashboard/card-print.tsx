"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { readableError } from "@/lib/draft-session";
import { batches, byName, excluded, PICKED_PARAM, photoSourceLabels, printSummary, type PrintCandidate } from "@/lib/card-print";
import { readListState, type MemberFilters } from "@/lib/member-table";
import { cardPath } from "@/lib/member-card";
import { manifestCsv, printFileName } from "@/lib/card-sheet";
import { siteUrl } from "@/lib/site";
import type { PrintCard } from "./card-pdf";
import { LoadingPanel } from "../appreciation/shared";
import { PixelIcon } from "../pixel-icons";
import { ConfirmDialog } from "./data-table";
import { filterChips } from "./member-filters";
import { useMembersListHref } from "./members";
import { usePickedMembers } from "./picked-members";
import { isStaff, useDashboardViewer } from "./viewer";

type Selection = { kind: "filters"; search: string; filters: MemberFilters } | { kind: "picked"; ownerIds: string[] };

/** Every chosen member, read page by page as the members CSV is. */
async function loadSelection(convex: ReturnType<typeof useConvex>, selection: Selection) {
  const rows: PrintCandidate[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: FunctionReturnType<typeof api.cards.printSelection> = await convex.query(api.cards.printSelection, { selection, paginationOpts: { numItems: 100, cursor } });
    rows.push(...page.page);
    if (page.isDone) return rows;
    cursor = page.continueCursor;
  }
}

export function CardPrintPage() {
  const viewer = useDashboardViewer();
  const back = <Link className="text-button app-back" href={useMembersListHref()}><PixelIcon name="arrow-left" size={24} />Semua anggota</Link>;
  if (!isStaff(viewer)) return <>{back}<div className="app-empty"><h1>Khusus pengurus.</h1><p>Kartu anggota hanya bisa dicetak pemilik dan admin GDGoC IPB.</p></div></>;
  return <>{back}<CardPrint /></>;
}

function CardPrint() {
  const params = useSearchParams();
  const [picked] = usePickedMembers();
  const list = readListState(params);
  const selection: Selection = params.get(PICKED_PARAM) === "1" ? { kind: "picked", ownerIds: picked } : { kind: "filters", search: list.search, filters: list.filters };
  const key = JSON.stringify(selection);
  const convex = useConvex();
  const [loaded, setLoaded] = useState<{ key: string; rows: PrintCandidate[] } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    loadSelection(convex, JSON.parse(key) as Selection).then((rows) => { if (current) { setLoaded({ key, rows }); setError(""); } }, (cause) => { if (current) setError(readableError(cause)); });
    return () => { current = false; };
  }, [convex, key, reload]);

  const chips = selection.kind === "filters" ? filterChips(selection.filters).map((chip) => chip.label) : [];
  const source = selection.kind === "picked" ? `${picked.length} anggota yang kamu pilih di tabel anggota.`
    : `Semua anggota${selection.search ? ` dengan nama “${selection.search}”` : ""}${chips.length ? ` yang cocok dengan filter ${chips.join("; ")}` : ""}.`;
  const rows = loaded?.key === key ? loaded.rows : null;

  return <>
    <div className="dash-intro"><p className="eyebrow">ADMIN · ANGGOTA</p><h1>Cetak kartu.</h1>
      <p>Satu PDF A4 berisi kartu anggota siap cetak bolak-balik, sembilan kartu per lembar, dan manifes CSV untuk mencocokkan kartu dengan anggotanya.</p></div>
    <p className="card-print-source"><strong>Yang dicetak:</strong> {source} <Link className="text-button" href={useMembersListHref()}>Ubah pilihan</Link></p>
    {error ? <p className="field-error" role="alert">{error}</p>
      : !rows ? <LoadingPanel label="Memuat anggota yang dipilih…" />
        : !rows.length ? <div className="app-empty"><h2>Belum ada anggota yang dipilih.</h2><p>{selection.kind === "picked" ? "Centang anggota di tabel anggota, lalu pilih Cetak yang dipilih." : "Tidak ada anggota yang cocok dengan pencarian dan filter ini."}</p></div>
          : <PrintSummary rows={rows} onIssued={() => setReload((count) => count + 1)} />}
  </>;
}

const blockedLabel = (row: PrintCandidate) => [row.blocked && "Kartu diblokir", !row.active && "Akun nonaktif", !row.number && "belum punya nomor"].filter(Boolean).join(" · ");

function NameList({ rows, detail }: { rows: PrintCandidate[]; detail?: (row: PrintCandidate) => string }) {
  return <details className="card-print-names"><summary>Lihat {rows.length} nama</summary>
    <ul>{rows.map((row) => <li key={row.ownerId}><span>{row.name}</span>{detail && <span className="app-small">{detail(row)}</span>}</li>)}</ul>
  </details>;
}

/** The summary before printing, and issuing numbers to those without one. */
export function PrintSummary({ rows, onIssued }: { rows: PrintCandidate[]; onIssued: () => void }) {
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [issuedNote, setIssuedNote] = useState("");
  const summary = printSummary(rows, { includeExcluded });
  const printableExcluded = summary.excluded.filter((row) => row.number).length;
  return <>
    <dl className="dash-stats card-print-stats">
      <div><dt>Akan dicetak</dt><dd>{summary.printing.length}</dd><dd className="card-print-hint">{summary.sheets} lembar A4, {summary.pages} halaman bolak-balik</dd></div>
      <div><dt>Belum punya nomor</dt><dd>{summary.missing.length}</dd><dd className="card-print-hint">Tidak ikut dicetak sampai nomornya diterbitkan</dd></div>
      <div><dt>Tanpa foto unggahan</dt><dd>{summary.noUpload.length}</dd><dd className="card-print-hint">Dicetak dengan foto Google atau inisial</dd></div>
    </dl>
    <p className="app-small card-print-note" role="status">{issuedNote}</p>
    {summary.missing.length > 0 && <IssueNumbers rows={summary.missing} onIssued={(note, changed) => { setIssuedNote(note); if (changed) onIssued(); }} />}
    {summary.noUpload.length > 0 && <section className="app-panel card-print-section" aria-labelledby="print-photo">
      <h2 id="print-photo">Tanpa foto unggahan</h2>
      <p className="app-small">Kartu mereka memakai foto Google dari akun masuk, atau inisial piksel jika tidak ada. Minta mereka mengunggah foto wajah di halaman Profil sebelum mencetak jika perlu.</p>
      <NameList rows={summary.noUpload} detail={(row) => photoSourceLabels[row.photo]} />
    </section>}
    {summary.excluded.length > 0 && <section className="app-panel card-print-section" aria-labelledby="print-excluded">
      <h2 id="print-excluded">Diblokir atau nonaktif</h2>
      <p className="app-small">QR mereka tidak berlaku saat dipindai, jadi kartunya tidak dicetak{printableExcluded ? " kecuali kamu memilih tetap mencetaknya" : ""}. Nomor tidak diterbitkan untuk mereka.</p>
      <NameList rows={summary.excluded} detail={blockedLabel} />
      {printableExcluded > 0 && <label className="card-print-include"><input type="checkbox" checked={includeExcluded} onChange={(event) => setIncludeExcluded(event.target.checked)} />
        <span>Tetap cetak {printableExcluded} kartu yang diblokir atau nonaktif</span></label>}
    </section>}
    {summary.printing.length > 0 && <PrintOutput rows={summary.printing} />}
  </>;
}

type Output = { pdf: string; csv: string; size: number; cards: number; missing: number; at: number };
const sizeLabel = (bytes: number) => `${(bytes / 1048576).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;

/**
 * Draws the PDF and the manifest in the browser (#159). The cards with their tokens are read now, in batches, so a QR
 * replaced after the summary prints current; the drawing code loads only when staff press "Buat PDF".
 */
function PrintOutput({ rows }: { rows: PrintCandidate[] }) {
  const convex = useConvex();
  const [understood, setUnderstood] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  useEffect(() => () => { if (output) { URL.revokeObjectURL(output.pdf); URL.revokeObjectURL(output.csv); } }, [output]);

  async function build() {
    setError(""); setOutput(null); cancelled.current = false;
    setProgress({ done: 0, total: rows.length });
    try {
      const read = (await Promise.all(batches(rows).map((part) => convex.query(api.cards.printCards, { ownerIds: part.map((row) => row.ownerId) })))).flat();
      const byOwner = new Map(read.map((card) => [card.ownerId, card]));
      const cards: PrintCard[] = rows.flatMap((row) => {
        const card = byOwner.get(row.ownerId);
        return card ? [{ ...card, url: `${siteUrl}${cardPath(card.token)}` }] : [];
      });
      const { buildCardPdf } = await import("./card-pdf");
      const { pdf, manifest } = await buildCardPdf(cards, (done, total) => {
        if (cancelled.current) throw new DOMException("Dibatalkan", "AbortError");
        setProgress({ done, total });
      });
      const now = Date.now();
      setOutput({
        pdf: URL.createObjectURL(pdf), csv: URL.createObjectURL(new Blob([manifestCsv(manifest)], { type: "text/csv;charset=utf-8" })),
        size: pdf.size, cards: cards.length, missing: rows.length - cards.length, at: now,
      });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error && cause.message === "art" ? "Gambar kartu belum bisa dibuat di browser ini. Coba Chrome atau Firefox terbaru." : readableError(cause));
    } finally { setProgress(null); }
  }

  return <section className="app-panel card-print-section" aria-labelledby="print-output">
    <h2 id="print-output">Buat file cetak</h2>
    <p className="app-small">PDF A4: setiap lembar kartu depan diikuti lembar kartu belakang. Cetak dengan skala 100% (ukuran sebenarnya), bolak-balik, dibalik di sisi panjang. Coba satu lembar dulu, lalu terawangkan ke cahaya: bagian belakang harus tepat di balik depannya.</p>
    <label className="card-print-include"><input type="checkbox" checked={understood} disabled={progress !== null} onChange={(event) => setUnderstood(event.target.checked)} />
      <span>Saya paham PDF ini memuat QR asli setiap anggota yang dicetak. Jika anggota mengganti QR-nya nanti, kartu cetaknya tidak berlaku lagi dan perlu dicetak ulang.</span></label>
    {progress ? <div className="card-print-progress">
      <label htmlFor="print-progress">Menggambar kartu {progress.done} dari {progress.total}…</label>
      <progress id="print-progress" max={progress.total} value={progress.done} />
      <button type="button" className="dash-tool-button" onClick={() => { cancelled.current = true; }}>Batalkan</button>
    </div>
      : <button type="button" className="dash-tool-button" data-primary disabled={!understood} onClick={() => void build()}><PixelIcon name="file" size={18} />Buat PDF {rows.length} kartu</button>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {output && <div className="card-print-files" role="status">
      <p>{output.cards} kartu siap{output.missing ? `, ${output.missing} dilewati karena kartunya tidak lagi tersedia` : ""}.</p>
      <a className="dash-tool-button" data-primary href={output.pdf} download={printFileName(output.at, "pdf")}><PixelIcon name="download" size={18} />Unduh PDF ({sizeLabel(output.size)})</a>
      <a className="dash-tool-button" href={output.csv} download={printFileName(output.at, "csv")}><PixelIcon name="download" size={18} />Unduh manifes CSV</a>
    </div>}
  </section>;
}

/** Issues this chapter year's number to everyone listed, in name order, through `cards.issueFor`. */
function IssueNumbers({ rows, onIssued }: { rows: PrintCandidate[]; onIssued: (note: string, changed: boolean) => void }) {
  const issue = useMutation(api.cards.issueFor);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setError("");
    const numbers: string[] = [];
    try {
      for (const part of batches([...rows].sort(byName).filter((row) => !excluded(row)))) {
        const result = await issue({ ownerIds: part.map((row) => row.ownerId) });
        numbers.push(...result.issued.map((card) => card.number));
      }
      setConfirming(false);
      onIssued(numbers.length ? `${numbers.length} nomor diterbitkan: ${numbers[0]}${numbers.length > 1 ? ` sampai ${numbers.at(-1)}` : ""}.` : "Semua anggota ini sudah punya nomor.", numbers.length > 0);
    } catch (cause) {
      setError(readableError(cause));
      // A later batch failed: the earlier ones are issued, so read the selection again.
      if (numbers.length) onIssued(`${numbers.length} nomor diterbitkan sebelum gagal.`, true);
    } finally { setBusy(false); }
  }
  return <section className="app-panel card-print-section" aria-labelledby="print-missing">
    <h2 id="print-missing">Belum punya nomor kartu</h2>
    <p className="app-small">Mereka belum pernah membuka kartu anggota tahun chapter ini, jadi belum punya nomor dan QR. Terbitkan nomornya di sini agar kartunya ikut dicetak.</p>
    <NameList rows={rows} />
    <button type="button" className="dash-tool-button" onClick={() => { setError(""); setConfirming(true); }}><PixelIcon name="id-card" size={18} />Terbitkan {rows.length} nomor</button>
    <ConfirmDialog open={confirming} title={`Terbitkan ${rows.length} nomor kartu?`} confirmLabel="Terbitkan nomor" busy={busy} error={error}
      message="Setiap anggota mendapat nomor berikutnya tahun chapter ini, berurutan menurut nama, dan QR baru. Nomor yang sudah terbit tidak bisa dibatalkan atau dipakai ulang, dan tercatat di riwayat akses. Saat anggota membuka kartunya nanti, nomornya tetap sama."
      onClose={() => setConfirming(false)} onConfirm={() => void run()} />
  </section>;
}
