import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingPanel } from "@/components/appreciation/shared";
import { CardPrintPage } from "@/components/dashboard/card-print";

export const metadata: Metadata = { title: "Cetak kartu" };

// The selection comes from the URL (the members table's search and filters, or `?pilihan=1`), so it renders below Suspense.
export default function Page() { return <Suspense fallback={<LoadingPanel label="Memuat anggota…" />}><CardPrintPage /></Suspense>; }
