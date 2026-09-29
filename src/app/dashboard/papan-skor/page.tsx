import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/dashboard/leaderboard";

export const metadata: Metadata = {
  title: "Papan skor",
  description: "100 besar Bogor Run minggu ini dan sepanjang masa, serta peringkatmu sendiri.",
};

export default function Page() { return <LeaderboardPage />; }
