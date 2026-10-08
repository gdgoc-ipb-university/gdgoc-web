"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { achievementLevels, isQueueFilterActive, queueSearchLimits, statusLabels, type QueueFilter } from "@/lib/appreciation";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, RecordDetails, StatusBadge, dateLabel } from "./shared";
import { Arrow } from "../icons";

type QueueStatus = "submitted" | "reviewing" | "revision" | "published";
type QueueRow = FunctionReturnType<typeof api.appreciations.queue>["page"][number];
const noFilter: QueueFilter = { search: "", level: "", campus: "" };

/** Review queue for the Media & Creative reviewers, rendered inside the dashboard. */
export function AppreciationReview() {
  return <><div className="admin-intro"><p className="eyebrow">MEDIA & CREATIVE · GDGOC IPB</p><h1>Ruang apresiasi.</h1><p>Tinjau informasi, beri catatan, lalu catat link apresiasi yang sudah dipost.</p></div><ReviewQueue /></>;
}

function ReviewQueue() {
  const [status, setStatus] = useState<QueueStatus>("submitted");
  const [filter, setFilter] = useState<QueueFilter>(noFilter);
  // Typing updates the inputs at once; the query follows when React has a moment.
  const applied = useDeferredValue(filter);
  const filtering = isQueueFilterActive(applied);
  const set = (field: keyof QueueFilter, value: string) => setFilter((current) => ({ ...current, [field]: value }));
  return <section aria-label="Antrean apresiasi"><div className="review-filters" aria-label="Filter status">{(["submitted", "reviewing", "revision", "published"] as const).map((value) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}</div>
    <div className="review-search" role="search" aria-label="Cari kiriman">
      <div className="app-field"><label htmlFor="review-search">Cari prestasi atau pengirim</label><input id="review-search" type="search" maxLength={160} value={filter.search} onChange={(event) => set("search", event.target.value)} placeholder="Contoh: Juara 1 atau nama pengirim" /></div>
      <div className="app-field"><label htmlFor="review-level">Tingkat</label><select id="review-level" value={filter.level} onChange={(event) => set("level", event.target.value)}><option value="">Semua tingkat</option>{achievementLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></div>
      <div className="app-field"><label htmlFor="review-campus">Kampus</label><input id="review-campus" maxLength={150} value={filter.campus} onChange={(event) => set("campus", event.target.value)} placeholder="Contoh: IPB" /></div>
      {isQueueFilterActive(filter) && <button type="button" className="text-button" onClick={() => setFilter(noFilter)}>Hapus filter</button>}
    </div>
    {filtering ? <FilteredQueue status={status} filter={applied} /> : <PagedQueue status={status} />}
  </section>;
}

function EmptyQueue({ status, filtered }: { status: QueueStatus; filtered: boolean }) {
  return <div className="app-empty"><h2>{filtered ? "Tidak ada kiriman yang cocok." : "Belum ada kiriman di sini."}</h2><p>{filtered ? "Ubah kata kunci atau filter, atau periksa status lain." : `Kiriman dengan status ${statusLabels[status].toLowerCase()} akan muncul di daftar ini.`}</p></div>;
}

function PagedQueue({ status }: { status: QueueStatus }) {
  const queue = usePaginatedQuery(api.appreciations.queue, { status }, { initialNumItems: 12 });
  return <>
    {queue.status === "LoadingFirstPage" ? <LoadingPanel /> : !queue.results.length ? <EmptyQueue status={status} filtered={false} /> : <div className="review-queue">{queue.results.map((record) => <ReviewCard key={`${record._id}:${record.revision}`} record={record} />)}</div>}
    {queue.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => queue.loadMore(12)}>Muat lainnya</button>}
    {queue.status === "LoadingMore" && <p role="status">Memuat kiriman…</p>}
  </>;
}

function FilteredQueue({ status, filter }: { status: QueueStatus; filter: QueueFilter }) {
  const found = useQuery(api.appreciations.search, { status, ...filter });
  if (!found) return <LoadingPanel />;
  return <>
    <p className="app-small" role="status">{found.results.length} kiriman cocok{found.truncated ? ` · hanya ${queueSearchLimits.scanned} kiriman ${statusLabels[status].toLowerCase()} terbaru yang diperiksa dan ${queueSearchLimits.results} hasil pertama yang ditampilkan` : ""}.</p>
    {!found.results.length ? <EmptyQueue status={status} filtered /> : <div className="review-queue">{found.results.map((record) => <ReviewCard key={`${record._id}:${record.revision}`} record={record} />)}</div>}
  </>;
}

/** Every past review action on a submission, loaded when the reviewer opens it. */
function ReviewHistory({ id }: { id: Id<"appreciations"> }) {
  const [open, setOpen] = useState(false);
  const rows = useQuery(api.appreciations.history, open ? { id } : "skip");
  return <details className="review-history" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>Riwayat tinjauan</summary>
    {!rows ? <p className="app-small" role="status">Memuat riwayat…</p> : !rows.length ? <p className="app-small">Belum ada tindak lanjut.</p>
      : <ol>{rows.map((row) => <li key={row._id}><p className="app-small"><StatusBadge status={row.status} /> {dateLabel(row.createdAt)} · {row.reviewerName}</p>{row.note && <p>{row.note}</p>}{row.postUrl && <a className="text-button" href={row.postUrl} target="_blank" rel="noopener noreferrer">Post Instagram <Arrow external /></a>}</li>)}</ol>}
  </details>;
}

function ReviewCard({ record }: { record: QueueRow }) {
  const review = useMutation(api.appreciations.review);
  const [note, setNote] = useState(record.reviewNote ?? "");
  const [postUrl, setPostUrl] = useState(record.postUrl ?? "");
  const [action, setAction] = useState<"reviewing" | "revision" | "published">("reviewing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canReview = ["submitted", "reviewing"].includes(record.status);
  async function update() {
    setBusy(true); setError("");
    try { await review({ id: record._id, revision: record.revision, status: action, note, postUrl }); }
    catch (error) { setError(readableError(error)); }
    finally { setBusy(false); }
  }
  return <article className="app-panel review-card"><div className="app-record-top"><StatusBadge status={record.status} /><span className="app-small">{dateLabel(record.submittedAt ?? record.updatedAt)}</span></div><h2>{record.values.achievement}</h2><p>{record.values.fullName} · {record.values.eventName}</p><p className="app-small">Pengirim: {record.ownerName} ({record.ownerEmail}) · {record.values.level} · {record.values.campus}</p>{record.handlerName && <p className="app-small review-handler">Ditangani oleh {record.handlerName}</p>}<details><summary>Buka detail & dokumentasi</summary><RecordDetails record={record} /></details><ReviewHistory id={record._id} />
    {record.reviewNote && <p className="review-note">{record.reviewNote}</p>}{record.postUrl && <a className="text-button" href={record.postUrl} target="_blank" rel="noopener noreferrer">Lihat post Instagram <Arrow external /></a>}
    {canReview && <form className="review-form" onSubmit={(event) => { event.preventDefault(); void update(); }}><fieldset disabled={busy}><legend>Tindak lanjut kiriman</legend><div className="app-field"><label htmlFor={`action-${record._id}`}>Ubah status</label><select id={`action-${record._id}`} value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="reviewing">Sedang ditinjau</option><option value="revision">Minta pengirim melengkapi</option><option value="published">Sudah dipost di Instagram</option></select></div><div className="app-field"><label htmlFor={`note-${record._id}`}>Catatan untuk pengirim {action === "revision" ? "*" : "(opsional)"}</label><textarea data-lenis-prevent id={`note-${record._id}`} rows={3} maxLength={1500} required={action === "revision"} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan ini bisa dilihat pengirim." /></div>{action === "published" && <div className="app-field"><label htmlFor={`post-${record._id}`}>Link postingan Instagram *</label><input id={`post-${record._id}`} type="url" required value={postUrl} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://www.instagram.com/p/…" /><p className="field-hint">Isi setelah postingan terbit. Tombol ini hanya mencatat status, bukan memposting ke Instagram.</p></div>}{error && <p role="alert" className="field-error">{error}</p>}<button className="button button-blue" type="submit">{busy ? "Menyimpan…" : "Simpan tindak lanjut"}</button></fieldset></form>}
  </article>;
}
