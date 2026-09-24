"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { statusLabels } from "@/lib/appreciation";
import { readableError } from "@/lib/draft-session";
import { AccountBar, AppreciationFooter, LoadingPanel, LoginPanel, RecordDetails, StatusBadge, dateLabel } from "./shared";

type QueueStatus = "submitted" | "reviewing" | "revision" | "published";

export function AppreciationAdmin() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  return <><main id="main" className="appreciation-page section-width"><div className="admin-intro"><p className="eyebrow">MEDIA & CREATIVE · GDGOC IPB</p><h1>Ruang apresiasi.</h1><p>Tinjau informasi, beri catatan, lalu catat link apresiasi yang sudah dipost.</p></div>
    {isLoading || (isAuthenticated && viewer === undefined) ? <LoadingPanel /> : !viewer ? <LoginPanel admin /> : !viewer.isAdmin ? <><AccountBar viewer={viewer} /><div className="app-panel"><h2>Akses khusus tim peninjau.</h2><p>Akun ini belum memiliki akses admin. Kiriman pribadimu tetap bisa dibuka di halaman Apresiasi.</p><Link className="button button-blue" href="/apresiasi">Ke kiriman saya</Link></div></> : <><AccountBar viewer={viewer} /><Link className="text-button app-back" href="/apresiasi">← Kiriman saya</Link><ReviewQueue /></>}
  </main><AppreciationFooter /></>;
}

function ReviewQueue() {
  const [status, setStatus] = useState<QueueStatus>("submitted");
  const queue = usePaginatedQuery(api.appreciations.queue, { status }, { initialNumItems: 12 });
  return <section aria-label="Antrean apresiasi"><div className="review-filters" aria-label="Filter status">{(["submitted", "reviewing", "revision", "published"] as const).map((value) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}</div>
    {queue.status === "LoadingFirstPage" ? <LoadingPanel /> : !queue.results.length ? <div className="app-empty"><h2>Belum ada kiriman di sini.</h2><p>Kiriman dengan status {statusLabels[status].toLowerCase()} akan muncul di daftar ini.</p></div> : <div className="review-queue">{queue.results.map((record) => <ReviewCard key={`${record._id}:${record.revision}`} record={record} />)}</div>}
    {queue.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => queue.loadMore(12)}>Muat lainnya</button>}
    {queue.status === "LoadingMore" && <p role="status">Memuat kiriman…</p>}
  </section>;
}

function ReviewCard({ record }: { record: Doc<"appreciations"> }) {
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
  return <article className="app-panel review-card"><div className="app-record-top"><StatusBadge status={record.status} /><span className="app-small">{dateLabel(record.submittedAt ?? record.updatedAt)}</span></div><h2>{record.values.achievement}</h2><p>{record.values.fullName} · {record.values.eventName}</p><p className="app-small">Pengirim: {record.ownerName} ({record.ownerEmail})</p><details><summary>Buka detail & dokumentasi</summary><RecordDetails record={record} /></details>
    {record.reviewNote && <p className="review-note">{record.reviewNote}</p>}{record.postUrl && <a className="text-button" href={record.postUrl} target="_blank" rel="noopener noreferrer">Lihat post Instagram ↗</a>}
    {canReview && <form className="review-form" onSubmit={(event) => { event.preventDefault(); void update(); }}><fieldset disabled={busy}><legend>Tindak lanjut kiriman</legend><div className="app-field"><label htmlFor={`action-${record._id}`}>Ubah status</label><select id={`action-${record._id}`} value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="reviewing">Sedang ditinjau</option><option value="revision">Minta pengirim melengkapi</option><option value="published">Sudah dipost di Instagram</option></select></div><div className="app-field"><label htmlFor={`note-${record._id}`}>Catatan untuk pengirim {action === "revision" ? "*" : "(opsional)"}</label><textarea data-lenis-prevent id={`note-${record._id}`} rows={3} maxLength={1500} required={action === "revision"} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan ini bisa dilihat pengirim." /></div>{action === "published" && <div className="app-field"><label htmlFor={`post-${record._id}`}>Link postingan Instagram *</label><input id={`post-${record._id}`} type="url" required value={postUrl} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://www.instagram.com/p/…" /><p className="field-hint">Isi setelah postingan terbit. Tombol ini hanya mencatat status, bukan memposting ke Instagram.</p></div>}{error && <p role="alert" className="field-error">{error}</p>}<button className="button button-blue" type="submit">{busy ? "Menyimpan…" : "Simpan tindak lanjut"}</button></fieldset></form>}
  </article>;
}
