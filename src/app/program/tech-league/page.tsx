import type { Metadata } from "next";
import { Header } from "@/components/header";
import { JsonLd } from "@/components/json-ld";
import { TechLeagueContent, techLeagueFaq } from "@/components/league/content";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";
import { faqJsonLd } from "@/lib/faq";
import { canonical } from "@/lib/site";
import { techLeague, techLeagueJsonLd } from "@/lib/tech-league";

/**
 * The old Tech League page. Where the league has its own host, the proxy answers this path with a 301 to the league
 * root, so this page is only seen where NEXT_PUBLIC_LEAGUE_URL is unset (local development, staging, previews).
 */
export const metadata: Metadata = {
  title: "Tech League",
  description: techLeague.description,
  ...canonical(techLeague.path),
};

// The registration status depends on the date, so the page is rebuilt at most hourly instead of once at deploy.
export const revalidate = 3600;

export default function TechLeaguePage() {
  return <>
    <JsonLd data={techLeagueJsonLd()} />
    <JsonLd data={faqJsonLd(techLeagueFaq)} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech League", path: techLeague.path }])} />
    <Header />
    <main id="main" className="league-page section-width">
      <TechLeagueContent />
    </main>
  </>;
}
