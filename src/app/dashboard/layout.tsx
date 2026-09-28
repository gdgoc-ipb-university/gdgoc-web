import type { Metadata } from "next";
import { MemberProvider } from "@/components/member-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import "./apresiasi.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard GDGoC IPB" },
  description: "Dashboard member dan admin GDGoC IPB untuk tugas, apresiasi prestasi, dan pengelolaan anggota.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <MemberProvider><DashboardShell>{children}</DashboardShell></MemberProvider>;
}
