"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { assignmentPath } from "@/lib/assignment";
import { readableError } from "@/lib/draft-session";
import { LoadingPanel, StatusBadge, dateLabel } from "../appreciation/shared";
import { Arrow } from "../icons";
import { PixelIcon } from "../pixel-icons";
import { StaffOnly } from "./assignments";
import { MemberRow } from "./members";
import { AssignmentStatusBadge, ScoreBadge, SubmissionBadge } from "./shared";
import { isStaff, useDashboardViewer } from "./viewer";

/** One member's profile and activity for staff: submissions, Apresiasi, assignments they review, and the last access change. */
export function MemberDetail({ ownerId }: { ownerId: string }) {
  const viewer = useDashboardViewer();
  const member = useQuery(api.dashboard.member, isStaff(viewer) ? { ownerId } : "skip");
  if (!isStaff(viewer)) return <StaffOnly />;
  const back = <Link className="text-button app-back" href="/dashboard/anggota"><PixelIcon name="arrow-left" size={24} />Semua anggota</Link>;
  if (member === undefined) return <>{back}<LoadingPanel label="Memuat anggota…" /></>;
  if (!member) return <>{back}<div className="app-empty"><h1>Anggota tidak ditemukan.</h1><p>Akun ini belum menyelesaikan perkenalan atau sudah dihapus.</p></div></>;
  return <>
    {back}
    <div className="dash-intro"><p className="eyebrow">ADMIN · ANGGOTA</p><h1>{member.fullName}</h1>
      <p>Bergabung {dateLabel(member.joinedAt)}{member.accessUpdatedBy ? ` · Akses terakhir diubah oleh ${member.accessUpdatedBy}` : ""}.</p></div>
    <ul className="dash-members"><MemberRow row={member} viewer={viewer} linked={false} /></ul>

    <section aria-labelledby="member-tasks"><div className="app-section-heading"><div><p className="eyebrow">TUGAS</p><h2 id="member-tasks">Kiriman tugas</h2></div><span className="app-small">{member.submissions.length} kiriman</span></div>
      {!member.submissions.length ? <p className="app-small">Belum ada kiriman tugas.</p>
        : <ul className="dash-member-activity">{member.submissions.map((task) => <li key={task._id}>
          <div><Link href={assignmentPath({ _id: task.assignmentId, slug: task.slug })}>{task.title}</Link><span className="app-small">Dikirim {dateLabel(task.submittedAt)}</span></div>
          <span className="app-inline-badges"><AssignmentStatusBadge status={task.status} /><SubmissionBadge submittedAt={task.submittedAt} late={task.late} /><ScoreBadge score={task.score} maxScore={task.maxScore} reviewedAt={task.reviewedAt} stale={task.stale} revisionRequestedAt={task.revisionRequestedAt} /></span>
        </li>)}</ul>}
    </section>

    <section aria-labelledby="member-appreciations"><div className="app-section-heading"><div><p className="eyebrow">APRESIASI</p><h2 id="member-appreciations">Kiriman apresiasi</h2></div><span className="app-small">{member.appreciations.length} terkirim{member.drafts ? ` · ${member.drafts} draft pribadi` : ""}</span></div>
      {!member.appreciations.length ? <p className="app-small">Belum ada apresiasi yang dikirim.</p>
        : <ul className="dash-member-activity">{member.appreciations.map((item) => <li key={item._id}>
          <div><strong>{item.achievement}</strong><span className="app-small">{item.level} · {dateLabel(item.submittedAt)}</span></div>
          <span className="app-inline-badges"><StatusBadge status={item.status} />{item.postUrl && <a className="text-button" href={item.postUrl} target="_blank" rel="noopener noreferrer">Post <Arrow external /></a>}</span>
        </li>)}</ul>}
      {member.appreciations.length > 0 && viewer.reviewer && <p className="app-small"><Link className="text-link" href="/dashboard/apresiasi/tinjau">Buka antrean tinjauan</Link> untuk melihat detail dan riwayatnya.</p>}
    </section>

    {member.reviewing.length > 0 && <section aria-labelledby="member-reviewing"><div className="app-section-heading"><div><p className="eyebrow">PENILAI</p><h2 id="member-reviewing">Tugas yang ia nilai</h2></div></div>
      <ul className="dash-member-activity">{member.reviewing.map((assignment) => <li key={assignment._id}><div><Link href={assignmentPath(assignment)}>{assignment.title}</Link></div><AssignmentStatusBadge status={assignment.status} /></li>)}</ul>
    </section>}

    {viewer.role === "owner" && member.role !== "owner" && member.ownerId !== viewer.id && <DeleteAccount ownerId={member.ownerId} fullName={member.fullName} />}
  </>;
}

/** Owners delete an account on the member's request (/privasi). Typing the name is the confirmation; the server checks it too. */
function DeleteAccount({ ownerId, fullName }: { ownerId: string; fullName: string }) {
  const router = useRouter();
  const deleteAccount = useMutation(api.dashboard.deleteAccount);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = name.trim() === fullName.trim();
  async function confirm() {
    setBusy(true); setError("");
    try { await deleteAccount({ ownerId, confirmName: name }); router.push("/dashboard/anggota"); }
    catch (cause) { setError(readableError(cause)); setBusy(false); }
  }
  return <section className="dash-delete-account" aria-labelledby="delete-account-title">
    <div className="app-section-heading"><div><p className="eyebrow">PEMILIK</p><h2 id="delete-account-title">Hapus akun</h2></div></div>
    <p className="app-small">Untuk permintaan penghapusan data dari anggota. Profil, kiriman apresiasi beserta riwayat tinjauannya, kiriman tugas beserta file dan nilainya, skor Bogor Run, tugas yang ia nilai, serta akun login dan sesinya dihapus permanen. Catatan orang lain yang menyebut akun ini, misalnya siapa yang menilai, tetap ada tanpa nama. Tindakan ini tidak bisa dibatalkan.</p>
    {!open ? <button type="button" className="text-button text-danger" onClick={() => setOpen(true)}>Hapus akun {fullName}</button>
      : <form onSubmit={(event) => { event.preventDefault(); if (matches && !busy) void confirm(); }}>
        <div className="app-field"><label htmlFor="delete-account-name">Ketik <strong>{fullName}</strong> untuk konfirmasi</label><input id="delete-account-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy} /></div>
        <div className="dash-confirm"><button type="submit" className="text-button text-danger" disabled={!matches || busy}>{busy ? "Menghapus…" : "Hapus permanen"}</button><button type="button" className="text-button" disabled={busy} onClick={() => { setOpen(false); setName(""); setError(""); }}>Batal</button></div>
      </form>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}
