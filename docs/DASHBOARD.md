# Dashboard: roles, assignments, and members

`/dashboard` is the signed-in area for members and administrators, and the home of Apresiasi. It uses Google sign-in (Better Auth on Convex) and the onboarding member profile. No extra OAuth scopes or environment variables are required.

## Routes

| Route | Member | Owner / admin |
| --- | --- | --- |
| `/dashboard` | Open, pending, and submitted counts; nearest deadlines | Member counts, recent assignments, shortcuts |
| `/dashboard/tugas` | Open and closed assignments with their own submission status | All assignments, including drafts, with submission and late counts |
| `/dashboard/tugas/baru` | — | Create as draft or open immediately |
| `/dashboard/tugas/<slug>` | Instructions and submission form | Instructions, status controls, and every submission with files |
| `/dashboard/tugas/<slug>/ubah` | — | Edit title, slug, instructions, and deadline |
| `/dashboard/apresiasi` | Appreciation drafts and submissions | Same |
| `/dashboard/apresiasi/tinjau` | — | Apresiasi review queue (owners only) |
| `/dashboard/anggota` | — | Search, filter (admin, core team, deactivated), promote/demote admins, correct community roles, deactivate/reactivate members |
| `/dashboard/profil` | Profile facts and community role | Same |

Signed-out visitors see a Google sign-in panel that returns them to the page they opened, e.g. a shared assignment link. A first sign-in goes through `/onboarding`. Onboarded accounts without a community role (they onboarded before the role step) get a one-screen role prompt before the dashboard opens. The old `/apresiasi` and `/apresiasi/admin` URLs redirect permanently to the dashboard pages (`next.config.ts`).

## Layout and icons

Signed-in pages use a sticky sidebar grouped into Belajar, Kelola (staff only), and Akun, with the account, role badges, a link back to the site, and sign-out at the bottom. Below 960px it becomes a drawer opened from the top bar; opening moves focus into it, and Escape or the backdrop closes it. Sign-in, onboarding, role prompt, and deactivated states keep the public site header instead.

Icons are [Pixelarticons](https://pixelarticons.com) (MIT) path data copied into `src/components/pixel-icons.tsx`; add new icons there as 24×24 paths.

## Roles

- **Owner:** a verified Google email in the Convex `APPRECIATION_ADMIN_EMAILS` allowlist, the same list that controls Apresiasi review. Owners are permanent: they cannot be demoted or deactivated from the dashboard. Only owners can promote or demote admins.
- **Admin:** a member promoted by an owner, stored as `memberProfiles.role = "admin"`. Admins manage assignments, see all submissions, and can deactivate or reactivate members (not admins or owners). Dashboard admins do **not** gain Apresiasi review access; that stays with the allowlist.
- **Member:** any verified account that has completed onboarding. There is no approval step.

These access roles are separate from the self-declared **community role** (Member or Core Team with a division) chosen during onboarding. The community role is a label only and grants no permissions.

Deactivation sets `memberProfiles.deactivatedAt`. A deactivated account can still sign in but sees only a notice; every assignment query and mutation rejects it. Its submissions are kept. An admin must be demoted before deactivation, and a deactivated member must be reactivated before promotion. Nobody can change their own status. `accessUpdatedBy` records the last account that changed a role or status.

All rules are enforced in Convex (`convex/access.ts`, `convex/dashboard.ts`, `convex/assignments.ts`); the UI only hides actions the server would refuse.

## Assignments

An assignment has a title, a slug, plain-text instructions (line breaks preserved), a deadline, and a status:

- `draft`: visible only to owners and admins. It can be deleted while it has no submissions.
- `published`: visible to active members, who can submit and resubmit.
- `closed`: visible read-only. No new or updated submissions.

### Slugs

The slug fills in from the title as it is typed (lowercase ASCII words joined by hyphens, `&` becomes `dan`, accents removed, at most 60 characters) until an admin edits it; "Samakan dengan judul" re-links it. `assignments.slugPreview` shows the final slug live. A slug used by another assignment gets `-2`, `-3`, and so on; `baru` is reserved for the create page. Every slug an assignment has had stays in `assignmentSlugs`, so renamed links, and older ID-based links, redirect to the current URL. "Salin link" copies the full slug URL.

An assignment with submissions cannot return to draft or be deleted; close it instead. Deadlines are entered and shown in WIB (UTC+7). Edits use revision checks, so a stale tab cannot silently overwrite a newer version.

### Submissions and files

A submission is a text answer (up to 5,000 characters) and/or up to five files of at most 10 MB each: PDF, PNG, JPG, WebP, TXT, ZIP, DOCX, PPTX, or XLSX. Each member has one submission per assignment. Resubmitting replaces the answer and file set and updates the submission time.

**Late** is computed as `submittedAt > dueAt` whenever it is read, so moving a deadline also updates the flags. Work after the deadline is accepted and marked late until an admin closes the assignment. Resubmitting after the deadline marks previously on-time work late; the form warns about this.

Upload flow:

1. `assignments.generateUploadUrl` returns a Convex storage upload URL when the assignment is open.
2. The browser posts the file with its type as `Content-Type`.
3. `assignments.attachFile` checks the stored size and type against the extension, and records a pending `submissionFiles` row owned by the member. A rejected file is deleted, and a message is returned instead of an error, so the deletion commits. An upload ID can be claimed only once.
4. `assignments.submit` attaches the selected pending files, and deletes previously attached files that were removed.

The hourly `remove unclaimed assignment uploads` cron (`convex/crons.ts`) deletes pending files older than 24 hours, plus storage objects created 24–72 hours ago that no `submissionFiles` row references (uploads that were never registered). **Assignment submissions are currently the only feature that stores files.** A new storage feature must be added to that check, or its files will be removed.

File URLs come from `ctx.storage.getUrl`. They are unguessable, but not authenticated, and are returned only to the submitting member and to admins.

## Data model

- `memberProfiles`: adds optional `role`, `deactivatedAt`, `accessUpdatedBy`, `memberType` (`member`/`core`), and `division`, a `by_completed` index, and a `search_name` full-text index on `fullName`.
- `assignments`: optional `slug`, plus `by_status_due` and `by_updated` indexes.
- `assignmentSlugs`: every slug an assignment has used (`by_slug`, `by_assignment`).
- `assignmentSubmissions`: one row per member per assignment (`by_assignment_owner`).
- `submissionFiles`: pending or attached uploads (`by_storage`, `by_submission`, `by_owner_assignment`, `by_assignment`).

All schema changes are additive, so the previous frontend keeps working during a backend-first deploy.

## Tests

- `convex/dashboard.test.ts`: role derivation, owner-only promotion, deactivation rules, member search, staff role corrections, and the core team filter.
- `convex/members.test.ts`: the role step, division validation, and `saveRole` after onboarding.
- `convex/assignments.test.ts`: slug derivation, collisions, reserved slugs, renamed-link lookup, draft visibility, revision conflicts, submissions with files, late flags, admin-only submission lists, server-side upload validation, resubmission file replacement, closed assignments, and upload cleanup.
- `src/lib/assignment.test.ts`: WIB conversion, file-type checks, file-name cleaning, and slugify. convex-test does not record upload content types, so type mismatches are tested here.
- `src/components/dashboard/submission-form.test.tsx`: axe semantics, validation, local file rejection, uploads, pending and attached file removal, and the late warning.

## Not included

Grading, feedback, revision requests, and group targeting are not built. The admin view lists who submitted, but not which active members have yet to submit.
