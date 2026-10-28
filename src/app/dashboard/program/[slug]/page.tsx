import type { Metadata } from "next";
import { ProgramRoster } from "@/components/dashboard/program";

export const metadata: Metadata = { title: "Peserta program" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProgramRoster key={slug} slug={decodeURIComponent(slug)} />;
}
