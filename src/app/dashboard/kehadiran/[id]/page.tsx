import type { Metadata } from "next";
import { GatheringDetail } from "@/components/dashboard/gatherings";

export const metadata: Metadata = { title: "Kehadiran kegiatan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GatheringDetail key={id} id={id} />;
}
