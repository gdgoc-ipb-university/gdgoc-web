# Contributing

How a change moves from an issue to production in this repository. It is the house version of the leadership's GitHub repository guideline and pull request guideline, trimmed to what fits here (#124).

The [project board](https://github.com/orgs/gdgoc-ipb-university/projects/1) readme holds the working agreements. Where it already states a rule, this guide quotes it in one line and links the board; the board wins if the two ever disagree.

## How work starts

1. **Issue first.** Every change answers to an issue, opened from the bug, feature or task form. The repository is public, so keep private detail out: "No roster names, probation details or partner commercial terms in issues" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)).
2. **Approach comment.** Before writing code, post a short comment on the issue: what you will change, where, and anything that needs a decision. Two or three sentences are enough. If the plan needs the Lead or BoD, add the `needs-decision` label and wait.
3. **Board card.** The issue gets a card with Priority, Size and Area. Move it to In progress when you start: "In progress: Being worked on. Limit 3" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)). An XL item is split into sub-issues before anyone starts it.

## Branches and commits

"Branches are `yorha/<kebab-name>`; commit and PR titles follow Conventional Commits with the Area as scope" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)).

- **Trunk.** Branch from `main` and merge back into `main`. `main` is the integration branch, previewed on staging; production deploys from `release`, which only takes release pull requests (see [Releasing](#releasing)). The change type goes in the branch slug (`yorha/fix-filter-scroll`), not in a `feature/` or `fix/` prefix.
- **Granularity.** One logical change per commit, roughly 5 to 100 lines: a schema change, the function that uses it, the page, its tests, the docs. A commit should build and pass the tests on its own.
- **Frequency.** Commit when a step is finished, not at the end of the day. Several small commits on the branch are fine; the pull request is squashed into one commit on `main` ([ADR 0003](decisions/0003-squash-only-merges.md)).
- **Message.** `type(scope): description`, for example `feat(anggota): filter dialog with a shared Select`.
  - `type` is one of `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`.
  - `scope` is the board's Area, or the feature inside it, in lower-case kebab form: `program`, `bogor-run`, `anggota`, `tugas`, `apresiasi`, `cards`. Repository-wide docs use `readme`, `claude` or `repo`.
  - The description is lower-case, says what the change does, and has no full stop. Add a body when the reason is not obvious from the diff.
- **Checks before each commit.** `pnpm check` and `pnpm test` pass. Run `pnpm build` as well when routes, the build config or dependencies change.
- **Authorship.** Commit under your own name and email. Commit messages carry no tool trailers ([ADR 0004](decisions/0004-no-ai-attribution.md)).

## Pull requests

"One issue per PR. The PR body says `Closes #N`, so merging moves the card to Done" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)).

- **Title.** `type(scope): description (#issue)`, for example `docs(repo): adopt the contribution SOP (#124)`. The squash commit on `main` takes this title.
- **Size.** Keep a pull request under about 500 changed lines, not counting `pnpm-lock.yaml`, `convex/_generated/` or images. Larger work becomes a stack: each pull request is based on the previous one's branch, says in its body which part of the stack it is, and merges in order. GitHub retargets the next one to `main` when the branch below it is deleted.
- **Body.** Use the template in `.github/pull_request_template.md`:
  - **Summary:** what changed, `Closes #N`, and the Linear `GDG-xx` issue if there is one.
  - **Problem:** what was wrong or missing, and for whom.
  - **Solution:** how this solves it, and the choices a reader would not guess from the diff.
  - **Test evidence:** the check boxes, plus a screenshot for any UI change (see [Evidence](#evidence)) and what you checked by hand.
  - **Deployment prerequisites:** environment variables, Convex schema changes, deleted or renamed Convex functions. "None" when there are none.
  - **Notes:** follow-ups, open questions, and performance comparisons or migration steps when they apply.
- **Review.** "Human review only when asked for" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)). There are no required reviewers; ask on the pull request when you want one.
- **Merge.** CI ("Lint, typecheck and test") must pass on the pull request's own head commit, and `main` accepts squash merges only.
- **Done.** "Done means shipped: `pnpm test`, `pnpm check`, `pnpm build` pass, docs are updated, and user-facing changes are checked on production" ([board](https://github.com/orgs/gdgoc-ipb-university/projects/1)). The card moves to Done when the pull request merges to `main`; the production check follows the next release.

### Evidence

Screenshots, recordings and other images for a pull request go on one shared branch, `yorha/pr-evidence`, under `issue-<N>/<slug>/`. Its [README](https://github.com/gdgoc-ipb-university/gdgoc-web/blob/yorha/pr-evidence/README.md) gives the file names and the commands to add files.

- **Embed** each image in the pull request body by its raw URL, `https://raw.githubusercontent.com/gdgoc-ipb-university/gdgoc-web/yorha/pr-evidence/issue-<N>/<slug>/<file>.png`.
- **Index.** Add a row for the folder to the index table in that branch's README.
- **One branch.** Never create a per-PR evidence branch. `yorha/pr-evidence` is never merged and never force-pushed.

## Releasing

Production deploys from `release`, not `main` ([ADR 0006](decisions/0006-production-deploys-from-release.md)). A merge to `main` reaches the staging VM at https://gdgoc-ipb.yorhagarden.xyz and waits there for the next release.

1. The maintainer runs **Actions → Release → Run workflow**. It opens a `main` → `release` pull request, `chore(release): YYYY-MM-DD WIB`, listing every commit, pull request and closed issue it ships.
2. Check those changes on staging, and note in the release pull request any Convex schema change, deleted or renamed function, or new environment variable: the Vercel build deploys Convex production before the frontend.
3. Merge it with a merge commit, never squash. The "Protect release" ruleset allows only merge commits and requires the same CI check as `main`.
4. Check user-facing changes on https://www.gdgocipb.com once Vercel finishes.

A hotfix is a normal pull request to `main` followed by a release. Org admins can bypass the `release` ruleset only during an incident. Never push to `release` directly.

## Documentation

- **README.** `README.md` keeps an overview, the tech stack, how to run it locally, the environment variables, and deployment. A change that touches any of them updates the README in the same pull request.
- **Feature docs.** `docs/` holds one file per area (`DASHBOARD.md`, `APRESIASI.md`, `ONBOARDING.md`, `DESIGN.md`) and the evidence log `VERIFICATION.md`.
- **Decisions.** When a decision settles on an issue or epic, record it as an ADR in [`docs/decisions/`](decisions/README.md), so the reason stays findable after the issue closes.
- **Architecture.** [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) shows how the pieces connect. Update it when you add a service, an HTTP route handler or a deployment path.

## Security

- Never commit `.env` files, keys, tokens, OAuth client secrets, deploy keys or logs. `.gitignore` ignores `.env*` (except `.env.example`) and `*.log`; check `git status` before you commit anyway.
- Secrets live on each Convex deployment (`pnpm exec convex env set`) and in Vercel. The README's environment variable table says which goes where.
- Never commit real member data: exports, CSVs, screenshots with names or emails. Tests and fixtures use made-up people.
- If a secret is committed or pushed, rotate it first, then remove it. Rewriting history does not undo the exposure.
