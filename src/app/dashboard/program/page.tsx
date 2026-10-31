import type { Metadata } from "next";
import { ProgramsPage } from "@/components/dashboard/program";

export const metadata: Metadata = { title: "Program" };

export default function Page() { return <ProgramsPage />; }
