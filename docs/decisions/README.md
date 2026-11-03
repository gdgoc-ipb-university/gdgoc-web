# Decision log

Each file here records one decision about the site or how it is built: what was decided, why, and what it costs. Decisions are made on issues and epics; a record keeps the reason findable after the issue is closed and its thread is long forgotten.

## When to write one

Write a record when a decision settles something a later change could undo by accident: a URL scheme, which system owns a flow, a repository rule. A choice that only affects one file belongs in a code comment or the pull request instead.

## Format

Copy [`0000-template.md`](0000-template.md) to the next free number with a short kebab-case title, for example `0007-tech-support-requests-in-the-dashboard.md`, and fill in:

- **Status:** Proposed, Accepted, or Superseded by a later record (link it).
- **Date:** the day the decision was made, not the day it was written down.
- **Links:** the issue, decision number, and pull request where it was made or shipped.
- **Context, Decision, Consequences:** a few sentences each.

Records are not edited after they are accepted, except to mark them superseded. A changed decision gets a new record.

## Records

| No. | Decision | Date |
| --- | --- | --- |
| [0001](0001-program-urls-without-a-year.md) | Program pages live at `/program/<slug>`, with no year | 2026-10-13 |
| [0002](0002-catalyst-oprec-on-google-forms.md) | Catalyst oprec runs on Google Forms, not the site | 2026-10-08 |
| [0003](0003-squash-only-merges.md) | `main` accepts squash merges only | 2026-10-04 |
| [0004](0004-no-ai-attribution.md) | No AI identity or attribution in commits, pull requests, code or docs | 2026-10-13 |
| [0005](0005-member-card-for-chapter-gatherings.md) | The member card checks people in at the chapter's own gatherings; public events stay on Bevy | 2026-11-01 |
| [0006](0006-production-deploys-from-release.md) | Production deploys from the `release` branch, not `main` | 2026-11-02 |
| [0007](0007-staff-assign-community-tags.md) | Members register as Member; only staff assign Core Team, BoD and divisions | 2026-11-03 |
