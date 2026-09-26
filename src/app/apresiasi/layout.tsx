import type { Metadata } from "next";
import { MemberProvider } from "@/components/member-provider";
import { Header } from "@/components/header";
import { MemberGate } from "@/components/onboarding/member-gate";
import "./apresiasi.css";

export const metadata: Metadata = {
  title: "Apresiasi prestasi",
  description: "Raih prestasi? Ceritakan pencapaianmu untuk apresiasi di Instagram GDGoC IPB. Simpan draft, lengkapi dokumentasi, lalu kirim untuk ditinjau.",
  robots: { index: false, follow: true },
};

export default function AppreciationLayout({ children }: { children: React.ReactNode }) {
  return <><a className="skip-link" href="#main">Lewati ke konten</a><Header /><MemberProvider><MemberGate>{children}</MemberGate></MemberProvider></>;
}
