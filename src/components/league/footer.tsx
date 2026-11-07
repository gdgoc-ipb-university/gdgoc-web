import { Arrow } from "@/components/icons";
import { communityLinks } from "@/lib/community";
import { mainHref } from "@/lib/league";

/** The league's footer: the way back to the main site, the member dashboard, and privacy. */
export function LeagueFooter() {
  return <footer className="league-footer section-width">
    <span>Tech League · GDGoC IPB <span className="league-dots" aria-hidden="true"><i /><i /><i /><i /></span></span>
    <nav aria-label="Tautan GDGoC IPB">
      <a href={mainHref("/")}>Situs GDGoC IPB</a>
      <a href={mainHref("/program")}>Program</a>
      <a href={mainHref("/dashboard")}>Dashboard member</a>
      <a href={mainHref("/privasi")}>Privasi</a>
      <a href={communityLinks.instagram} target="_blank" rel="noreferrer">@gdgoc.ipb <Arrow external /></a>
    </nav>
  </footer>;
}
