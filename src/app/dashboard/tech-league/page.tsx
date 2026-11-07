import type { Metadata } from "next";
import { TechLeagueTeams } from "@/components/dashboard/tech-league";

export const metadata: Metadata = { title: "Tech League" };

export default function Page() { return <TechLeagueTeams />; }
