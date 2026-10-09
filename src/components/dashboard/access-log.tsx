"use client";

import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { accessSentence } from "@/lib/access-log";
import { assignmentPath } from "@/lib/assignment";
import { LoadingPanel, dateLabel } from "../appreciation/shared";
import { PixelIcon } from "../pixel-icons";
import { useDashboardViewer } from "./viewer";

/** Access changes, newest first: everyone's, or one member's when `ownerId` is set. Owners only (the server checks too). */
export function AccessLogList({ ownerId, pageSize = 25 }: { ownerId?: string; pageSize?: number }) {
  const log = usePaginatedQuery(api.dashboard.accessLog, ownerId ? { ownerId } : {}, { initialNumItems: pageSize });
  if (log.status === "LoadingFirstPage") return <LoadingPanel label="Memuat riwayat akses…" />;
  if (!log.results.length) return <p className="app-small">{ownerId ? "Belum ada perubahan akses untuk anggota ini." : "Belum ada perubahan akses yang tercatat."}</p>;
  return <>
    <ul className="dash-member-activity dash-access-log">{log.results.map((entry) => <li key={entry._id}>
      <div><span>{accessSentence(entry)}</span><span className="app-small">{dateLabel(entry.at)}</span></div>
      <span className="app-inline-badges">
        {entry.assignment?.title && <Link className="text-button" href={assignmentPath({ _id: entry.assignment._id, slug: entry.assignment.slug })}>Tugas</Link>}
        {!ownerId && entry.target && entry.change !== "deleted" && <Link className="text-button" href={`/dashboard/anggota/${encodeURIComponent(entry.targetId)}`}>Anggota</Link>}
      </span>
    </li>)}</ul>
    {log.status === "CanLoadMore" && <button className="button button-quiet app-load-more" onClick={() => log.loadMore(pageSize)}>Muat riwayat lainnya</button>}
    {log.status === "LoadingMore" && <p role="status">Memuat riwayat…</p>}
  </>;
}

export function AccessLogPage() {
  const viewer = useDashboardViewer();
  const back = <Link className="text-button app-back" href="/dashboard/anggota"><PixelIcon name="arrow-left" size={24} />Semua anggota</Link>;
  if (viewer.role !== "owner") return <>{back}<div className="app-empty"><h1>Khusus pemilik.</h1><p>Riwayat akses hanya bisa dibuka pemilik GDGoC IPB.</p></div></>;
  return <>
    {back}
    <div className="dash-intro"><p className="eyebrow">PEMILIK · ANGGOTA</p><h1>Riwayat akses.</h1>
      <p>Setiap perubahan peran admin, peninjau apresiasi, status akun, peran komunitas, penilai tugas, dan penghapusan akun di dashboard, beserta siapa yang mengubahnya. Akun yang sudah dihapus tidak lagi bernama.</p></div>
    <AccessLogList />
  </>;
}
