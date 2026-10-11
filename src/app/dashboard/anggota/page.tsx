import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingPanel } from "@/components/appreciation/shared";
import { MembersPage } from "@/components/dashboard/members";

export const metadata: Metadata = { title: "Anggota" };

// The list reads its page, filter, sort, and search from the URL, so it renders below a Suspense boundary.
export default function Page() { return <Suspense fallback={<LoadingPanel label="Memuat anggota…" />}><MembersPage /></Suspense>; }
