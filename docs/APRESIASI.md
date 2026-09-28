# Apresiasi: backend, authentication and release

## Environments

The Convex project is `lisafronaldio123/gdgoc-ipb-web`.

| Environment | Deployment | Frontend |
| --- | --- | --- |
| Development | One personal dev deployment per member | `http://127.0.0.1:3104` |
| Production | `adamant-lobster-969` | `https://www.gdgocipb.com` |

Each team member gets their own dev deployment. Run `pnpm exec convex dev`, choose the existing `gdgoc-ipb-web` project, and Convex writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local`. Never put production backend URLs into the development environment. Convex generates the typed API in `convex/_generated`.

Vercel does not store the Convex URLs. The build command `pnpm exec convex deploy --cmd 'pnpm build'` uses the `CONVEX_DEPLOY_KEY` production secret to deploy the backend, then injects the production URLs into `next build`. Vercel production also stores `NEXT_PUBLIC_SITE_URL=https://www.gdgocipb.com`, matching the production Convex `SITE_URL`.

Each Convex deployment has its own `BETTER_AUTH_SECRET` and `SITE_URL`. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are stored in Convex only. Supply secret values through CLI stdin or the Convex dashboard; never commit them, include them in command arguments, or use `NEXT_PUBLIC_` for secrets. For example:

```sh
openssl rand -base64 32 | pnpm exec convex env --prod set BETTER_AUTH_SECRET
pnpm exec convex env --prod set GOOGLE_CLIENT_SECRET # prompts for the value
```

Use `--deployment dev` instead of `--prod` for your development deployment. Convex environment changes apply immediately without a redeploy.

## Google authentication

Use a Google OAuth web client with these exact redirects:

```text
https://www.gdgocipb.com/api/auth/callback/google
http://127.0.0.1:3104/api/auth/callback/google
```

Add `https://www.gdgocipb.com` and `http://127.0.0.1:3104` as authorized JavaScript origins. A development deployment reached through a tunnel also needs that tunnel's origin and callback. Store the client's ID and secret on each Convex deployment that should allow sign-in. Until both are set, the `auth:configuration` query reports `googleEnabled: false` and the sign-in button is disabled.

The normal local URL is `127.0.0.1:3104`; Convex development `SITE_URL` must match it. To use localhost instead, change the development `SITE_URL` and the frontend origin together. Vercel preview aliases are not registered for Google login.

Production auth runs only on `https://www.gdgocipb.com`: Better Auth uses `SITE_URL` as its base URL and only trusted origin. In the Vercel project's domain settings, `gdgocipb.com` and `gdgoc-ipb-web.vercel.app` redirect to it with a 308, so neither can start a sign-in on an untrusted origin. Change `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, the Google client, and these redirects together if the canonical domain ever changes.

Better Auth runs in the Convex component. Next.js proxies `/api/auth/*` to its matching Convex HTTP deployment, preserving same-origin session cookies. The frontend fetches a signed Convex token and waits for Convex verification before reading private data. Only `openid`, `profile`, and `email` are requested. No Drive or Instagram account access is requested.

The React provider uses `ConvexProviderWithAuth` and a small session-aware token hook. This avoids the incompatible `useSession` type exposed by `ConvexBetterAuthProvider` in component version 0.12.5 with Better Auth 1.6.33, without patching dependencies or casting away the auth types.

## Drafts and review

- `/dashboard/apresiasi`: private drafts, form preview, submission and status, inside the dashboard (sign-in and onboarding are handled by the dashboard). `/apresiasi` redirects here.
- Autosave waits 800ms after editing, serializes writes, and flushes before preview or submission. Unsynced changes are backed up in localStorage under both the authenticated owner and document ID.
- Server revisions reject competing edits. The editor preserves the local version and offers an explicit choice to copy it or use the account version. It never silently overwrites a newer draft.
- Drafts can be partial. Submission validates the complete form, documentation HTTPS links, real past announcement date, team details when applicable, and publication consent on the server.
- A client-generated ID makes draft creation retry-safe. Submission is also retry-safe. Each account can hold up to ten unsubmitted drafts.
- Documentation is provided as up to five links. The app neither uploads nor fetches the referenced documents.
- Submitted records are locked while being reviewed. A reviewer can request a revision with a note, then the owner can edit and resubmit.
- Publication is manual. A reviewer records an existing Instagram `/p/` or `/reel/` URL; no code publishes to Instagram.

`/dashboard/apresiasi/tinjau` (redirected from `/apresiasi/admin`) requires a verified Google email in the Convex `APPRECIATION_ADMIN_EMAILS` comma-separated allowlist. It defaults to no reviewers. Set this only after the project owner identifies the reviewers. UI navigation is not the security boundary: every queue read and review mutation independently enforces the allowlist. Drafts never appear in the review queue, and review changes are recorded in `appreciationReviews`.

## Release

```sh
pnpm test
pnpm check
pnpm build
git push origin main
```

Pushing to `main` starts the Vercel production build, which deploys Convex before building the frontend. Other branches are skipped by the Ignored Build Step. To redeploy without a new commit, use **Create Deployment** with the `main` branch in the Vercel dashboard.

After the deployment is ready, verify `https://www.gdgocipb.com` and the redirects from `gdgocipb.com` and `gdgoc-ipb-web.vercel.app`, same-origin Google callback, authenticated session, saved draft after a reload, and reviewer access restrictions. Do not use the local fixture or unit tests as evidence that production OAuth works. Keep any live test content explicitly labeled and remove test drafts after checking persistence.

The Vitest suite covers actual Better Auth component sessions in `convex-test`, owner/reviewer access, revision conflicts, validation, review transitions, idempotency, autosave races and recovery, and form preview/submit interactions. Browser viewport emulation is separate from physical-device testing.
