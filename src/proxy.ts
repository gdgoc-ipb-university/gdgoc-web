import { NextResponse, type NextRequest } from "next/server";
import { leagueUrl } from "@/lib/league";
import { siteUrl } from "@/lib/site";

/** Member pages that live on the main host only. Google sign-in returns there, so the league links to them instead. */
const MAIN_ONLY = ["/dashboard", "/onboarding", "/k"];
/** The old Tech League page, which now answers with a permanent redirect to the league root. */
const OLD_PAGE = "/program/tech-league";

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Keeps Tech League's host and the main host apart (#179). next.config.ts rewrites the league host's pages to
 * src/app/league; here, member pages on the league host redirect to the main host, and /league/* on either host and the
 * old Tech League page redirect to the league host's own paths. Without NEXT_PUBLIC_LEAGUE_URL it does nothing.
 */
export function proxy(request: NextRequest) {
  if (!leagueUrl) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  // The host as the browser sent it: behind `next start` the request URL carries the server's own address.
  const host = (request.headers.get("host") ?? request.nextUrl.host).split(":")[0].toLowerCase();

  if (host === new URL(leagueUrl).hostname) {
    if (MAIN_ONLY.some((prefix) => under(pathname, prefix))) return NextResponse.redirect(`${siteUrl}${pathname}${search}`);
    if (under(pathname, "/league")) return NextResponse.redirect(`${leagueUrl}${pathname.slice("/league".length) || "/"}${search}`, 308);
    return NextResponse.next();
  }

  if (under(pathname, OLD_PAGE)) return NextResponse.redirect(`${leagueUrl}/`, 301);
  if (under(pathname, "/league")) return NextResponse.redirect(`${leagueUrl}${pathname.slice("/league".length) || "/"}${search}`, 308);
  return NextResponse.next();
}

export const config = {
  // Pages only: not the auth API, Next's own files, Vercel's internals, or any file with an extension (static files,
  // robots.txt, sitemap.xml, icon.svg), which both hosts serve alike.
  matcher: ["/((?!api/|_next/|_vercel/|.*\\.\\w+$).*)"],
};
