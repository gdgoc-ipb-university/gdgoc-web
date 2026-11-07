# Architecture

One Next.js app on Vercel, one Convex backend, and Google sign-in through Better Auth. The app answers two hosts: the chapter site and Tech League's own (#179). The diagram shows production and the staging preview; the paragraphs below take one node each.

```mermaid
flowchart LR
  browser["Browser<br/>www.gdgocipb.com and league.gdgocipb.com"]
  google["Google OAuth"]

  subgraph vercel["Vercel: production, from release"]
    next["Next.js App Router<br/>pages, src/app/league by host,<br/>and /api/auth/[...all]"]
  end

  subgraph convex["Convex: production deployment"]
    fns["Functions in convex/<br/>queries, mutations, crons"]
    auth["Better Auth component<br/>HTTP routes on .convex.site"]
    db[("Database and file storage")]
  end

  subgraph staging["Staging VM, following main"]
    dev["next dev on 127.0.0.1:3104"]
  end
  tunnel["Cloudflare tunnel<br/>gdgoc-ipb.yorhagarden.xyz<br/>and its league host"]
  convexdev["Convex: development deployment"]

  browser -- "pages, /api/auth" --> next
  next -- "forwards auth requests" --> auth
  auth -- "OAuth sign-in" --> google
  browser -- "queries and mutations" --> fns
  browser -- "Bogor Run: issueRun, submitRun" --> fns
  fns --> db
  auth --> db
  browser -. "preview" .-> tunnel --> dev
  dev -.-> convexdev
```

## Browser

Server-rendered pages arrive from Vercel; the landing is prerendered and needs no backend. Signed-in pages (the dashboard, onboarding) and the Bogor Run leaderboard talk to Convex directly over its client, with a Convex token obtained from the auth session. The header reads the session from the same-origin `/api/auth/get-session`.

## Next.js on Vercel

Pages, layouts and the 3D scene live in `src/app/` and `src/components/`. Vercel deploys production from the `release` branch, which takes only release pull requests from `main` ([ADR 0006](decisions/0006-production-deploys-from-release.md)); pushes to `main` do not build. The build runs `pnpm exec convex deploy --cmd 'pnpm build'`, so the backend ships before the frontend that depends on it. The only HTTP API in this repository is the Better Auth route handler at `src/app/api/auth/[...all]/route.ts`, which forwards to the Convex site URL. There is no other REST or GraphQL endpoint to specify.

Both hosts reach the same deployment ([ADR 0008](decisions/0008-league-subdomain-one-app-shared-login.md)). When `NEXT_PUBLIC_LEAGUE_URL` is set, a `beforeFiles` rewrite in `next.config.ts` serves the league host's pages from `src/app/league/`, matched on the `Host` header; `/api`, `/_next` and static files are shared. `src/proxy.ts` runs first: on the league host it redirects `/dashboard`, `/onboarding` and `/k/*` to the main host, and on either host it redirects `/league/*` and `/program/tech-league` (301) to the league host. Unset, neither does anything and `/league` is a `noindex` preview on the main host.

## Convex functions and database

The queries, mutations and crons in `convex/` are the application API: the frontend calls them by name through the generated `api` object, and each checks access itself (`convex/access.ts`). `convex/schema.ts` defines every table, and file uploads use Convex storage. Tests run them against `convex-test` with no deployment.

## Better Auth with Google OAuth

`convex/auth.ts` configures Better Auth as a Convex component, and `convex/http.ts` registers its routes on the deployment's `.convex.site` URL. Google is the only sign-in method. The secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and the trusted origins (`SITE_URL`, and `LEAGUE_URL` for Tech League) are set on each Convex deployment, never on Vercel. `gdgocipb.com` redirects to `www.gdgocipb.com` so Google's callback always runs on that origin.

One login covers both hosts. With `AUTH_COOKIE_DOMAIN` set, Better Auth writes its cookies, the OAuth state cookie included, on that parent domain, so a session started on either host is sent to both and signing out of one clears both. Sign-in started on the league asks Google to return to `SITE_URL` as usual, with an absolute league `callbackURL` that Better Auth accepts because `LEAGUE_URL` is trusted, and the callback then redirects there. The auth route also expires the host-only twin of each cookie it sets on the parent domain, left from before the change. Testing this locally needs two hosts under one parent domain, such as `www.lvh.me` and `league.lvh.me`; `localhost` subdomains cannot share a cookie.

## Bogor Run replay

The game runs in the browser on the fixed-tick engine in `src/lib/bogor-run/`. Before a signed-in run, `bogorRun.issueRun` returns a server-signed seed token; when the run ends, the client sends `bogorRun.submitRun` its recorded inputs and score. The mutation replays the inputs on the same engine with that seed and saves the score only if the replay matches. The tokens are signed with a key derived from `BETTER_AUTH_SECRET`; without it the game plays unranked.

## Staging VM and Cloudflare tunnel

A preview runs `next dev` on another VM against the Convex development deployment, reached at `gdgoc-ipb.yorhagarden.xyz` through a Cloudflare tunnel, and at a second tunnel host for the league once `NEXT_PUBLIC_LEAGUE_URL`, `LEAGUE_URL` and `AUTH_COOKIE_DOMAIN` are set for it. `DEV_ALLOWED_ORIGINS` lets that hostname reach the dev server, and the tunnel's origin is set as `NEXT_PUBLIC_SITE_URL` and as `SITE_URL` on the development deployment, with its callback registered on the Google OAuth client. The VM follows `main`, so it previews the next release; Vercel builds production only. It is also the place to check a branch before it merges.
