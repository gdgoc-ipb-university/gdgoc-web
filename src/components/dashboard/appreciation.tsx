"use client";

import Link from "next/link";
import { AppreciationWorkspace } from "../appreciation/hub";
import { AppreciationReview } from "../appreciation/admin";
import { isReviewer, useDashboardViewer } from "./viewer";

export function DashboardAppreciation() {
  const viewer = useDashboardViewer();
  return <AppreciationWorkspace key={viewer.id} viewer={{ id: viewer.id, name: viewer.name, email: viewer.email, isAdmin: isReviewer(viewer), memberType: viewer.memberType }} />;
}

export function DashboardAppreciationReview() {
  const viewer = useDashboardViewer();
  if (!isReviewer(viewer)) return <div className="app-panel"><h1>Akses khusus tim peninjau.</h1><p>Akun ini belum ditunjuk sebagai peninjau apresiasi. Kiriman pribadimu tetap bisa dibuka di halaman Apresiasi.</p><Link className="button button-blue" href="/dashboard/apresiasi">Ke kiriman saya</Link></div>;
  return <AppreciationReview />;
}
