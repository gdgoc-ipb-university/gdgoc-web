import type { Metadata } from "next";
import { MemberDetail } from "@/components/dashboard/member-detail";

export const metadata: Metadata = { title: "Detail anggota" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetail key={id} ownerId={decodeURIComponent(id)} />;
}
