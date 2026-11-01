import type { Metadata } from "next";
import { GatheringsPage } from "@/components/dashboard/gatherings";

export const metadata: Metadata = { title: "Kehadiran" };

export default function Page() { return <GatheringsPage />; }
