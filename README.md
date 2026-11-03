# PR evidence

Screenshots and other evidence for pull requests in `gdgoc-ipb-university/gdgoc-web`. This branch is an orphan: it shares no history with `main`, is never merged, and holds only evidence files.

## Layout

One folder per issue, then one subfolder per piece of work or attempt:

```text
issue-<N>/<slug>/<view>-<width>x<height>[-state].png
```

- `before-…` and `after-…` prefixes when a change is compared; plain names when there is no "before".
- Keep images small: PNG screenshots at 1× unless detail needs 2×, and crop to what matters.

## Linking from a pull request

Embed with the raw URL, so the image renders in the PR body:

```text
https://raw.githubusercontent.com/gdgoc-ipb-university/gdgoc-web/docs/pr-evidence/issue-<N>/<slug>/<file>.png
```

## Adding evidence

```sh
git fetch origin docs/pr-evidence
git worktree add ../pr-evidence docs/pr-evidence
# copy files into issue-<N>/<slug>/, then
git -C ../pr-evidence add issue-<N> && git -C ../pr-evidence commit -m "docs(evidence): screenshots for #<N>"
git -C ../pr-evidence push origin docs/pr-evidence
```

Never force-push this branch, and never open a pull request from it.

## Index

| Folder | Issue | Pull request |
| --- | --- | --- |
| `issue-132/sidebar` | #132 sidebar cut off on short windows | #133 |
| `issue-135/direction-a` | #135 member card, campus credential attempt | #136 (superseded) |
| `issue-135/lanyard-pass` | #135 member card, lanyard pass | #138, #140 |
| `issue-142/cr80` | #142 member card as a two-sided CR80 badge | #143, #144 |
| `issue-146/profile-photo` | #146 members upload their own profile photo (generated placeholder portrait) | #147 and its stack |
| `issue-105/role-tasks` | #105 Catalyst role tasks and mentors (fixture data) | #151 |
| `issue-107/teams` | #107 teams in a Catalyst cohort (fixture data) | stacked on #151 |
