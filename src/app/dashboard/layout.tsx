import type { Metadata } from "next";
import { MemberProvider } from "@/components/member-provider";
import { Header } from "@/components/header";
import { MemberGate } from "@/components/onboarding/member-gate";
import { DashboardShell } from "@/components/dashboard/shell";
import "../apresiasi/apresiasi.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard GDGoC IPB" },
  description: "Dashboard member dan admin GDGoC IPB untuk tugas, pengumpulan, dan pengelolaan anggota.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <><a className="skip-link" href="#main">Lewati ke konten</a><Header /><MemberProvider><MemberGate><DashboardShell>{children}</DashboardShell></MemberGate></MemberProvider></>;
}
