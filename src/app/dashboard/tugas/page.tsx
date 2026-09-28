import type { Metadata } from "next";
import { AssignmentsPage } from "@/components/dashboard/assignments";

export const metadata: Metadata = { title: "Tugas" };

export default function Page() { return <AssignmentsPage />; }
