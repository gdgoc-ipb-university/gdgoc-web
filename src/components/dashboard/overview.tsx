"use client";

import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelSpark } from "../icons";
import { AssignmentStatusBadge, DueLabel, SubmissionBadge, useNow } from "./shared";
import { isStaff, useDashboardViewer } from "./shell";

export function DashboardOverview() {
  const viewer = useDashboardViewer();
  const firstName = viewer.name.trim().split(/\s+/)[0];
  return <>
    <div className="dash-intro"><p className="eyebrow"><span className="status-dot" /> DASHBOARD GDGOC IPB</p><h1>Halo, {firstName}.</h1>
      <p>{isStaff(viewer) ? "Pantau tugas yang sedang berjalan, kiriman member, dan akses komunitas dari satu tempat." : "Tugas yang sedang dibuka dan kirimanmu ada di sini. Kerjakan pelan-pelan, kumpulkan sebelum tenggat."}</p></div>
    {isStaff(viewer) ? <StaffOverview /> : <MemberOverview />}
  </>;
}

function MemberOverview() {
  const assignments = useQuery(api.assignments.list);
  const now = useNow();
  if (!assignments) return <LoadingPanel label="Memuat tugasmu…" />;
  const open = assignments.filter((item) => item.status === "published");
  const pending = open.filter((item) => !item.submittedAt);
  const next = pending.filter((item) => item.dueAt >= now).slice(0, 3);
  const overdue = pending.filter((item) => item.dueAt < now);
  return <>
    <dl className="dash-stats">
      <div><dt>Tugas dibuka</dt><dd>{open.length}</dd></div>
      <div><dt>Belum dikumpulkan</dt><dd>{pending.length}</dd></div>
      <div><dt>Sudah dikumpulkan</dt><dd>{assignments.filter((item) => item.submittedAt).length}</dd></div>
    </dl>
    {overdue.length > 0 && <p className="app-notice">{overdue.length} tugas sudah lewat tenggat tetapi masih dibuka. Kiriman tetap diterima dan akan ditandai terlambat.</p>}
    <section aria-labelledby="next-title"><div className="app-section-heading"><div><p className="eyebrow">BERIKUTNYA</p><h2 id="next-title">Tenggat terdekat</h2></div><Link className="text-button" href="/dashboard/tugas">Semua tugas <Arrow /></Link></div>
      {next.length ? <div className="dash-card-grid">{next.map((item) => <article className="app-record" key={item._id}><div className="app-record-top"><SubmissionBadge submittedAt={item.submittedAt} late={item.late} /></div><h3><Link href={`/dashboard/tugas/${item._id}`}>{item.title}</Link></h3><DueLabel dueAt={item.dueAt} now={now} open /></article>)}</div>
        : <div className="app-empty"><PixelSpark /><h3>Tidak ada tenggat yang menunggu.</h3><p>{open.length ? "Semua tugas yang dibuka sudah kamu kumpulkan. Mantap!" : "Belum ada tugas yang dibuka. Tugas baru akan muncul di sini."}</p></div>}
    </section>
  </>;
}

function StaffOverview() {
  const stats = useQuery(api.dashboard.stats);
  const recent = usePaginatedQuery(api.assignments.adminList, {}, { initialNumItems: 4 });
  const now = useNow();
  return <>
    <dl className="dash-stats">
      <div><dt>Member aktif</dt><dd>{stats ? stats.members - stats.deactivated : "…"}</dd></div>
      <div><dt>Admin</dt><dd>{stats ? stats.admins : "…"}</dd></div>
      <div><dt>Nonaktif</dt><dd>{stats ? stats.deactivated : "…"}</dd></div>
    </dl>
    <div className="dash-actions"><Link className="button button-blue" href="/dashboard/tugas/baru">Buat tugas <span aria-hidden="true">＋</span></Link><Link className="button button-quiet" href="/dashboard/anggota">Kelola anggota</Link></div>
    <section aria-labelledby="recent-title"><div className="app-section-heading"><div><p className="eyebrow">TERBARU</p><h2 id="recent-title">Tugas yang diperbarui</h2></div><Link className="text-button" href="/dashboard/tugas">Semua tugas <Arrow /></Link></div>
      {recent.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat tugas…" /> : recent.results.length ? <div className="dash-card-grid">{recent.results.map((item) => <article className="app-record" key={item._id}><div className="app-record-top"><AssignmentStatusBadge status={item.status} /><span className="app-small">{item.submissionCount} kiriman{item.lateCount ? ` · ${item.lateCount} terlambat` : ""}</span></div><h3><Link href={`/dashboard/tugas/${item._id}`}>{item.title}</Link></h3><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /></article>)}</div>
        : <div className="app-empty"><PixelSpark /><h3>Belum ada tugas.</h3><p>Buat tugas pertama. Simpan sebagai draft dulu atau langsung buka untuk member.</p><Link className="text-button" href="/dashboard/tugas/baru">Buat tugas <Arrow /></Link></div>}
    </section>
  </>;
}
