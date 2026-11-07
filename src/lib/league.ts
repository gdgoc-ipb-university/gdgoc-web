import { siteUrl } from "./site";

/** An origin without a trailing slash, or null when the value is empty or not a URL. */
function origin(value: string | undefined) {
  try { return value ? new URL(value).origin : null; } catch { return null; }
}

/**
 * Tech League's own origin, such as https://league.gdgocipb.com, from NEXT_PUBLIC_LEAGUE_URL. It is null where the league
 * has no host yet (local development, staging until its tunnel exists, previews): the proxy then does nothing, the league
 * pages are previewed under /league on the main host, and /program/tech-league stays as it was.
 */
export const leagueUrl = origin(process.env.NEXT_PUBLIC_LEAGUE_URL);

/** The league root as an absolute URL, or the old program page when the league has no host. */
export const leagueHome = leagueUrl ? `${leagueUrl}/` : null;

/** A league page by its path on the league host: absolute on that host, or under /league on the main host. */
export function leagueHref(path = "/") {
  return leagueUrl ? `${leagueUrl}${path}` : `/league${path === "/" ? "" : path}`;
}

/** A main-site page from a league page: absolute when the league has its own host, so it leaves the league. */
export function mainHref(path: string) {
  return leagueUrl ? `${siteUrl}${path}` : path;
}
