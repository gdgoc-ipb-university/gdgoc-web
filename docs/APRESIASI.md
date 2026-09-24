# Apresiasi: backend, authentication and release

## Environments

The dedicated Convex project is `dika/gdgoc-web`.

| Environment | Deployment | Frontend |
| --- | --- | --- |
| Development | `befitting-schnauzer-650` | `http://127.0.0.1:3104` |
| Production | `formal-dachshund-94` | `https://gdgoc-web.vercel.app` |

Copy `.env.example` into a local environment file, then run `pnpm exec convex dev`. Never put production backend URLs into the development environment. Convex generates the typed API in `convex/_generated`.

Vercel production variables:

```text
NEXT_PUBLIC_CONVEX_URL=https://formal-dachshund-94.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://formal-dachshund-94.convex.site
NEXT_PUBLIC_SITE_URL=https://gdgoc-web.vercel.app
```

Each Convex deployment has its own `BETTER_AUTH_SECRET` and `SITE_URL`. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are stored in Convex only. Supply secret values through CLI stdin or the Convex dashboard; never commit them, include them in command arguments, or use `NEXT_PUBLIC_` for secrets.

## Google authentication

Google Cloud project: `gdgoc-web-509612`, client `GDGoC Web`. The client uses these exact redirects:

```text
https://gdgoc-web.vercel.app/api/auth/callback/google
http://127.0.0.1:3104/api/auth/callback/google
http://localhost:3104/api/auth/callback/google
```

The normal local URL is `127.0.0.1:3104`; Convex development `SITE_URL` must match it. To use localhost instead, change the development `SITE_URL` and the frontend origin together. Vercel preview aliases are not registered for Google login.

Better Auth runs in the Convex component. Next.js proxies `/api/auth/*` to its matching Convex HTTP deployment, preserving same-origin session cookies. The frontend fetches a signed Convex token and waits for Convex verification before reading private data. Only `openid`, `profile`, and `email` are requested. No Drive or Instagram account access is requested.

The React provider uses `ConvexProviderWithAuth` and a small session-aware token hook. This avoids the incompatible `useSession` type exposed by `ConvexBetterAuthProvider` in component version 0.12.5 with Better Auth 1.6.33, without patching dependencies or casting away the auth types.

## Drafts and review

- `/apresiasi`: Google login, private drafts, form preview, submission and status.
- Autosave waits 800ms after editing, serializes writes, and flushes before preview or submission. Unsynced changes are backed up in localStorage under both the authenticated owner and document ID.
- Server revisions reject competing edits. The editor preserves the local version and offers an explicit choice to copy it or use the account version. It never silently overwrites a newer draft.
- Drafts can be partial. Submission validates the complete form, documentation HTTPS links, real past announcement date, team details when applicable, and publication consent on the server.
- A client-generated ID makes draft creation retry-safe. Submission is also retry-safe. Each account can hold up to ten unsubmitted drafts.
- Documentation is provided as up to five links. The app neither uploads nor fetches the referenced documents.
- Submitted records are locked while being reviewed. A reviewer can request a revision with a note, then the owner can edit and resubmit.
- Publication is manual. A reviewer records an existing Instagram `/p/` or `/reel/` URL; no code publishes to Instagram.

`/apresiasi/admin` requires a verified Google email in the Convex `APPRECIATION_ADMIN_EMAILS` comma-separated allowlist. It defaults to no reviewers. Set this only after the project owner identifies the reviewers. UI navigation is not the security boundary: every queue read and review mutation independently enforces the allowlist. Drafts never appear in the review queue, and review changes are recorded in `appreciationReviews`.

## Release

```sh
pnpm test
pnpm check
pnpm build
pnpm exec convex deploy --yes
pnpm dlx vercel@59.23.2 deploy --prod --yes --scope bibobaggins-projects
```

Deploy the backend before the frontend. Verify the production alias, same-origin Google callback, authenticated session, saved draft after a reload, and reviewer access restrictions. Do not use the local fixture or unit tests as evidence that production OAuth works. Keep any live test content explicitly labeled and remove test drafts after checking persistence.

The Vitest suite covers actual Better Auth component sessions in `convex-test`, owner/reviewer access, revision conflicts, validation, review transitions, idempotency, autosave races and recovery, and form preview/submit interactions. Browser viewport emulation is separate from physical-device testing.
