# 0007. Members register as Member; staff assign Core Team

- Status: Accepted
- Date: 2026-11-03
- Links: #156, epic #34 ("Verified Core Team")

## Context

Members chose their own community tag: onboarding asked "Member or Core Team" with a division, and the profile page let them change it at any time. Only BoD was staff-only. Anyone could call themselves Core Team of any division, and the tag shows on the member card, gathering lists and the Tech Support queue and decides which assignments a member gets. Epic #34 asked for a Core Team tag staff can trust, with an open question about which roster counts. Staff could already set and confirm any tag from the members page (`tagConfirmedAt`).

## Decision

Registration is Member only. Members cannot choose Core Team, BoD or a division, in the UI or through the API; only owners and admins assign those from `/dashboard/anggota`. Tags members chose themselves before this decision are kept until staff change or confirm them.

## Consequences

- Onboarding has four screens, and the profile shows the tag read-only with whether staff confirmed it.
- No member-facing mutation accepts a tag, so a future feature that lets members ask for a change has to go through staff, for example as a request staff approve.
- New Core Team members appear as Member until staff assign them, so staff assign tags after each intake. The members page's tag confirmation filter still finds the older self-declared tags.
