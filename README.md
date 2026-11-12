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
| `issue-107/teams` | #107 teams in a Catalyst cohort (fixture data) | #152 (stacked on #151) |
| `issue-106/catalyst-card` | #106 Catalyst card on the participant's overview (fixture data) | #154 |
| `issue-156/member-only` | #156 members register as Member only; staff assign Core Team (fixture data) | #157 |
| `issue-159/bulk-print` | #159 bulk member card printing for staff: selection summary, PDF fronts and backs pages, duplex overlay, manifest, long names clear of the landmarks (fixtures) | #164, #160, #161, #162, #163 |
| `issue-166/tech-league-dates` | #166 Tech League schedule from P&D's new timeline: grouped schedule at 1280 and 390, the /bergabung line | #167 |
| `issue-165/landing-story` | #165 landing as a member journey: hero before and after, the road and five chapters at 1440 and 390, each mission step and the dither transition (frames and GIF), programs, timeline, the angkot, reduced motion, against direction A | #169, #170, #171, #172, #173, #174 |
| `issue-176/join-to-login` | #176 join buttons open the site's login: hero button and its /dashboard target, join footer note, /bergabung | #177 |
| `issue-179/league-subdomain` | #179 Tech League on its own host: league landing at 1280 and 390, Daftar signed out and as a member, onboarding returning to the league, the main site signed in afterwards (made-up accounts) | #184, #185 |
| `issue-183/league-teams` | #183 Tech League teams: create a team, an invite signed out and as a member, the captain page with hand-over, the staff table at 1280 and 390, and the registration import preview (made-up accounts) | #188, #189, #190 |
| `issue-192/invite-code` | #192 Tech League invite codes: the code box and its error, the captain's code and link, the confirmation by code and after onboarding, already in the team, in another team, full, a replaced code, an old team before and after the migration, the captain at 1280, and the staff page keeping team codes (made-up accounts) | #194, #195 |
| `issue-197/sekolah-kampus` | #197 onboarding for SMK students and campuses outside Bogor: "smkn 1 bogor" at 1280 and "gadjah" at 390 before and after, the Mahasiswa or Siswa SMK choice, an SMK major by its old name (made-up account) | #199 |
| `issue-198/tech-support-onboarding` | #198 Tech Support on the last onboarding screen: Jadi member before and after at 390, the offer at 1280, Ya chosen at 390 (made-up account) | #200 (stacked on #199) |
| `issue-203/twibbon` | #203 twibbon maker at /twibbon: empty and with a made-up picture at 1280, the phone preview and caption at 390, and the downloaded 1080 × 1440 file (no real person) | #204 |
| `issue-211/oprec-popup` | #211 member intake popup on the landing at 1280 and 390 | #217 |
| `issue-219/mobile-save` | #219 saving the twibbon on phones: desktop after saving with the right-click hint at 1280, and Instagram on an iPhone (emulated) at 390 with the in-app note and the twibbon and slide 2 to long-press (made-up picture, no real person) | #220 |
| `issue-222/timeline-1111` | #222 Tech League timeline of 11 November: the landing's five steps in Setahun bersama at 1440 and 390, the league page at 1440, and its schedule and FAQ at 390 | #224 |
| `issue-223/paused-run` | #223 Bogor Run paused runs: staging before (a paused 35 kept as REKOR after a reload, guest), and after, signed in with a made-up local account: the run back paused after a reload at 1280 and 390, then resumed and saved | #228 (closed, replaced by #229 and #230) |
| `issue-223/rekor` | #223 part 1, REKOR from runs that ended: staging before (a paused 35 kept as REKOR after a reload), and after at 1280 (paused at 35 with REKOR 000, the next run after a reload still at 000), as a guest | #229 |
| `issue-223/resume-paused` | #223 part 2, a paused run survives a reload: on a touch phone at 390 the run back paused with Lanjut main after a reload, then resumed and saved; the same at 1280 (made-up local accounts) | #230 (stacked on #229) |
| `issue-232/stopwatch` | #232 Bogor Run stopwatch and saved run times: a kept run restored paused after a reload, the running HUD and the game-over panel with the board's times (one older best with a dash) at 1440, 800, 390 and 360 with a 5-digit score (local backend, made-up board rows) | #233 |
| `issue-235/edit-profile` | #235 members edit their profile and admins correct it: the member form, its errors and the campus and school lists at 390 and 1440, "Instagram diubah" on the members table and member page, Koreksi profil at 390 and 1440, and the owners' access log (made-up accounts) | #236, #237, #238 |
| `issue-240/flag-tasks` | #240 flag tasks: the Kelola tugas form with the live preview and its errors, the staff list, a member before and after solving (first blood), a wrong flag, out of tries (button locked, then the server refusing a forced try), the task list and overview, the Challenge board with a tie at 390 and 1440, the Bogor Run tab under the new switch, and the staff solve list (local backend, made-up accounts) | #247, #248, #249 (stacked on #246) |
| `issue-251/contact-fields` | #251 Tech Support contact: the form refusing a landline, sent, and prefilled after a reload at 390, and the queue's WhatsApp link, Discord username and a dash for an older request at 1440, with the Kelola dialog (local backend, made-up accounts) | #252 |
| `issue-242/discord-link` | #242 Discord on Profil, onboarding and for staff: Profil not set up, not connected, linked and in the server, joining while Discord is busy, a failed join, a Discord account another member holds, the unlink confirmation, at 390 and 1440; onboarding's Komunitas screen not connected, linked and not set up; the members list and member page; the /privasi section (local backend, link states seeded, made-up accounts) | #257, #258 (stacked on #254, #255, #256) |
| `issue-261/discord-banner` | #261 the Discord message after linking follows the join status: before and after on Profil at 390 and 1440 (back from Discord already in the server; being added, then in with the page open; a failed join, then Coba lagi) and onboarding screen 4 with a failed join (local backend, link states seeded, made-up accounts) | #262 |
| `issue-264/discord-invite` | #264 the Discord server's permanent invite: the Server Discord card on /bergabung at 1440, 900 and 390, and Discord beside Instagram in the site footer and the Tech League footer at 1440 and 390 | #265 |
| `issue-269/auth-calls` | #269 Convex function calls per auth request, before and after each change (local backend, made-up account), and onboarding still signed in at 390 | #270, #271, #272, #273, #274 |
