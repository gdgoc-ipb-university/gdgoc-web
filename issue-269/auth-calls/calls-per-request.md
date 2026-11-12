# Convex function calls per auth request (#269)

Measured on 12 November 2026 against a local Convex backend (`CONVEX_AGENT_MODE=anonymous`) behind `next dev`, with a made-up email account; email sign-in was a temporary local patch, since Google can't redirect to a local host. Calls were counted from `convex logs --success --jsonl`, every HTTP action and every function it called. Production's logs show the same counts per request as the "main" column.

Requests go through the site's `/api/auth` route, as members' do, except the JWKS fetch, which Convex makes itself to check a new token.

| Request | main | + no rate limit on session reads | + static JWKS | + five-minute session cookie |
|---|---:|---:|---:|---:|
| A guest's `get-session` | 4 | 1 | 1 | 1 |
| A member's `get-session` | 7 | 4 | 3 | 1 |
| A member's `convex/token` | 6.7 | 4 | 3 | 1 |
| Convex fetching `/convex/jwks` | 4.7 | 2 | 1, and no longer fetched | 1, and no longer fetched |
| Handing Convex a new token in an open tab (token, key check, query rerun) | 22 | 11 | 7 | 3 |
| 70 session checks in one minute from one address | 439 calls, 17 answered 429 | 280, none 429 | 210 | 70 |

The one-hour token doesn't change these per-request counts: a member tab renews its token every hour instead of every 15 minutes, so the "new token" row happens a quarter as often.

## A member page in a browser

Headless Chromium at 390 × 844, signed in with a made-up account, opening `/onboarding`, then hiding and showing the tab three times (six seconds hidden each time).

| | main | all five changes |
|---|---:|---:|
| `/api/auth` requests while loading | 3 (`get-session`, `convex/token` ×2) | 3 |
| `/api/auth` requests over three returns to the tab | 3 (`get-session` each time) | 0 |
| Convex calls while loading | 21, plus about 10 for Convex's two JWKS fetches | 3 |
| Convex calls over the three returns | 21 | 0 |
| Page | signed in, step 1 prefilled | signed in, step 1 prefilled |

## On the dev deployment

Repeated on 12 November 2026 on the shared dev deployment, which backs staging. Each branch was pushed in turn with `convex dev --once`, then `main`'s backend was pushed back. The test member was a made-up user and session, created through the Better Auth component and deleted afterwards; requests went straight to the deployment's `.convex.site`. `JWKS` was set on dev from `auth:getLatestJwks` before measuring #271, and left set.

| Request | main | #270 | #271 | #272 | #273 |
|---|---:|---:|---:|---:|---:|
| A guest's `get-session` | 4 | 1 | 1 | 1 | 1 |
| A member's `get-session` | 7 | 4 | 3 | 1 | 1 |
| A member's `convex/token` | 6.7 | 4 | 3 | 1 | 1 |
| A `/convex/jwks` fetch | 4.7 | 2 | 1 | 1 | 1 |
| An open tab, first token and two renewals: auth requests / Convex calls | 12 / 77 | 12 / 42 | 6 / 24 | 6 / 12 | 6 / 10 |
| Token lifetime | 900 s | 900 s | 900 s | 900 s | 3600 s |

In the open-tab row, the auth requests on `main` and #270 are 6 token requests plus 6 JWKS fetches by Convex. From #271 on, with `JWKS` set, Convex fetches nothing. The rest of that row is `auth:viewer` rerunning for each new token. The tab stayed signed in as the test member at every step. #274 changes only the browser, so the browser check above covers it.
