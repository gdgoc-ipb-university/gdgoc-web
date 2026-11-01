import type { Metadata } from "next";
import { TechSupportPage } from "@/components/dashboard/tech-support";

export const metadata: Metadata = { title: "Tech Support" };

export default function Page() { return <TechSupportPage />; }
