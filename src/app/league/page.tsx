import type { Metadata } from "next";
import { Header } from "@/components/header";
import { JsonLd } from "@/components/json-ld";
import { TechLeagueContent, techLeagueFaq } from "@/components/league/content";
import { LeagueFooter } from "@/components/league/footer";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { faqJsonLd } from "@/lib/faq";
import { leagueUrl } from "@/lib/league";
import { openGraph } from "@/lib/site";
import { techLeague, techLeagueJsonLd } from "@/lib/tech-league";

/**
 * Tech League's landing, served at the league host's root by src/proxy.ts (#179). Where the league has no host yet it is
 * previewed at /league on the main host, and kept out of search there.
 */
export const metadata: Metadata = {
  title: "Tech League",
  description: techLeague.description,
  alternates: { canonical: techLeague.url },
  openGraph: { ...openGraph, url: techLeague.url },
  ...(leagueUrl ? {} : { robots: { index: false, follow: true } }),
};

// The registration status depends on the date, so the page is rebuilt at most hourly instead of once at deploy.
export const revalidate = 3600;

export default function LeaguePage() {
  return <>
    <JsonLd data={techLeagueJsonLd()} />
    <JsonLd data={faqJsonLd(techLeagueFaq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech League", path: techLeague.url }])} />
    <a className="skip-link" href="#main">Lewati ke konten</a>
    <Header league />
    <main id="main" className="league-page section-width">
      <TechLeagueContent />
    </main>
    <LeagueFooter />
  </>;
}
