# 0001. Program pages live at `/program/<slug>`, with no year

- Status: Accepted
- Date: 2026-10-13
- Links: #86 (decisions 5 and 6), #87, shipped in #96

## Context

Before the public pages epic (#86), Tech League had a top-level page at `/tech-league`, and Catalyst and Tech Support existed only as landing cards linking to Instagram. More program pages were coming (`/program/catalyst`, `/program/tech-support`), each with a `BreadcrumbList` in its JSON-LD. Programs run once per chapter year, so a URL could carry the edition.

## Decision

Program pages are nested under `/program/<slug>`, so the breadcrumb matches the path and a new program cannot collide with a top-level route. `/tech-league` moved to `/program/tech-league` with no redirect, because no poster or post carried the old URL yet.

Program URLs carry no year. Each program keeps one evergreen page; an archive such as `/program/tech-league/2026` is added only when a second edition needs it.

## Consequences

- Posters, posts and links stay valid across editions, and search results keep pointing at the current one.
- Each new edition replaces the page's content, so the previous edition's schedule is not on the site unless an archive page is added.
- A new program page goes under `src/app/program/`, adds its path to `indexablePaths` in `src/lib/site.ts`, and builds its breadcrumb with `src/lib/breadcrumb.ts`.
