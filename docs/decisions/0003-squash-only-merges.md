# 0003. `main` accepts squash merges only

- Status: Accepted
- Date: 2026-10-04
- Links: the "Protect main" repository ruleset; `docs/CONTRIBUTING.md`

## Context

Every push to `main` deploys production on Vercel, and the board closes an issue when the pull request that says `Closes #N` merges. Branches collect several small commits, one per finished step, so merge commits or rebased branches would put every intermediate step on `main`.

## Decision

The "Protect main" ruleset, created on 4 October 2026, allows squash merges only. It also requires a pull request, resolved review threads, and the "Lint, typecheck and test" check passing on the pull request's own head commit; it blocks force pushes to `main` and its deletion. The branch does not have to be up to date with `main`, there are no required approvals, and GitHub auto-merge is turned off.

## Consequences

- Each pull request is one commit on `main`, titled with the pull request title and its number, so `git log` on `main` reads as a list of shipped issues and any one can be reverted alone.
- Commits on a branch can be as small as a step; their messages survive only in the squash commit body.
- Stacked pull requests merge in order. After the branch below is merged and deleted, GitHub retargets the next one to `main`.
- A merge attempted before CI finishes on the latest push is refused, so wait for the check rather than retrying.
