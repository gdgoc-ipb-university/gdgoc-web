# Dashboard: roles, assignments, and members

`/dashboard` is the signed-in area for members and administrators, the home of Apresiasi, and the full Bogor Run leaderboard. It uses Google sign-in (Better Auth on Convex) and the onboarding member profile. No extra OAuth scopes or environment variables are required.

## Routes

| Route | Member | Owner / admin |
| --- | --- | --- |
| `/dashboard` | Open, pending, and submitted counts; nearest deadlines | Member counts, recent assignments, shortcuts |
| `/dashboard/tugas` | Open and closed assignments for their community tag, with their own submission status | All assignments, including drafts, with audience, submission and late counts |
| `/dashboard/tugas/baru` | — | Create as draft or open immediately |
| `/dashboard/tugas/<slug>` | Instructions and submission form | Instructions, status controls, every submission with files and its review, and who has not submitted |
| `/dashboard/tugas/<slug>/ubah` | — | Edit title, slug, instructions, audience, and deadline |
| `/dashboard/apresiasi` | Appreciation drafts and submissions | Same |
| `/dashboard/apresiasi/tinjau` | — (unless granted review) | Apresiasi review queue: owners, admins, and anyone an owner made a reviewer |
| `/dashboard/anggota` | — | Search, filter (admin, reviewer, core team, BoD, deactivated), promote/demote admins, grant/revoke Apresiasi review, set community tags (including BoD), deactivate/reactivate members; owners can download every onboarded member as CSV (name, email, campus, study program, community tag and division, access, status, Apresiasi review, joined in WIB), built in the browser from the owners-only `dashboard.exportMembers` with the submissions export's encoding (`src/lib/member-export.ts`) |
| `/dashboard/anggota/<id>` | — | One member for staff: the member row with its actions, assignment submissions with status and score, sent Apresiasi with status and post link (drafts are only counted), assignments they review, joined date, and who last changed their access (`dashboard.member`). Names in the members list link here. Owners also get **Hapus akun** for deletion requests: typing the member's name confirms it, and `dashboard.deleteAccount` removes the profile, Apresiasi with their review rows, submissions with their files and review rows, pending uploads, Bogor Run rows, reviewer grants, and the Better Auth user, accounts and sessions. Other people's rows keep the bare account ID. Owner accounts cannot be deleted this way |
| `/dashboard/anggota/riwayat` | — | Owners only: the access log, newest first (`dashboard.accessLog`). Each row says who changed what for whom, with the value before and after: admin role, Apresiasi reviewer, deactivation, community tag, assignment reviewer, and account deletion. No-op calls are not logged. Rows keep account IDs only, so names are looked up when read and a deleted account appears without a name. Owners also see one member's log on `/dashboard/anggota/<id>`, and the members page links here. Bogor Run hiding keeps its own audit fields on `gamePlayers` |
| `/dashboard/papan-skor` | Bogor Run top 100 this week and all time, with your own rank | Same, plus hide controls and a separate "Disembunyikan" list to restore from |
| `/dashboard/profil` | Profile facts and community role | Same |

Signed-out visitors see a Google sign-in panel that returns them to the page they opened, e.g. a shared assignment link. A first sign-in goes through `/onboarding`. Onboarded accounts without a community role (they onboarded before the role step) get a one-screen role prompt before the dashboard opens. The old `/apresiasi` and `/apresiasi/admin` URLs redirect permanently to the dashboard pages (`next.config.ts`).

## Layout and icons

Signed-in pages use a sticky sidebar grouped into Belajar, Kelola (staff only), and Akun, with the account, role badges, a link back to the site, and sign-out at the bottom. Below 960px it becomes a drawer opened from the top bar; opening moves focus into it, and Escape or the backdrop closes it. Sign-in, onboarding, role prompt, and deactivated states keep the public site header instead.

Icons are [Pixelarticons](https://pixelarticons.com) (MIT) path data copied into `src/components/pixel-icons.tsx`; add new icons there as 24×24 paths. The `gamepad` icon for Papan skor is hand-drawn in the same grid, not copied from Pixelarticons.

## Roles

- **Owner:** a verified Google email in the Convex `APPRECIATION_ADMIN_EMAILS` allowlist. Owners are permanent: they cannot be demoted or deactivated from the dashboard, and they always review Apresiasi. Only owners can promote or demote admins and grant or revoke Apresiasi review.
- **Admin:** a member promoted by an owner, stored as `memberProfiles.role = "admin"`. Admins manage assignments, see all submissions, review Apresiasi, and can deactivate or reactivate members (not admins or owners). Demoting an admin to member ends the review access that came with the role.
- **Assignment reviewer:** an active member staff added to one assignment's `reviewers` (see *Assignment reviewers*). Not a role: it applies to that assignment only.
- **Member:** any verified account that has completed onboarding. There is no approval step.

**Apresiasi reviewer** is a permission, not a role: `memberProfiles.appreciationReviewer`, granted and revoked by owners from the members page for active members, typically the Media & Creative people who prepare the posts. Owners and admins review by role, so the grant is not offered for them. `isReviewer` in `convex/auth.ts` is the single check (owner, or an active admin, or granted and not deactivated), used by `appreciations.queue`/`search`/`history`/`review`, `auth.viewer`, and `dashboard.viewer`. Deactivation suspends the permission without clearing it; revoking removes the field. A reviewer who is not staff sees only "Tinjau apresiasi" under Kelola.

These access roles are separate from the **community tag**. Members choose Member or Core Team (with a division) themselves during onboarding and on their profile. **BoD** (Board of Directors) is a third tag that only owners and admins assign, from the members page, with an optional division. A BoD member sees their tag read-only on the profile and cannot change it themselves. Community tags grant no permissions; they only decide which assignments a member is given (see [Audience](#audience)). New Apresiasi drafts prefill the tag (Member, Core Team, or BoD), and the server accepts "BoD" as a submission's role only from a member tagged BoD.

Deactivation sets `memberProfiles.deactivatedAt`. A deactivated account can still sign in but sees only a notice; every assignment query and mutation rejects it. Its submissions are kept. It also disappears from every Bogor Run board, and reactivation brings it back unless staff hid the player separately (see [Moderation](#names-and-moderation)). An admin must be demoted before deactivation, and a deactivated member must be reactivated before promotion. Nobody can change their own status. `accessUpdatedBy` records the last account that changed a role or status, and the access log (`/dashboard/anggota/riwayat`) keeps every change.

All rules are enforced in Convex (`convex/access.ts`, `convex/dashboard.ts`, `convex/assignments.ts`, `convex/bogorRun.ts`); the UI only hides actions the server would refuse.

### Access matrix

| Who | Can use |
| --- | --- |
| Owner only | `dashboard.exportMembers`, `accessLog`, `setRole`, `setReviewer`, `deleteAccount` |
| Staff (owner, admin) | `dashboard.members`, `member`, `stats`, `setActive`, `setMemberType`; `assignments.adminList`, `slugPreview`, `create`, `update`, `setStatus`, `remove`, `setReviewer`; `bogorRun.setHidden` |
| Staff and that assignment's reviewers | `assignments.submissions`, `exportPage`, `missing`, `review`, `requestRevision`, `cancelRevision` |
| Staff and granted Apresiasi reviewers | `appreciations.queue`, `search`, `history`, `review` |
| Active, onboarded members | `assignments.list`, `get`, `reviewing`, the member's own uploads and `submit` (for assignments in their audience, see [Audience](#audience)); `bogorRun.board` |
| Own data, or anyone | `members.*` and the Apresiasi draft functions (own), `auth.configuration`, `auth.viewer`, `dashboard.viewer`, `bogorRun.issueRun`, `submitRun`, `leaderboard` |

`convex/access.test.ts` checks this table against eight kinds of account: a guest, a signed-in account without onboarding, a deactivated member, a member, a granted Apresiasi reviewer, an assignment reviewer, an admin and an owner. Every query must answer only its row. Every mutation must turn away the other accounts for access, not for its arguments, and then accept the narrowest allowed account with the same arguments. The test also reads every public function from `convex/*.ts` and fails when one is missing from the matrix or the open list, so a new function has to be placed before it ships.

### Decision: owners stay in configuration

Owners come from the `APPRECIATION_ADMIN_EMAILS` environment variable on the Convex deployment, not from the database, and the dashboard cannot add, remove or demote them. Decided for E7 (#35), 9 October 2026.

- **Why:** the chapter has one or two owners a year, and they change at the handover. A database owner role would need its own guard against the last owner removing themselves, and a stolen admin session could not promote itself to owner. The allowlist needs neither.
- **Cost:** changing owners needs someone with Convex dashboard or CLI access to edit the variable. The handover checklist should include it.
- **How to change:** set `APPRECIATION_ADMIN_EMAILS` on the production deployment to the comma-separated Google emails (see `docs/APRESIASI.md`). The change applies on the next request; no deploy is needed. An owner who is removed becomes a member, or an admin if `memberProfiles.role` is still set.

## Assignments

An assignment has a title, a slug, plain-text instructions (line breaks preserved), an audience, a deadline, a maximum score (default 100), and a status:

- `draft`: visible only to owners and admins. It can be deleted while it has no submissions.
- `published`: visible to active members in its audience, who can submit and resubmit.
- `closed`: visible read-only. No new or updated submissions.

### Audience

Each assignment is given to one or more community tags, ticked on the create and edit forms under "Untuk siapa": **Member**, **Core Team**, and **BoD** (#79). Ticking all three gives it to every member. BoD is its own group: a Core Team assignment does not reach BoD unless BoD is ticked too. At least one tag is required, and new assignments start with Member only.

`assignments.audience` stores the tags. Assignments created before the field existed have none and are read as Core Team only (`assignmentAudience`, `legacyAudience` in `src/lib/assignment.ts`); every assignment in production on 9 October 2026 was for the core team. Editing one from a tab loaded before this change keeps its audience instead of applying the default.

A member outside the audience gets nothing: the assignment is missing from their list and overview, its link shows "Tugas tidak ditemukan", and `generateUploadUrl`, `attachFile`, and `submit` refuse it (`reaches` in `convex/assignments.ts`). Owners and admins are never in an audience, but they see and manage every assignment. An assignment's reviewers keep the reviewer view whatever its audience. Staff can change the audience at any time. A member dropped from it keeps their submission and review, which staff still see and score, but the assignment no longer appears for them, an open revision request included.

Staff see the audience as an "Untuk …" badge on the assignment list and page.

### Slugs

The slug fills in from the title as it is typed (lowercase ASCII words joined by hyphens, `&` becomes `dan`, accents removed, at most 60 characters) until an admin edits it; "Samakan dengan judul" re-links it. `assignments.slugPreview` shows the final slug live. A slug used by another assignment gets `-2`, `-3`, and so on; `baru` is reserved for the create page. Every slug an assignment has had stays in `assignmentSlugs`, so renamed links, and older ID-based links, redirect to the current URL. "Salin link" copies the full slug URL.

An assignment with submissions cannot return to draft or be deleted; close it instead. Deadlines are entered and shown in WIB (UTC+7). Edits use revision checks, so a stale tab cannot silently overwrite a newer version.

### Submissions and files

A submission is a rich-text answer (up to 5,000 characters) and/or up to five files of at most 10 MB each: PDF, PNG, JPG, WebP, TXT, ZIP, DOCX, PPTX, or XLSX. Each member has one submission per assignment. Resubmitting replaces the answer and file set and updates the submission time.

### Rich-text answers

The answer uses a [Tiptap](https://tiptap.dev) editor (`src/components/dashboard/rich-text-editor.tsx`). Its toolbar follows the WAI-ARIA toolbar pattern: one tab stop, with arrow keys, Home, and End to move between tools. It offers bold, italic, underline, strikethrough, inline code, two heading levels, bulleted and numbered lists, quotes, code blocks, links (Ctrl/⌘ + K opens an inline link bar), undo, and redo. Standard shortcuts apply, and a counter shows the 5,000-character limit. Toolbar icons come from `src/components/pixel-icons.tsx`. Pixelarticons has no text-formatting icons, so bold, italic, underline, strikethrough, and numbered list were drawn in the same 24×24 pixel grid.

Answers are stored twice: `answerDoc`, the editor's JSON, and `answer`, a plain-text copy used for previews and older clients. `src/lib/rich-text.ts` rebuilds every document through an allowlist, on the server in `assignments.submit` and again before rendering:

- Only known nodes and marks are accepted. Any other node or mark rejects the whole document.
- Links must be absolute `http:`, `https:`, or `mailto:` URLs; any other link is removed and its text kept.
- Depth, node count, and JSON size are bounded.
- The character limit is counted the way the editor counts: text plus one per line break or divider.

`RichTextView` renders the stored JSON with React elements rather than `innerHTML`. Anything that fails the allowlist falls back to the plain text. Earlier plain-text answers open in the editor as paragraphs, and clients from before this change can still send plain text, which clears the stored document.

**Late** is computed as `submittedAt > dueAt` whenever it is read, so moving a deadline also updates the flags. Work after the deadline is accepted and marked late until an admin closes the assignment. Resubmitting after the deadline marks previously on-time work late; the form warns about this.

Upload flow:

Files are added from the dropzone (`src/components/dashboard/file-dropzone.tsx`) by drag and drop or the "Pilih file" button. The zone highlights while a file is dragged anywhere over the page. A file dropped outside the zone is ignored, rather than opening in the browser and leaving the form. Extra files beyond the five slots are skipped with a message.

Images are optimised in the browser first (`src/lib/image-optimize.ts`). PNG, JPEG, and WebP files are decoded (honouring EXIF orientation), downscaled to at most 2560 px on the long edge, and re-encoded as WebP at quality 0.82. The WebP is used only when it is smaller; browsers that cannot encode WebP keep the original. Re-encoding drops EXIF metadata such as GPS location. Because compression happens first, images up to 25 MB are accepted if the result fits the 10 MB limit. The file list shows the saving. PDF, Office, and ZIP files are already compressed containers, so they are uploaded unchanged; TXT files are small. The server still validates the final name, type, and size.

1. `assignments.generateUploadUrl` returns a Convex storage upload URL when the assignment is open.
2. The browser posts the file with its type as `Content-Type`, using `XMLHttpRequest` so each file shows a progress bar and can be cancelled.
3. `assignments.attachFile` checks the stored size and type against the extension, and records a pending `submissionFiles` row owned by the member. A rejected file is deleted, and a message is returned instead of an error, so the deletion commits. An upload ID can be claimed only once.
4. `assignments.submit` attaches the selected pending files, and deletes previously attached files that were removed.

The hourly `remove unclaimed assignment uploads` cron (`convex/crons.ts`) deletes pending files older than 24 hours, plus storage objects created 24–72 hours ago that no `submissionFiles` row references (uploads that were never registered). **Assignment submissions are currently the only feature that stores files.** A new storage feature must be added to that check, or its files will be removed.

File URLs come from `ctx.storage.getUrl`. They are unguessable, but not authenticated, and are returned only to the submitting member and to admins.

### Who has not submitted

Below the submissions, a published or closed assignment lists the active, onboarded members without a submission (`assignments.missing`), alphabetically, with a "Salin daftar nama dan email" button that copies one `Nama — email` line per member for a reminder. Only members in the assignment's audience are counted ("x dari y member sasaran"). Owners and admins are not expected to submit and are left out of both the list and the count; deactivated accounts are hidden.

### Scores and feedback

Staff review each submission from the assignment page: a whole-number score from 0 to the assignment's `maxScore` (`assignmentMaxScore`, 100 for assignments created before the field existed), feedback of up to 2,000 characters, or both. `assignments.review` stores the latest review on the submission (`score`, `feedback`, `reviewedAt`, `reviewedBy`) and appends a row to `submissionReviews`, so re-reviews keep their history. Saving feedback without a score clears a previous score; the form prefills the current values so that is a deliberate act.

The review carries the submission `revision` the reviewer saw. If the member resubmitted in between, the server refuses with "Member memperbarui kirimannya…" and the reviewer reloads. A resubmission after a review keeps the score but is **stale** (`isStaleReview`: `submittedAt > reviewedAt`): staff see "Diperbarui setelah dinilai" and a prompt to look again, the member sees that the score applies to the earlier version, and `reviewedCount` on the staff list counts only current reviews.

Members see a result card above their form (or above the closed notice): the score out of the maximum, the feedback, when and by whom (the reviewer's display name, never their email), plus "Dinilai x/y" badges on the assignment list. Only the owner of a submission and staff can read a review.

### Rubrics

An assignment can carry a **rubric**: up to 8 criteria, each with a name (≤ 80 characters) and a whole-number maximum of at least 1, with the maxes summing to at most 1,000. With a rubric, `maxScore` is the sum of the maxes (the form shows it read-only), and members see the criteria and their points under the instructions. Blank rows in the editor are dropped on save.

Reviewing a rubric assignment means filling one point value per criterion, in rubric order; `assignments.review` takes them as `points`, checks each against its criterion's max, and stores the sum as `score` together with a `breakdown` (each criterion's name, max and points, as the rubric stood at that moment) on the submission and on the `submissionReviews` row. Sending a bare `score` for a rubric assignment is refused, as are a `points` array whose length does not match the current rubric and `points` for an assignment whose rubric was removed (the reviewer reloads). Feedback alone clears both score and breakdown. The member's result card shows the breakdown as it was scored, so a later rubric edit does not relabel a past review; the review form prefills earlier points only when they were given against the current criteria. Catalyst's capstone rubric (the product plus each role's contribution) is one such rubric, written by Program & Development.

### Assignment reviewers

Staff can add members as reviewers of one assignment from its page ("Penilai tugas ini"), e.g. a Catalyst role's mentors, up to 10 per assignment. `assignments.setReviewer` accepts only active, onboarded members; admins and owners already review every assignment. A reviewer of an assignment gets its staff view: the submissions with answers and files, scoring (rubric points included), revision requests, the "who hasn't submitted" list, and the CSV export. Emails are hidden from reviewers in all of them, and they do not see the edit, publish, close, delete or reviewer controls. Their assignments page lists "Tugas yang kamu nilai" with how many submissions wait for a review (`assignments.reviewing`). Every review path (`submissions`, `missing`, `exportPage`, `review`, `requestRevision`, `cancelRevision`) runs the same `requireReviewer` check, and an assignment's reviewers are left out of its "who hasn't submitted" counts. Removing a reviewer, or deactivating the account, ends the access.

### Revision requests

From the review form, "Minta revisi" asks one member to revise their submission. The note is the text in the feedback field, and it is required. `assignments.requestRevision` takes the submission revision the reviewer saw (a resubmission in between is refused, as with scoring), stores the note as the submission's feedback, sets `revisionRequestedAt`, and keeps the score until the revision is reviewed. Every request is also a `submissionReviews` row with `revisionRequested: true`.

While a request is open, that member can upload and resubmit even after the assignment is closed; everyone else still sees it closed. The member sees "Peninjau meminta revisi." with the note, a "Revisi diminta" badge on the assignment, in the list and on the overview, and the form reopens. Resubmitting clears the request, and the review then shows as *Diperbarui setelah dinilai* until it is reviewed again. Staff see "Revisi diminta" on the submission, a count in the list header, and can withdraw an unanswered request with "Batalkan permintaan revisi" (`assignments.cancelRevision`). Submissions with an open request are not counted as reviewed.

### Export

"Unduh CSV" next to the submission counts downloads every submission of the assignment with its review: name, campus, submitted at (WIB), late, review status (*Belum dinilai*, *Dinilai*, *Diperbarui setelah dinilai*), score, maximum, feedback, reviewer, reviewed at (WIB) and attachment names, sorted by name. With a rubric, each current criterion gets a points column, filled only when the review was scored against the same criteria, and *Rincian rubrik* holds the breakdown as it was scored. The email column is included for owners only, because the file leaves the dashboard; admins get the same file without it.

The file is built in the browser from `assignments.exportPage`, read 100 submissions at a time, as UTF-8 with a byte order mark and CRLF line ends so Excel opens it cleanly. Text cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading apostrophe so a spreadsheet does not run them as formulas. The builder is `src/lib/assignment-export.ts`.

## Papan skor (Bogor Run leaderboard)

Bogor Run is the runner game in the landing-page footer (`public/games/bogor-run/README.md`). Anyone can play. Saving a score needs a verified Google account that is not deactivated; onboarding is not required. The game's pause and game-over panel shows the weekly and all-time top 10 to everyone, guests included, and links here with "Lihat 100 besar".

### The page

`/dashboard/papan-skor` has two tabs, "Minggu ini" (with the week's dates) and "Sepanjang masa". Both boards stay subscribed, so switching is instant; arrow keys, Home, and End move between tabs. The stats row shows your rank for the period (`#n`, "1.000+" past the 1,000 ranks that are counted, or "—" while hidden), your best, and the period's player and run counts.

The table lists up to 100 visible players with rank, short name, score, and when the score was reached (WIB). Tied scores share a rank; among ties, whoever reached the score first is listed first. Your row is highlighted with a "Kamu" badge, and a "Lihat barismu" link jumps to it when it is below the top 10. An empty board links to the game at `/#join`.

### Names and moderation

The public name is `shortName()` of the onboarding full name, or the Google name without a profile: the first name and the last initial ("Aldio Lisafron" → "Aldio L."). A one-word name has nothing to shorten and is shown whole ("Sukarno" stays "Sukarno"); the privacy page says so. A leading initial such as "M." is skipped, invisible characters are dropped, and names are capped at 24 characters. The name is refreshed whenever the player improves a best. No query returns owner ids, emails, or photos.

The ranked table holds visible players only. Owners and admins also get a staff-only **Disembunyikan** section below it (`#board-hidden`): up to 100 hidden players of the period, highest score first. They are listed apart from the top 100, so hidden players never push anyone off it, and a hidden player with a low score is still listed (up to the cap in [Limits](#limits)). Each row says who hid the player, as which role, and when ("Disembunyikan oleh Rahma D. (pemilik) pada …"), or that the account is deactivated, with a "Nonaktif" badge. "Sembunyikan" and "Tampilkan lagi" ask for confirmation, then call `bogorRun.setHidden`, which hides or restores the player on every board, including bests they set later. Hidden scores stay stored; public ranks are counted without them. The player sees a notice on this page and "disembunyikan admin" in the game.

Who may hide or restore whom is modelled on `dashboard.setActive`:

- Nobody can hide or restore themselves.
- Admins act only on members. Only owners act on admins and on other owners.
- An admin cannot restore a player an owner hid. Hiding a player who is already hidden changes nothing, so the original hider (and their role) stays on record.
- A player hidden only because their account is deactivated comes back when it is reactivated, and `setHidden` refuses to restore them (`INACTIVE`). Restoring a deactivated player whom staff also hid clears the staff hide; the score returns on reactivation, and the confirmation says so.

`board` applies the same rules per row (`canHide`, `canRestore`), and the page offers a button only where the server would accept it. Otherwise the row shows a lock with "Khusus pemilik" or "Tampil saat akun aktif", and your own row shows nothing. A refusal from the server (`FORBIDDEN` or `INACTIVE`, with an Indonesian message) appears in the confirmation row.

`gamePlayers` keeps the audit: `hiddenAt` while staff hide the player, `hiddenBy` and `hiddenByRole` for the last hide (kept after a restore), and `restoredAt` and `restoredBy` for the last restore. `gameBests.hidden` is derived from it and from the account: a best is hidden while staff hide the player or while the account is deactivated. `syncBoardVisibility` recomputes it, and both `setHidden` and `dashboard.setActive` call it.

### Functions

| Function | Access | Purpose |
| --- | --- | --- |
| `bogorRun.issueRun` | Public mutation | A random seed and its signed token. Writes nothing. |
| `bogorRun.submitRun` | Verified, active account | Replays a crashed or finished run and saves its score |
| `bogorRun.leaderboard` | Public query | Top 10 visible players and the viewer's own standing |
| `bogorRun.board` | Members (`requireMember`) | Top 100 visible players with `achievedAt`, `canHide`, and player/run counts; staff also get `hiddenEntries` (up to 100, with the audit fields, `inactive`, and `canRestore`) and `canModerate` |
| `bogorRun.setHidden` | Staff (`requireStaff`), under the rules above | Hides or restores a player on every board |
| `bogorRun.pruneRuns` | Internal, daily cron | Deletes `gameRuns` rows older than 30 days |

`submitRun` returns `{ ok: false, code, message }` for expected rejections (`UNAUTHENTICATED`, `DEACTIVATED`, `INVALID`, `TOO_EARLY`, `EXPIRED`, `USED`, `OUTDATED`) with an Indonesian message, instead of throwing. A rank is `null` when the player is hidden or past 1,000. `setHidden` throws a `ConvexError` with `{ code, message }`: `FORBIDDEN`, `INACTIVE`, or `NOT_FOUND`.

### Replay verification

1. **Token.** The browser sends its `ENGINE_VERSION` (`engine.ts`). `issueRun` rolls a uint32 seed and signs `{ v: 2, engine, seed, issuedAt, nonce }` (base64url JSON plus an HMAC-SHA256 signature, `convex/bogorRunToken.ts`). A browser on another engine version gets `{ outdated: true }`; it stops asking for tickets and says to reload the page for ranked play. Clients from before engine versions send none and count as engine 1; once the engine moves on they get `null` and play unranked. Tokens signed before engine versions (`v: 1`) still verify as engine 1. The key is `HMAC(BETTER_AUTH_SECRET, "gdgoc:bogor-run:token:v1")`, so no new secret is needed; without `BETTER_AUTH_SECRET` it returns `null` and the game plays unranked. The browser keeps one ticket ready while the game is on the page (`keepTicketFresh` in `online.ts`). A ticket is used only within 10 minutes of its fetch, and never after the week it was issued in has ended. It is renewed shortly before its 10 minutes are up, right after its week ends, and as soon as a hidden tab comes back. Hidden tabs fetch nothing, and without a ticket the page retries every minute. A run that starts while a ticket is still on its way holds its first tick for up to 1 s, then adopts the ticket and keeps the keys pressed meanwhile. If none arrives, the run plays unranked.
2. **Play.** The browser and Convex run the same engine (`src/lib/bogor-run/engine.ts`): fixed 1/120 s ticks, a seeded PRNG stored on the run, world-space spawning, and only arithmetic that gives identical results everywhere. The browser records each jump, duck, and stand that changes the state as `[tick, code]`.
3. **Submit.** When a signed-in player crashes or reaches the one-hour finish line, the run is submitted automatically: the token, the inputs, the end tick, and the score. The inputs always travel as a packed base-36 string (`packInputs`), because Convex rejects argument arrays longer than 8,192 elements.
4. **Checks,** in order: a verified, active account; a valid signature and exact claim shape; a nonce no other account has used (`USED`; a resubmit from the same account gets its current standing back); a token from this engine version (`OUTDATED`); an end tick from 1 to 432,000 and a non-negative integer score; at least 97% of the simulated time, minus 1 s, since `issuedAt` (`TOO_EARLY`); at most the simulated time plus 12 hours (`EXPIRED`). Finally the replay must be valid, end on exactly the end tick (a crash, or the finish line at 432,000), and produce exactly the claimed score. A rejected attempt does not use up its nonce, so an honest retry still works.
5. **Save.** An accepted run adds a `gameRuns` row without its inputs, updates the week's and all-time `gameBests` only when the score improves, and increments the `gameStats` counters.

A guest who chooses "Masuk untuk simpan skor" has the run kept in `sessionStorage` (`gdgoc:bogor-run:pending:v1`) during the Google sign-in, which returns to `/?skor=simpan#join` (or `/?skor=gagal#join` on failure). The landing removes the parameter, scrolls to the game, replays the run locally to show its end, and submits it. The pending run is read once, and ignored 30 minutes after game over. A guest who comes back without signing in, for example with Back from Google, sees the run again with "Skor tadi belum tersimpan. Masuk untuk menyimpannya." and the sign-in button. A signed-in player whose session cannot get its Convex token sees a connection error with "Coba simpan lagi", not the sign-in button.

### The one-hour finish line

A run that survives `LIMITS.maxTicks` (432,000 ticks, one hour) ends there as finished, not crashed. The engine sets the phase to `"over"` with `finished: true` and no hit, and `replayRun` returns `finished: true`. `submitRun` accepts it like a crash, under the same pace check, so it saves no earlier than about 58 minutes after its ticket was issued. The game shows "Selesai! 1 jam penuh" with the Dino standing. The score depends only on how long the run lasted, so every finisher scores 137,403; among equal scores, whoever saved first is listed first. After five minutes the course keeps getting harder (see the game's README), so reaching the hour takes a strong player.

### Run records

The daily `remove Bogor Run run records after 30 days` cron (`convex/crons.ts`, 20:41 UTC, which is 03:41 WIB) runs `bogorRun.pruneRuns`. It deletes `gameRuns` rows saved more than 30 days earlier (`RUN_RETENTION`), 1,000 at a time, and reschedules itself while more remain. Single use still holds: a token is `EXPIRED` at most 13 hours after it was issued (the simulated hour plus 12 hours), long before its row is deleted. Bests, player records, and the `gameStats` counters are kept.

### Weeks

A week starts on Monday at 00:00 WIB (UTC+7) and is keyed by that Monday's date (`weekKey`). A run counts toward the week its ticket was issued in, not the week it was saved. The browser drops a ticket when its week ends, so an honest run counts for the week it started in: one started late on Sunday stays in that week even if it ends on Monday, and the game then says "Tersimpan · peringkat #n minggu lalu". Clients pass the current week explicitly (the dashboard page from a ticking clock), because Convex query results do not re-run as time passes.

The server accepts a run until its simulated time plus 12 hours after the ticket was issued. So last week's board can still change until about 13:00 WIB on Monday, from a ticket issued just before midnight and held for a full hour's run. This is by design.

### Limits

- Replay verification cannot tell a bot from a person, and a bot needs no real-time play. The pace check only proves the ticket is old enough: it was issued at least 97% of the simulated time, minus 1 s, before the save. A script can fetch tickets without signing in, several at once, compute a run in a fraction of a second, and save it once each ticket has aged. The demo autopilot ships in the browser bundle and plays to the finish line, so such a run scores the ceiling of 137,403, the same as any finisher. This risk is accepted: staff hide suspicious players with the moderation above.
- Pauses are not recorded, so pausing to think cannot be detected; only the minimum real duration is enforced.
- There is no per-account rate limit, and `issueRun` needs no sign-in. Each bogus submission costs at most one hour of replay, well under the 1 s mutation limit (`docs/VERIFICATION.md` has the measurements). Every accepted run counts in "Permainan tercatat", so one account can inflate that counter with many short runs; a run with no input is accepted about 2 s after its ticket was issued. Add a rate limit, with a new error code, if abuse appears.
- A run with more than 10,000 inputs plays unranked, and the game says why.
- Every play view shows at least 320 world units ahead of the dino (`MIN_AHEAD` in `view.ts`), so phones warn as early as laptops. A 0.3 s reaction plus half a jump at top speed needs about 283. Phones zoom out below the old 1.3 minimum scale to reach it, and the dino sits at 8% of the width: it is 43 px wide at 390 px and 36 px at 320 px. Before this (#73) a 390 px phone showed 214 units and a 320 px phone 168, and the gameplay review's bot lasted a median of 7.6 minutes at 390 px against about 22 at 1440 px. The engine is unchanged, so scores stay comparable.
- The staff list shows the 100 highest hidden scores of a period. With more hidden players than that, restore a lower one from a week in which they rank higher, or in the Convex dashboard.
- The server replays only the current engine. Any change to physics or generation must bump `ENGINE_VERSION`; then tabs still on the old client get `OUTDATED` and a reload prompt rather than `INVALID`, and runs they finish in the meantime are not ranked. A whole-hour fingerprint test in `engine.test.ts` fails until the version is bumped and the new fingerprint recorded. A second test pins the first five minutes to the engine from before the late-game ramp.
- Ranks are counted exactly up to 1,000, which keeps rank reads bounded; past that the rank is `null`.

## Data model

- `memberProfiles`: adds optional `role`, `deactivatedAt`, `accessUpdatedBy`, `memberType` (`member`/`core`/`bod`), and `division`, a `by_completed` index, and a `search_name` full-text index on `fullName`.
- `assignments`: optional `slug`, `maxScore`, `rubric` (name and max per criterion), `reviewers` (account IDs) and `audience` (community tags; missing means Core Team), plus `by_status_due` and `by_updated` indexes.
- `assignmentSlugs`: every slug an assignment has used (`by_slug`, `by_assignment`).
- `assignmentSubmissions`: one row per member per assignment (`by_assignment_owner`), with the latest review in optional `score`, `breakdown`, `feedback`, `reviewedAt`, `reviewedBy`, and `revisionRequestedAt` while a revision is requested.
- `submissionReviews`: one row per review action, with `score`, `breakdown`, and `revisionRequested` for revision requests (`by_submission`).
- `submissionFiles`: pending or attached uploads (`by_storage`, `by_submission`, `by_owner_assignment`, `by_assignment`).
- `gameRuns`: one row per accepted Bogor Run run, with seed, nonce, times, end tick, score, and week, but not its inputs (`by_nonce`, `by_owner`, `by_submitted`). Rows are deleted 30 days after they were saved.
- `gameBests`: each player's best per period, `"all"` or a week key, with the public short name and a `hidden` flag, set while staff hide the player or the account is deactivated (`by_owner_period`, `by_period_hidden_score`).
- `gamePlayers`: staff moderation per player, which also applies to later bests: `hiddenAt` while hidden, `hiddenBy` and `hiddenByRole` of the last hide, and `restoredAt` and `restoredBy` of the last restore (`by_owner`).
- `gameStats`: player and run counters per period, so the board never scans every run (`by_period`).
- `accessLog`: one row per access change: `at`, `actorId`, `targetId`, `change` (`role`, `reviewer`, `active`, `memberType`, `assignmentReviewer`, `deleted`), `from` and `to`, and `assignmentId` for assignment reviewers (`by_at`, `by_target`). Account IDs only.
- `accountDeletions`: one row per deleted account with `deletedAt`, `deletedBy` and how many rows of each kind went, without the member's name or email (`by_deleted`).

All schema changes are additive, so the previous frontend keeps working during a backend-first deploy.

## Tests

- `convex/access.test.ts`: the access matrix, for every guarded function and eight kinds of account, plus a check that every public function is placed in it or on the open list.
- `convex/dashboard.test.ts`: role derivation, owner-only promotion, deactivation rules, member search, staff role corrections, the core team and BoD filters, BoD tagging with an optional division, the member detail, and account deletion (owner only, typed-name check, every owned row and the auth user gone, other assignments' reviewer lists cleaned), and the access log (each change with its before and after values, no-ops skipped, owners only, per member and paged, deleted accounts and assignments without names). `src/lib/access-log.test.ts` covers the log's sentences. `convex/members.test.ts` checks that members can neither declare nor drop BoD themselves.
- `convex/members.test.ts`: the role step, division validation, and `saveRole` after onboarding.
- `convex/assignments.test.ts`: audiences (the Member default, Core Team only for list, link, uploads and submissions, BoD as its own group, all three as everyone, assignments without an audience as Core Team, old tabs keeping it on edit, and narrowing after a submission), rich answers through the allowlist, slug derivation, collisions, reserved slugs, renamed-link lookup, draft visibility, revision conflicts, submissions with files, late flags, admin-only submission lists, server-side upload validation, resubmission file replacement, closed assignments, upload cleanup, and scoring: bounds, integer scores, staff-only review, the stale-revision refusal, the resubmission flag, member visibility, the review history, rubric scoring, assignment reviewers (scoped access, hidden emails, no management), revision requests (reopening one member's form after closing, clearing on resubmission, withdrawal), and the export (staff only, paged, emails for owners only).
- `src/lib/assignment.test.ts`: WIB conversion, file-type checks, file-name cleaning, slugify, and audience order, labels and the Core Team fallback. convex-test does not record upload content types, so type mismatches are tested here.
- `src/lib/assignment-export.test.ts`: CSV quoting, formula defusing, the byte order mark, column order with and without emails or a rubric, rubric columns that fill only for the current criteria, WIB times, and the file name.
- `src/components/dashboard/submission-form.test.tsx`: axe semantics, validation, local file rejection, uploads, dropzone drops and free slots, WebP compression before upload and oversized images, upload progress and cancellation, pending and attached file removal, saved rich answers, and the late warning.
- `src/components/dashboard/rich-text-editor.test.tsx`: the real Tiptap editor in JSDOM, covering axe semantics, the roving-tabindex toolbar, formatting commands, and link validation.
- `src/lib/image-optimize.test.ts`: downscaling, WebP output, and keeping the original when WebP is larger, unsupported, or undecodable.
- `src/lib/rich-text.test.ts` and `src/components/rich-text-view.test.tsx`: the allowlist, unsafe links, limits, text extraction, and escaped rendering.
- `convex/bogorRun.test.ts`: token signatures checked against Node's HMAC, engine versions on tickets and tokens (`v: 1` tokens as engine 1, other engines `OUTDATED`), accepted replayed runs (including packed logs), forged and tampered tokens, edited inputs, scores, and end ticks, `TOO_EARLY` and `EXPIRED`, single use and `USED`, guests and deactivated accounts, improving bests with the week taken from the token, shared tie ranks and tie order at the cut, the rank cap, hidden players, and no owner ids or emails in public results. It also covers the one-hour finish line, the staff hidden list beyond the top 100, the moderation hierarchy and its audit fields, hiding on deactivation and restoring on reactivation, and pruning run records after 30 days, in batches.
- `src/lib/bogor-run/leaderboard.test.ts`: WIB weeks in any runtime time zone, Monday keys, Indonesian week labels, short names, and packed input logs.
- `src/lib/bogor-run/engine.test.ts`: determinism, replay validation, a one-hour replay's cost, a whole-hour fingerprint pinned to `ENGINE_VERSION`, a fingerprint that pins the first five minutes, late-game pressure and clusters, the finish line, brute-forced late-game jump windows, and a search solver that clears 25 obstacles in a row for 150 seeds at the start, near top speed (28 minutes in), and in the last 100 seconds before the finish line.
- `src/components/dashboard/leaderboard.test.tsx`: axe semantics, keyboard tabs, shared ranks, WIB times, your row, "1.000+", the hidden notice, loading and empty states, staff hiding with confirmation, pending, and failure states, the separate hidden list with who hid each player, owner-only locks for admins, deactivated players, focus after a row leaves its table, and the narrow layout.
- `src/lib/bogor-run/online.test.ts`: ticket renewal through long runs, hidden tabs, and Monday 00:00 WIB, the engine version on ticket requests and the stop once the server reports another, the sign-in state, and pending guest runs.

## Not included

Assignments target community tags only. Targeting a Catalyst role or team is part of E4 (#32).
