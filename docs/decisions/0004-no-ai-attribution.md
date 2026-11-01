# 0004. No AI identity or attribution in commits, pull requests, code or docs

- Status: Accepted
- Date: 2026-10-13
- Links: `CLAUDE.md`, shipped in #97

## Context

Some changes are drafted with a coding assistant. Cloud containers set the git author and committer to the assistant's identity, and posting tools can append a generated-by footer or a session link to pull requests and comments. Both slipped into #96 and were removed by hand.

## Decision

Unless a maintainer explicitly asks otherwise:

- The commit author and committer are the maintainer, never an AI identity. Check `git log --format='%an <%ae> | %cn <%ce>'` before pushing.
- Commit messages carry no attribution trailers such as `Co-Authored-By` or session ids.
- Pull requests, issues and comments carry no generated-by footer or session link. Read posted text back and remove one a tool appended.
- Code, comments and docs do not mention AI.

## Consequences

- History, pull requests and the public repository show the maintainer as responsible for every change.
- Tooling that adds attribution by default needs its output checked after each commit and post.
