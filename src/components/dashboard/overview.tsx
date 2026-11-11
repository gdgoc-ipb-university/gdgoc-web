"use client";

import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { assignmentPath } from "@/lib/assignment";
import { catalyst } from "@/lib/catalyst";
import { LoadingPanel } from "../appreciation/shared";
import { Arrow, PixelSpark } from "../icons";
import { PixelIcon } from "../pixel-icons";
import { AssignmentStatusBadge, DueLabel, SubmissionBadge, useNow } from "./shared";
import { isStaff, useDashboardViewer } from "./viewer";
import { SolveBadge } from "./flag-task";

export function DashboardOverview() {
  const viewer = useDashboardViewer();
  const firstName = viewer.name.trim().split(/\s+/)[0];
  return <>
    <div className="dash-intro"><p className="eyebrow"><span className="status-dot" /> DASHBOARD GDGOC IPB</p><h1>Halo, {firstName}.</h1>
      <p>{isStaff(viewer) ? "Pantau tugas yang sedang berjalan, kiriman member, dan akses komunitas dari satu tempat." : "Tugas yang sedang dibuka dan kirimanmu ada di sini. Kerjakan pelan-pelan, kumpulkan sebelum tenggat."}</p></div>
    <ProgramOverview />
    {isStaff(viewer) ? <StaffOverview /> : <MemberOverview />}
  </>;
}

/**
 * A participant's program (#106): the cohort and their role, their team once staff form one, and the open tasks for their
 * role. Nothing for anyone not enrolled. The next session joins this once sessions exist (#109).
 */
function ProgramOverview() {
  const programs = useQuery(api.cohorts.mine);
  const now = useNow();
  if (!programs?.length) return null;
  return programs.map((program) => {
    const icon = catalyst.roles.find((role) => role.key === program.role.key)?.icon;
    return <section key={program._id} aria-labelledby={`program-${program._id}`}>
      <div className="app-section-heading"><div><p className="eyebrow">PROGRAM</p><h2 id={`program-${program._id}`}>{program.cohort.name}</h2></div></div>
      <div className="app-panel dash-catalyst">
        <div className="dash-catalyst-role">{icon && <PixelIcon name={icon} size={28} />}<span><span className="app-small">Peranmu</span><strong>{program.role.name}</strong></span></div>
        <div><h3>Tim</h3>
          {!program.team ? <p className="app-small">Tim belum dibentuk. Timmu muncul di sini setelah panitia membentuknya.</p> : <>
            <p><strong>{program.team.name}</strong></p>
            {program.team.teammates.length ? <ul className="dash-mentee-list">{program.team.teammates.map((mate, index) => <li key={index}>{mate.name} <span className="app-small">· {mate.role}</span></li>)}</ul>
              : <p className="app-small">Belum ada rekan setim lain.</p>}
          </>}
        </div>
        <div><h3>Tugas yang dibuka</h3>
          {program.tasks.length ? <ul className="dash-member-activity">{program.tasks.map((task) => <li key={task._id}>
            <div><Link href={assignmentPath(task)}>{task.title}</Link><DueLabel dueAt={task.dueAt} now={now} open /></div>
            {task.revisionRequestedAt !== null ? <span className="app-status dash-status" data-status="revision">Revisi diminta</span> : task.kind === "flag" ? <SolveBadge points={task.points} /> : <SubmissionBadge submittedAt={task.submittedAt} late={task.late} />}
          </li>)}</ul> : <p className="app-small">Belum ada tugas yang dibuka untuk peranmu.</p>}
        </div>
      </div>
    </section>;
  });
}

function MemberOverview() {
  const assignments = useQuery(api.assignments.list);
  const now = useNow();
  if (!assignments) return <LoadingPanel label="Memuat tugasmu…" />;
  const open = assignments.filter((item) => item.status === "published");
  const pending = open.filter((item) => !item.submittedAt);
  const next = pending.filter((item) => item.dueAt >= now).slice(0, 3);
  // Late work is still taken for hand-graded tasks only; a flag task stops at its due date.
  const overdue = pending.filter((item) => item.dueAt < now && item.kind !== "flag");
  const revisions = assignments.filter((item) => item.revisionRequestedAt !== null);
  return <>
    <dl className="dash-stats">
      <div><dt>Tugas dibuka</dt><dd>{open.length}</dd></div>
      <div><dt>Belum dikumpulkan</dt><dd>{pending.length}</dd></div>
      <div><dt>Sudah dikumpulkan</dt><dd>{assignments.filter((item) => item.submittedAt).length}</dd></div>
    </dl>
    {revisions.length > 0 && <p className="app-notice">Revisi diminta untuk {revisions.map((item, index) => <span key={item._id}>{index ? ", " : ""}<Link href={assignmentPath(item)}>{item.title}</Link></span>)}. Perbaiki kirimanmu, lalu kirim lagi.</p>}
    {overdue.length > 0 && <p className="app-notice">{overdue.length} tugas sudah lewat tenggat tetapi masih dibuka. Kiriman tetap diterima dan akan ditandai terlambat.</p>}
    <section aria-labelledby="next-title"><div className="app-section-heading"><div><p className="eyebrow">BERIKUTNYA</p><h2 id="next-title">Tenggat terdekat</h2></div><Link className="text-button" href="/dashboard/tugas">Semua tugas <Arrow /></Link></div>
      {next.length ? <div className="dash-card-grid">{next.map((item) => <article className="app-record" key={item._id}><div className="app-record-top">{item.kind === "flag" ? <SolveBadge points={item.points} /> : <SubmissionBadge submittedAt={item.submittedAt} late={item.late} />}</div><h3><Link href={assignmentPath(item)}>{item.title}</Link></h3><DueLabel dueAt={item.dueAt} now={now} open /></article>)}</div>
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
    <div className="dash-actions"><Link className="button button-blue" href="/dashboard/tugas/baru">Buat tugas <PixelIcon name="plus" size={18} /></Link><Link className="button button-quiet" href="/dashboard/anggota">Kelola anggota</Link></div>
    <section aria-labelledby="recent-title"><div className="app-section-heading"><div><p className="eyebrow">TERBARU</p><h2 id="recent-title">Tugas yang diperbarui</h2></div><Link className="text-button" href="/dashboard/tugas">Semua tugas <Arrow /></Link></div>
      {recent.status === "LoadingFirstPage" ? <LoadingPanel label="Memuat tugas…" /> : recent.results.length ? <div className="dash-card-grid">{recent.results.map((item) => <article className="app-record" key={item._id}><div className="app-record-top"><AssignmentStatusBadge status={item.status} /><span className="app-small">{item.submissionCount} kiriman{item.lateCount ? ` · ${item.lateCount} terlambat` : ""}</span></div><h3><Link href={assignmentPath(item)}>{item.title}</Link></h3><DueLabel dueAt={item.dueAt} now={now} open={item.status === "published"} /></article>)}</div>
        : <div className="app-empty"><PixelSpark /><h3>Belum ada tugas.</h3><p>Buat tugas pertama. Simpan sebagai draft dulu atau langsung buka untuk member.</p><Link className="text-button" href="/dashboard/tugas/baru">Buat tugas <Arrow /></Link></div>}
    </section>
  </>;
}
