"use client";

import Link from "next/link";
import { useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { documentLinks, isDocumentUrl, statusLabels } from "@/lib/appreciation";
import { readableError } from "@/lib/draft-session";
import { Arrow, PixelSpark } from "../icons";
import { communityLinks } from "@/lib/community";

export function Trophy() {
  return <svg className="pixel-trophy" viewBox="0 0 100 100" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#e6eddb" d="M7 88h86v7H7z" />
    <path fill="#172d43" d="M25 12h50v8h15v29H76v10H63v13H55v10h16v9H29v-9h16V72h-8V59H24V49H10V20h15z" />
    <path fill="#fbbc05" d="M30 17h40v31h-7v9h-8v10H45V57h-8v-9h-7zM15 25h10v19H15zM75 25h10v19H75zM48 65h4v20h-4zM34 85h32v3H34z" />
    <path fill="#ffe592" d="M34 21h7v24h-7zM44 21h21v5H44z" />
    <path fill="#ea4335" d="M4 9h5v5H4zM87 66h5v5h-5z" />
    <path fill="#4285f4" d="M81 5h5v10h-5zM78 8h11v4H78z" />
    <path fill="#34a853" d="M14 69h5v11h-5zM11 72h11v5H11z" />
  </svg>;
}

export function AppreciationIntro({ compact = false }: { compact?: boolean }) {
  return <div className={`app-intro ${compact ? "app-intro-compact" : ""}`}>
    <div><p className="eyebrow"><span className="status-dot" /> APRESIASI GDGOC IPB</p>
      <h1>Kerja kerasmu,<br /><span>layak dirayakan.</span><PixelSpark /></h1>
      <p>Menang lomba atau meraih penghargaan? Ceritakan pencapaianmu untuk apresiasi di Instagram <a href={communityLinks.instagram} target="_blank" rel="noreferrer">@gdgoc.ipb <Arrow diagonal /></a>.</p>
    </div><Trophy />
  </div>;
}

export function GoogleMark() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.97-3.39.97-2.61 0-4.83-1.76-5.62-4.13H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.92a6 6 0 0 1 0-3.84V7.49H3.04a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.34 2.59C7.17 7.71 9.39 5.95 12 5.95Z"/></svg>;
}

/** Identity and sign-out, for dashboard states without the sidebar (e.g. a deactivated account). */
export function AccountBar({ viewer }: { viewer: { name: string; email: string } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw result.error;
    } catch (error) { setError(readableError(error)); }
    finally { setBusy(false); }
  }
  return <div className="account-bar"><div className="account-identity"><span className="account-avatar" aria-hidden="true">{viewer.name.trim().slice(0, 1).toUpperCase()}</span><div><strong>{viewer.name}</strong><span>{viewer.email}</span></div></div>
    <div className="account-actions"><button className="text-button" disabled={busy} onClick={signOut}>{busy ? "Sebentar…" : "Keluar"}</button></div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}

export function LoadingPanel({ label = "Menghubungkan akun dan draftmu…" }: { label?: string }) { return <div className="app-panel app-loading" role="status"><span className="status-dot" /> {label}</div>; }

export function StatusBadge({ status }: { status: Doc<"appreciations">["status"] }) { return <span className="app-status" data-status={status}>{statusLabels[status]}</span>; }

export function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(timestamp) + " WIB";
}

export function RecordDetails({ record }: { record: Doc<"appreciations"> }) {
  const v = record.values;
  const pairs = [
    ["Nama untuk publikasi", v.fullName], ["Peran", v.memberType], ["Kampus / program studi", [v.campus, v.studyProgram].filter(Boolean).join(" · ")],
    ["Instagram", `@${v.instagram}`], ["Prestasi", v.achievement], ["Kompetisi / acara", v.eventName], ["Penyelenggara", v.organizer],
    ["Tingkat", v.level], ["Tanggal pengumuman", v.eventDate], ["Partisipasi", v.participation],
    ...(v.participation === "Tim" ? [["Nama tim", v.teamName], ["Anggota tim", v.teamMembers]] : []), ["Cerita di balik prestasi", v.story],
  ];
  return <div className="record-details"><dl>{pairs.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value || "—"}</dd></div>)}</dl>
    <h3>Link dokumentasi</h3><ul>{documentLinks(v.documentationLinks).map((link, index) => <li key={index}>{isDocumentUrl(link) ? <a href={link} target="_blank" rel="noopener noreferrer">Dokumentasi {index + 1} <Arrow diagonal /><span>{link}</span></a> : <span>Link belum valid: {link}</span>}</li>)}</ul>
    <p className="app-small">{v.publicationConsent ? "Pengirim menyetujui penggunaan materi untuk apresiasi di Instagram GDGoC IPB." : "Persetujuan publikasi belum diberikan."}</p>
  </div>;
}

export function AppreciationFooter({ label = "Informasi apresiasi" }: { label?: string }) {
  return <footer className="app-footer section-width"><span>GDGoC IPB <span className="footer-color-dots" aria-hidden="true"><i /><i /><i /><i /></span></span><nav aria-label={label}><Link href="/">Beranda</Link><Link href="/privasi">Privasi</Link><a href={communityLinks.instagram} target="_blank" rel="noreferrer">@gdgoc.ipb <Arrow diagonal /></a></nav></footer>;
}
