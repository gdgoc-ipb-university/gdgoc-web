# 0008. Tech League on its own subdomain: one app, routed by host, with a shared login

- Status: Accepted
- Date: 2026-11-08
- Links: #33 (decision 1), #179

## Context

Tech League 2026/27 moved from a public page with Program & Development's forms to its own platform, where members form teams and submit their work (#33). It needed an address of its own, `league.gdgocipb.com`, and the same accounts as the chapter site: a participant must be a GDGoC IPB member first (#33, decision 3), and asking members to sign in twice, or to keep two profiles, would split the roster. The options were a second app (its own Vercel project, sharing `convex/` from a monorepo) or this app answering a second host. Registration opens on 1 December 2026, so the choice also had to ship in weeks.

## Decision

This repository's Next.js app serves the league from the same Vercel project, Convex deployment and Better Auth login. The league host comes from `NEXT_PUBLIC_LEAGUE_URL`: a `beforeFiles` rewrite in `next.config.ts`, matched on the `Host` header, serves its pages from `src/app/league/`, and `src/proxy.ts` sends member pages (`/dashboard`, `/onboarding`, `/k`) to the main host and `/league/*` and `/program/tech-league` to the league host. Better Auth trusts `LEAGUE_URL` and, with `AUTH_COOKIE_DOMAIN`, puts its cookies on the parent domain, so one session covers both hosts. Google's callback stays on `SITE_URL`; sign-in started on the league passes an absolute league `callbackURL` and returns there. Without these variables the site behaves as before, with the league previewed at `/league` on the main host.

## Consequences

- One deploy, one backend and one set of secrets. Teams and submissions (#183, #180) are Convex functions next to the member data they check.
- A session cookie on `gdgocipb.com` is sent to every subdomain of it. Any future subdomain served by something else receives it too, so only this app should be served under that domain, or the cookie domain must narrow first.
- Member pages stay on the main host, where sign-in lands. The league links to them by absolute URL (`mainHref`), and its own pages are linked with `leagueHref`, which falls back to `/league` where the league has no host.
- The host rewrite lives in `next.config.ts`, not in the proxy: under `next dev` or `next start` bound to 127.0.0.1, as staging runs, Next sees the proxy's URL as `localhost` and forwards a `NextResponse.rewrite` as an external URL.
- Members signed in before the change hold a host-only cookie on `www`. The auth route expires that twin whenever it sets the shared cookie, so signing out of either host signs out of both.
- If the league ever needs its own deploys, the fallback in #33 stands: a second app in a monorepo that shares `convex/`, keeping the same cookie domain.
