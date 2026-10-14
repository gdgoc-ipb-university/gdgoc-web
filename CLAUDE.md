@AGENTS.md

# Commits and pull requests

Do not credit or mention AI anywhere, unless a maintainer explicitly asks for it:

- Commit author and committer are the maintainer, never an AI identity. Cloud containers may set `user.name`/`user.email` to `Claude <noreply@anthropic.com>`; set them to `Aldio Lisafron <78518262+al-dioooo@users.noreply.github.com>` before the first commit and check `git log --format='%an <%ae> | %cn <%ce>'` before pushing.
- No `Co-Authored-By: Claude …` or `Claude-Session:` trailers in commit messages.
- No "Generated with Claude Code" footer or session link in pull request descriptions, issues, or comments. Tools may append one when posting; read the posted text back and remove it.
- No mention of AI in code, comments, or docs.

# Project board

Cloud sessions cannot call the org project board API. Read or update [project 1](https://github.com/orgs/gdgoc-ipb-university/projects/1) by dispatching the **Project board** workflow (`project-board.yml`, ref `main`) and reading its job log; see `docs/PROJECT_BOARD.md`.
