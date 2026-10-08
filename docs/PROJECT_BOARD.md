# Project board

The roadmap lives on the org board, [GDGoC IPB project 1](https://github.com/orgs/gdgoc-ipb-university/projects/1). Claude Code cloud sessions can only call repository-scoped GitHub REST endpoints, so they cannot read or change an org project directly. The **Project board** workflow (`.github/workflows/project-board.yml`) does it for them: it runs on GitHub with an Actions secret, and a session starts it through the repository's Actions API.

## Setup

1. Create a fine-grained personal access token with resource owner **gdgoc-ipb-university**, repository access **Only select repositories → gdgoc-web**, repository permissions **Issues: Read-only** and **Pull requests: Read-only**, and organization permission **Projects: Read and write**. If the org requires approval, an owner approves it under org **Settings → Personal access tokens → Pending requests**.
2. Store it as the repository Actions secret `PROJECTS_TOKEN` (**Settings → Secrets and variables → Actions → New repository secret**).
3. Renew it before it expires and replace the secret's value.

## Use

Run **Actions → Project board → Run workflow**, or dispatch it through the API (`POST /repos/gdgoc-ipb-university/gdgoc-web/actions/workflows/project-board.yml/dispatches` with `ref: main`).

- `action: inspect` prints the board's fields with their options and every card with its values, in the job log and the run summary.
- `action: set` with `item` (an issue or PR number in this repository) and `fields` (for example `Status=In progress; Priority=High`) adds the issue or PR to the board if needed, then sets each field. Names and options match case-insensitively, dates are `YYYY-MM-DD`, and an empty value (`Target date=`) clears the field. Every value is checked before anything changes, so a typo changes nothing.

Only people with write access to the repository can start the workflow. The built-in board workflows (auto-add from this repository, item closed or PR merged → Done) still handle routine moves.
