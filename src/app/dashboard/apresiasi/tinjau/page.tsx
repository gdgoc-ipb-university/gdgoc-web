import type { Metadata } from "next";
import { DashboardAppreciationReview } from "@/components/dashboard/appreciation";

export const metadata: Metadata = { title: "Tinjau apresiasi" };

export default function Page() { return <DashboardAppreciationReview />; }
