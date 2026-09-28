import type { Metadata } from "next";
import { NewAssignmentPage } from "@/components/dashboard/assignments";

export const metadata: Metadata = { title: "Tugas baru" };

export default function Page() { return <NewAssignmentPage />; }
