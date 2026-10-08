"use client";

import { useEffect, useState } from "react";
import { assignmentStatusLabels, fileSizeLabel, scoreLabel } from "@/lib/assignment";
import { dateLabel } from "../appreciation/shared";
import { Arrow } from "../icons";
import { PixelIcon } from "../pixel-icons";

/** Current time, refreshed each minute so deadline labels stay accurate without impure renders. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const relative = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
export function relativeLabel(target: number, now: number) {
  const minutes = Math.round((target - now) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export function DueLabel({ dueAt, now, open }: { dueAt: number; now: number; open: boolean }) {
  const passed = dueAt < now;
  return <p className="dash-due" data-passed={passed && open}>
    <span>Tenggat {dateLabel(dueAt)}</span>
    {open && <span className="dash-due-relative">{passed ? `Lewat tenggat · ${relativeLabel(dueAt, now)}` : relativeLabel(dueAt, now)}</span>}
  </p>;
}

export function AssignmentStatusBadge({ status }: { status: keyof typeof assignmentStatusLabels }) {
  return <span className="app-status dash-status" data-status={status}>{assignmentStatusLabels[status]}</span>;
}

export function SubmissionBadge({ submittedAt, late }: { submittedAt: number | null; late: boolean }) {
  if (!submittedAt) return <span className="app-status dash-status" data-status="missing">Belum dikumpulkan</span>;
  return <span className="app-status dash-status" data-status={late ? "late" : "done"}>{late ? "Terkumpul · terlambat" : "Terkumpul"}</span>;
}

/** The review state of a submission: nothing until reviewed; a pending revision request; that it was edited after review; or the score, or "ada umpan balik". */
export function ScoreBadge({ score, maxScore, reviewedAt, stale, revisionRequestedAt }: { score: number | null; maxScore: number; reviewedAt: number | null; stale: boolean; revisionRequestedAt: number | null }) {
  if (reviewedAt === null) return null;
  if (revisionRequestedAt !== null) return <span className="app-status dash-status" data-status="revision">Revisi diminta</span>;
  if (stale) return <span className="app-status dash-status" data-status="stale">Diperbarui setelah dinilai</span>;
  return <span className="app-status dash-status" data-status="scored">{score === null ? "Ada umpan balik" : `Dinilai ${scoreLabel(score, maxScore)}`}</span>;
}

export function FileLink({ file }: { file: { name: string; size: number; url: string | null } }) {
  if (!file.url) return <span className="dash-file">{file.name} <small>{fileSizeLabel(file.size)} · tidak tersedia</small></span>;
  return <a className="dash-file" href={file.url} target="_blank" rel="noopener noreferrer">{file.name} <small>{fileSizeLabel(file.size)}</small><Arrow external /><span className="sr-only"> (buka tab baru)</span></a>;
}

/** Copies the full, readable link of a dashboard page. */
export function CopyLinkButton({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const url = new URL(path, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setState("copied"); }
    catch { setState("failed"); }
    setTimeout(() => setState("idle"), 2500);
  }
  return <span className="dash-copy">
    <button type="button" className="text-button" onClick={() => void copy()}><PixelIcon name={state === "copied" ? "check" : "copy"} size={16} />{state === "copied" ? "Link tersalin" : "Salin link"}</button>
    <span className="sr-only" role="status">{state === "copied" ? "Link tugas tersalin." : ""}</span>
    {state === "failed" && <small role="alert">Tidak bisa menyalin otomatis. Salin dari alamat: {path}</small>}
  </span>;
}
