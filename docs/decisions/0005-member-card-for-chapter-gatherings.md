# 0005. The member card checks people in at the chapter's own gatherings; public events stay on Bevy

- Status: Accepted
- Date: 2026-11-01
- Links: #113 (decision 1), #114 to #117, shipped in #119, #120, #121 and #122

## Context

Gatherings checked people in with Bevy's RSVP QR. That fits public events, but for the chapter's own meetings every attendee needed a gdg.community.dev account and an RSVP per event, the door saw a Bevy ticket rather than who the person is in the community, and the attendance list stayed in Bevy, apart from the dashboard where members, community tags and divisions live. The Lead asked for a member card on the site, like a KTM, with a QR that staff scan at the door.

## Decision

The chapter's own gatherings (Core Team meetings, member meetups) check people in with the member card: `/dashboard/kartu` shows it, its QR opens `/k/<token>`, and staff or door helpers record attendance from there or from a list in `/dashboard/kehadiran`. Public events stay on Bevy, where their RSVPs and the chapter's event history already live.

## Consequences

- Attendance for chapter gatherings lives in Convex next to the member records, and downloads as a CSV.
- Two check-in systems run side by side, and staff choose by event type: chapter gathering on the site, public event on Bevy.
- Catalyst participants still reach Bevy through the participants CSV for its member import (#112).
- Catalyst session attendance (#109) reuses whichever check-in model ships first.
