import type { Metadata } from "next";
import { Header } from "@/components/header";
import { LeagueRegistration } from "@/components/league/daftar";
import { LeagueFooter } from "@/components/league/footer";
import { MemberProvider } from "@/components/member-provider";
import "../../dashboard/apresiasi.css";

export const metadata: Metadata = { title: "Daftar Tech League", robots: { index: false, follow: true } };

export default function LeagueRegistrationPage() {
  return <>
    <Header league />
    <main id="main" className="appreciation-page league-daftar section-width">
      <MemberProvider><LeagueRegistration /></MemberProvider>
    </main>
    <LeagueFooter />
  </>;
}
