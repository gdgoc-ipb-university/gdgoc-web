import type { MetadataRoute } from "next";
import { leagueHome } from "@/lib/league";
import { indexablePaths, siteUrl } from "@/lib/site";
import { techLeague } from "@/lib/tech-league";

/**
 * Only the indexable pages; everything else is `noindex`. Where Tech League has its own host (#179), its root replaces the
 * old page here instead of in a second sitemap: robots.txt is the same file on both hosts and names this sitemap, which
 * lets it list the league's URL, and the league has one indexable page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = leagueHome ? indexablePaths.filter((path) => path !== techLeague.path) : indexablePaths;
  return [...paths.map((path) => ({ url: `${siteUrl}${path}` })), ...(leagueHome ? [{ url: leagueHome }] : [])];
}
