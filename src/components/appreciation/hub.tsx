"use client";

import { useRef, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Arrow, PixelSpark } from "../icons";
import { readableError } from "@/lib/draft-session";
import { AppreciationIntro, LoadingPanel, StatusBadge, dateLabel } from "./shared";
import { AppreciationEditor } from "./editor";

type Viewer = { id: string; name: string; email: string; isAdmin: boolean };

/** The member's appreciation drafts and submissions, rendered inside the dashboard. */
export function AppreciationWorkspace({ viewer }: { viewer: Viewer }) {
  const [activeId, setActiveId] = useState<Id<"appreciations"> | null>(null);
  return <>
    <AppreciationIntro compact />
    {activeId ? <AppreciationEditor key={activeId} id={activeId} viewer={viewer} onBack={() => setActiveId(null)} /> : <DraftList onOpen={setActiveId} />}
  </>;
}

function DraftList({ onOpen }: { onOpen: (id: Id<"appreciations">) => void }) {
  const { results, status, loadMore } = usePaginatedQuery(api.appreciations.mine, {}, { initialNumItems: 12 });
  const create = useMutation(api.appreciations.create);
  const attempt = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function newDraft() {
    setBusy(true); setError("");
    attempt.current ??= crypto.randomUUID();
    try { const id = await create({ clientId: attempt.current }); attempt.current = null; onOpen(id); }
    catch (error) { setError(readableError(error)); }
    finally { setBusy(false); }
  }
  return <section className="app-workspace" aria-labelledby="submissions-title"><div className="app-section-heading"><div><p className="eyebrow">PERJALANAN PRESTASIMU</p><h2 id="submissions-title">Draft & kiriman</h2></div><button className="button button-blue" onClick={newDraft} disabled={busy}>{busy ? "Menyiapkan draft…" : "Ceritakan prestasi"}<span aria-hidden="true">＋</span></button></div>
    {error && <p role="alert" className="app-notice">{error}</p>}
    {status === "LoadingFirstPage" ? <LoadingPanel /> : !results.length ? <div className="app-empty"><PixelSpark /><h3>Pencapaian pertamamu di sini.</h3><p>Mulai satu cerita. Isian otomatis tersimpan sebagai draft, jadi kamu bisa melengkapinya sambil mengumpulkan dokumentasi.</p><button className="text-button" onClick={newDraft} disabled={busy}>Buat draft pertama <Arrow /></button></div> : <div className="app-record-grid">{results.map((record) => <article className="app-record" key={record._id}><div className="app-record-top"><StatusBadge status={record.status} /><span className="eyebrow">{record.values.level || "PRESTASI BARU"}</span></div><h3>{record.values.achievement || "Draft tanpa judul"}</h3><p>{record.values.eventName || "Detail kompetisi belum diisi"}</p>{record.status === "revision" && <p className="review-note">{record.reviewNote}</p>}<div className="app-record-bottom"><span>Diperbarui {dateLabel(record.updatedAt)}</span><button className="text-button" onClick={() => onOpen(record._id)}>{["draft", "revision"].includes(record.status) ? "Lanjutkan" : "Lihat kiriman"}<Arrow /></button></div></article>)}</div>}
    {status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => loadMore(12)}>Muat kiriman lainnya</button>}
    {status === "LoadingMore" && <p role="status">Memuat kiriman lainnya…</p>}
  </section>;
}
