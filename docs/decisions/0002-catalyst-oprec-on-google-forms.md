# 0002. Catalyst oprec runs on Google Forms, not the site

- Status: Accepted
- Date: 2026-10-08
- Links: #32 (decision 1), #90, #104, shipped in #111

## Context

GDGoC Catalyst 2026/27 opens recruitment (oprec) on 2 November 2026, announces participants on 29 November, and starts sessions on 6 December. The Catalyst epic (#32) first planned an application form on the site, with role choice, a portfolio or motivation for Hacker and Hipster, and a problem brief for Hustler applicants, with results visible only from the announcement date. Program & Development already runs its forms on Google Forms.

## Decision

Oprec runs on Program & Development's Google Form. The site links to it from `/program/catalyst` while oprec is open (`oprecUrl` in `src/lib/catalyst.ts`, #90). The site's Catalyst work starts after the announcement, with an import of the accepted applicants into a cohort.

## Consequences

- The site does not store applications, so rejected applicants' data never reaches Convex.
- The hard date for the site moved from oprec (2 November) to session 1 (6 December).
- The enrolment import (#104, #111) depends on the results sheet: staff choose which columns hold the email, name and role, so any layout works.
- Consent to be added as a chapter member on gdg.community.dev is a question on the form, not on the site.
