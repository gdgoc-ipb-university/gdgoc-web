import type { Metadata } from "next";
import { AssignmentDetail } from "@/components/dashboard/assignment-detail";

export const metadata: Metadata = { title: "Detail tugas" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentDetail key={id} id={id} />;
}
