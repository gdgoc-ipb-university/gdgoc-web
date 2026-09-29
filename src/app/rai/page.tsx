import type { Metadata, Viewport } from "next";
import { RisingStar } from "@/components/rai/rising-star";

// An easter egg: not linked anywhere and kept out of search results.
export const metadata: Metadata = {
  title: "Rising Star",
  description: "Sesuatu yang tersembunyi di GDGoC IPB.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0d47a1" };

export default function RaiPage() {
  return <RisingStar />;
}
