import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { directions } from "@/lib/directions";

// The first direction is the landing itself; the others are concept art previewed in its layout.
const previews = directions.slice(1);

export const dynamicParams = false;
export const generateStaticParams = () => previews.map(({ id }) => ({ world: id }));

type Props = { params: Promise<{ world: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { world } = await params;
  return {
    title: `${previews.find((d) => d.id === world)?.name} preview`,
    robots: { index: false, follow: false },
  };
}

export default async function WorldPreviewPage({ params }: Props) {
  const { world } = await params;
  return <Landing direction={previews.find((d) => d.id === world)!} />;
}
