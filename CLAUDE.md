@AGENTS.md

# Commits and pull requests

Do not credit or mention AI anywhere, unless a maintainer explicitly asks for it:

- Commit author and committer are the maintainer, never an AI identity. Cloud containers may set `user.name`/`user.email` to `Claude <noreply@anthropic.com>`; set them to `Aldio Lisafron <78518262+al-dioooo@users.noreply.github.com>` before the first commit and check `git log --format='%an <%ae> | %cn <%ce>'` before pushing.
- No `Co-Authored-By: Claude …` or `Claude-Session:` trailers in commit messages.
- No "Generated with Claude Code" footer or session link in pull request descriptions, issues, or comments. Tools may append one when posting; read the posted text back and remove it.
- No mention of AI in code, comments, or docs.

# Working on an issue

The full rules are in `docs/CONTRIBUTING.md`; these four are the ones to check every time.

- Post the approach on the issue before implementing: a short comment on what will change and where.
- Commit per logical step on the branch, with `pnpm check` and `pnpm test` green before each commit.
- Keep a pull request under about 500 changed lines, or split it into a stack of pull requests.
- Put screenshots and other evidence on the `yorha/pr-evidence` branch under `issue-<N>/<slug>/` and embed them in the pull request by raw URL, never on a new branch; never force-push or merge `yorha/pr-evidence`. See "Evidence" in `docs/CONTRIBUTING.md`.

# Releases

Production deploys from the `release` branch. Never push to `release`, and never merge a `main` → `release` pull request, unless the maintainer asks; see "Releasing" in `README.md`.

# Project board

Cloud sessions cannot call the org project board API. Read or update [project 1](https://github.com/orgs/gdgoc-ipb-university/projects/1) by dispatching the **Project board** workflow (`project-board.yml`, ref `main`) and reading its job log; see `docs/PROJECT_BOARD.md`.
