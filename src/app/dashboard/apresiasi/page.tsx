import type { Metadata } from "next";
import { DashboardAppreciation } from "@/components/dashboard/appreciation";

export const metadata: Metadata = {
  title: "Apresiasi",
  description: "Raih prestasi? Ceritakan pencapaianmu untuk apresiasi di Instagram GDGoC IPB. Simpan draft, lengkapi dokumentasi, lalu kirim untuk ditinjau.",
};

export default function Page() { return <DashboardAppreciation />; }
