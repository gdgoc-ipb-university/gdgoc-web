"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Arrow, PixelSpark } from "../icons";
import { readableError } from "@/lib/draft-session";
import { AccountBar, AppreciationFooter, AppreciationIntro, LoadingPanel, LoginPanel, StatusBadge, dateLabel } from "./shared";
import { AppreciationEditor } from "./editor";

export function AppreciationHub() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("authError")) {
      requestAnimationFrame(() => setAuthError(true));
    }
  }, []);
  return <><main id="main" className="appreciation-page section-width">
    <AppreciationIntro compact={isAuthenticated} />
    {authError && !isAuthenticated && <p className="app-notice" role="alert">Login belum selesai atau dibatalkan. Draft yang sudah tersimpan tetap aman; kamu bisa mencoba masuk lagi.</p>}
    {isLoading || (isAuthenticated && viewer === undefined) ? <LoadingPanel /> : viewer ? <MemberWorkspace key={viewer.id} viewer={viewer} /> : <LoginPanel />}
  </main><AppreciationFooter /></>;
}

function MemberWorkspace({ viewer }: { viewer: NonNullable<ReturnType<typeof useQuery<typeof api.auth.viewer>>> }) {
  const [activeId, setActiveId] = useState<Id<"appreciations"> | null>(null);
  if (activeId) return <AppreciationEditor key={activeId} id={activeId} viewer={viewer} onBack={() => setActiveId(null)} />;
  return <><AccountBar viewer={viewer} /><DraftList onOpen={setActiveId} /></>;
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
