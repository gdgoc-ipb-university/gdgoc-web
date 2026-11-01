# 0006. Production deploys from the `release` branch, not `main`

- Status: Accepted
- Date: 2026-11-02
- Links: #129; reverses the "no `release` branch" item in #124's "Not adopted" list; the "Protect release" repository ruleset; `.github/workflows/release.yml`; "Releasing" in `README.md`

## Context

Until 2 November 2026 every push to `main` deployed production on Vercel, and the build (`pnpm exec convex deploy --cmd 'pnpm build'`) shipped the Convex production backend with it. A merged pull request went live minutes later, before anyone could see it next to the other changes on staging, and a schema change reached production data the moment it merged. When the contribution SOP was adopted (#124), a `release` branch was listed under "Not adopted" because Vercel deployed `main`; [ADR 0003](0003-squash-only-merges.md) still describes that setup in its context.

## Decision

`release` is the production branch. The Vercel project `gdgoc-ipb-web` deploys it, and its Ignored Build Step skips every other branch, `main` included. `main` stays the integration branch with squash-only pull requests, and the staging VM at gdgoc-ipb.yorhagarden.xyz follows it as the preview of the next release. To release, the maintainer runs the **Release** workflow, which opens a `main` → `release` pull request listing what it ships, checks staging, and merges it with a merge commit. The "Protect release" ruleset requires a pull request with merge commits only, resolved threads and the "Lint, typecheck and test" check, and blocks force pushes and deletion; org admins can bypass it only during an incident.

## Consequences

- A merge to `main` no longer goes live on its own. It waits on staging until the next release, so a user-facing check on production happens after the release, not after the merge.
- The board's Done still means merged to `main`. Each release pull request lists the issues and pull requests it ships, so it records when each one reached production.
- Releases are merge commits on `release`, so `release..main` is exactly what the next release ships, and after ad0363b, where `release` was cut, `git log --first-parent release` reads as a list of releases.
- A hotfix is a pull request to `main` followed by a release, so it waits for CI and a release pull request. Committing to `release` directly would leave `main` behind production.
- Release pull requests are opened with `GITHUB_TOKEN`, which starts no other workflows. They rely on the CI check that already passed on `main`'s tip commit, and the repository must allow GitHub Actions to create pull requests.
- This reverses #124's "no `release` branch". The rest of #124 and ADR 0003 stand.
