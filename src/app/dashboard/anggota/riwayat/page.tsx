import type { Metadata } from "next";
import { AccessLogPage } from "@/components/dashboard/access-log";

export const metadata: Metadata = { title: "Riwayat akses" };

export default function Page() { return <AccessLogPage />; }
