import type { Metadata } from "next";
import { TechSupportQueue } from "@/components/dashboard/tech-support-queue";

export const metadata: Metadata = { title: "Antrean Tech Support" };

export default function Page() { return <TechSupportQueue />; }
