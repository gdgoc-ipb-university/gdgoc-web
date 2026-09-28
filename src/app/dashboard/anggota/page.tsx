import type { Metadata } from "next";
import { MembersPage } from "@/components/dashboard/members";

export const metadata: Metadata = { title: "Anggota" };

export default function Page() { return <MembersPage />; }
