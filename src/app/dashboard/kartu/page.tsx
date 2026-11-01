import type { Metadata } from "next";
import { MemberCardPage } from "@/components/dashboard/member-card";

export const metadata: Metadata = { title: "Kartu anggota" };

export default function Page() { return <MemberCardPage />; }
