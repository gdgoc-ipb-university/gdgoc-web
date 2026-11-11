# Member onboarding

The first authenticated visit to any `/dashboard` page redirects accounts without a completed member profile to `/onboarding`. This includes existing Google accounts that have never completed this introduction. The public landing and Google sign-in remain accessible without a profile.

## Six screens

1. **Kenalan:** a name prefilled from Google, editable before saving.
2. **Sekolah/kampus:** membership is open to university students anywhere and to SMA, MA, SMK and MAK students (oprec member 2026/27). The member first says whether they are a **Mahasiswa** or a **Siswa SMA/SMK** (`memberProfiles.institutionKind`: `campus` or `school`), then picks from a searchable list: every campus in the national registry with the Bogor campuses first, or every SMA, MA, SMK and MAK in West Java, Jakarta and Banten with Bogor first. The second field lists study programs or SMK majors (found by their old short names too: TKJ, RPL, Multimedia, OTKP). Both fields accept names outside the suggestions. Switching between Mahasiswa and Siswa SMK clears both answers.
3. **Instagram:** required (#212). The member types their Instagram username (an "@" or a pasted profile link is read too; stored lowercase without "@" as `memberProfiles.instagram`). The screen lists the intake requirements, follow @gdgoc.ipb and keep the twibbon on the feed until registration closes on 30 November, with a "Follow @gdgoc.ipb" button and a link to `/twibbon`, and warns that core team checks the account and may cancel the registration. Staff see the username on the member page and in the owners' CSV.
4. **Komunitas:** the community spaces, used together (#242): an optional invitation to the WhatsApp group supplied by the community owner, and beside it, with the same weight, an optional card to connect Discord and join the chapter server (see [Discord](DISCORD.md)). "Hubungkan Discord" goes to Discord's consent page and comes back to this screen, even for a member who had moved past it. Until Discord is set up, the card says so and can be skipped like the rest. Discord joined this screen instead of becoming a seventh, so saved `nextStep` values keep their meaning and no profile needs a migration.
5. **Jadi member:** an optional invitation to the official GDG chapter.
6. **Tech Support:** what the program offers (the help kinds from `src/lib/tech-support-request.ts`) and the reply target, with **Ya, ajukan setelah ini** or **Nanti saja** (the default). Finishing completes onboarding; with *Ya* the member lands on `/dashboard/tech-support?ajukan=1`, where the request form is scrolled to and its first field focused. The request itself is sent from that form, because `techSupport.submit` only accepts members who finished onboarding (#92).

## Community tag

Everyone registers as **Member** ([ADR 0007](decisions/0007-staff-assign-community-tags.md), #156). Onboarding has no role screen, and finishing it saves `memberType: "member"` with no division, unless the profile already has a tag. **Core Team** with a division (Program & Development, Media & Creative, Technical, Community & External, or Secretary Treasurer, listed in `src/lib/onboarding.ts`) and **BoD** (Board of Directors) come only from owners and admins on `/dashboard/anggota`. `/dashboard/profil` shows the tag read-only, with whether staff confirmed it.

The tag grants no permissions by itself; it decides which assignments a member gets and prefills the Apresiasi "Peran" field. Until #156 members chose Member or Core Team themselves. Those tags are kept as they are: a self-declared Core Team tag stays, marked unconfirmed, until staff change or confirm it. Accounts that completed onboarding before tags existed see a one-screen notice on their next dashboard visit and register as Member (`members.registerAsMember`, which never sets another tag).

Screen ids are compared as numbers, so they ascend: 3 was the role screen until #156 and is the Instagram screen since #212, and 6 is Tech Support (#198). `memberProfiles.nextStep` needs no migration: a profile that is past screen 3 without a username (saved before it was asked, or still on the removed role screen) resumes at screen 3, then goes on through the rest.

External invitations open a new tab. Opening an invitation is not treated as proof of joining. WhatsApp and the GDG Community are not queried for membership, and no external join flags are stored for them; a linked Discord account is the exception, recorded in `discordLinks` with the server join's status. Both invitation screens can be skipped with the normal forward button.

## Persistence and access

`memberProfiles` contains the authenticated owner ID, chosen name, school or campus (`campus`), study program or major (`studyProgram`), whether that is a campus or a school (`institutionKind`, unset on profiles saved before it was asked), the Instagram username (`instagram`, unset on profiles that finished before #212), community tag and division, next saved screen, revision, update time, and optional completion time. `members.profile` reads only the current verified account's profile; `members.saveStep` derives ownership from the active Better Auth session. No client-supplied owner ID is accepted, and `saveStep` takes no community tag: a call that sends `memberType` or `division` is rejected.

After onboarding, the member edits the name, school or campus, study program and Instagram from `/dashboard/profil` with `members.updateProfile`, under the same normalisation, rules and revision check (#235, see [Profile edits](DASHBOARD.md#profile-edits)).

Each **Lanjut** saves that screen before advancing. Reload resumes the next saved screen; unsaved keystrokes are not described as saved. Back preserves local values, and a failed save keeps edits on screen. Required fields and lengths are validated on the server, forward skipping is rejected, and revision checks prevent an old tab from overwriting newer data. Identical request retries are safe. Completion does not repeat on later visits. The only return destinations are `/dashboard` and `/dashboard/apresiasi/tinjau`.

New appreciation drafts prefill the chosen name, campus, study program, and community tag (Member, Core Team, or BoD). Existing drafts keep their existing values. The additive schema keeps the previous frontend functional during backend-first deployment. Google permissions and appreciation review authorization do not change.

## Combobox and mobile behavior

The implementation follows the interaction pattern inspected in Ngonlenin's local `frontend/src/components/primitives/combobox.tsx`, using React Aria Components for the React application. Labels, descriptions, required/invalid states, listbox options, active selection, and errors are associated with their controls.

- Arrow keys navigate options; Enter selects; Escape closes; Tab moves onward. Typing a custom value does not require selecting an option.
- A handled option-selection Enter does not submit the screen. An unhandled **Next** key in campus moves to study program. Pointer submission also works when the browser leaves focus on the preceding input.
- Text fields are at least 16px, without a zoom restriction. Input hints use `next`/`done`, word capitalization, and name autocomplete where appropriate.
- Inputs and options have at least 48px touch targets. Dropdown height follows the available viewport space and its content scrolls independently.
- The page uses dynamic viewport units, safe-area padding, `interactive-widget=resizes-content`, and normal page scrolling. Actions are not fixed over the keyboard. Changing screens focuses the heading rather than opening the keyboard automatically.
- Errors focus the first invalid field. Save errors use an alert. Focus outlines are visible, and forced-colors styling preserves focus and progress state.

Tests include four axe-core checks of the screen semantics, keyboard interaction tests, and authenticated backend tests. JSDOM cannot evaluate rendered color contrast; relevant text, control border, and button colors were calculated separately. Browser viewport checks are documented in `VERIFICATION.md`. These checks are not a full WCAG certification or physical-device/VoiceOver test.

## Suggestion sources

The school and campus lists are suggestions, not proof of enrollment, and both fields still accept any name. The list shows the 50 best matches for what was typed (a name that starts with it, then a word, then anywhere, including the city), so lists of thousands stay quick on a phone. Same-named schools carry their regency in the name, and every option shows its regency and district as a second line.

- **SMA, MA, SMK and MAK** (`src/lib/institutions/schools.json`, 9,330 schools; SMA and MA added 10 November) and **campuses** (`campuses.json`: universities, institutes, polytechnics, colleges and academies) come from the ministry's public reference pages, [referensi.data.kemendikdasmen.go.id](https://referensi.data.kemendikdasmen.go.id/), district by district (`/satpen/dikmen/…/3` and `/satpen/dikti/…/3`, formal track, all statuses). Fetched 10 November 2026. Schools cover West Java, DKI Jakarta and Banten, Bogor and its neighbours first and state schools before private ones; campuses cover every province, Bogor first. Both lists load only when the screen needs them.
- `node scripts/institutions.mjs` rebuilds both files. It caches every page it reads (pass `--cache <dir>` to reuse a cache), asks four pages at a time with a short pause, and skips districts whose counts show no school.
- The four Bogor campuses keep their familiar names (IPB University, not Institut Pertanian Bogor) and come first; the national list skips their registry names.
- Study programs were reviewed 26 September 2026 from the campus pages below. SMA and MA tracks (MIPA, IPS, Bahasa dan Budaya, Keagamaan, and "Umum" for Kurikulum Merdeka) come first; SMK majors follow the konsentrasi keahlian names, with older names as search terms; they are a starting list for the majors most likely to join, not the full spectrum.

- [IPB undergraduate programs](https://www.ipb.ac.id/page/program-studi-sarjana/)
- [IPB admission and vocational program information](https://admisi.ipb.ac.id/biaya-pendidikan-ipb/)
- [Universitas Pakuan undergraduate programs](https://www.unpak.ac.id/program-studi/program-sarjana/)
- [Universitas Djuanda](https://unida.ac.id/)
- [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [React Aria ComboBox documentation](https://react-aria.adobe.com/ComboBox)

## Release

Onboarding ships with the rest of the site: a release to the `release` branch deploys Convex and then the frontend, as described in the Release section of `APRESIASI.md`. CI runs `pnpm check` and `pnpm test` on the pull request to `main` first. No onboarding-specific environment variables or OAuth scopes are required; the schema changes are additive, so the backend-first deploy keeps the previous frontend working. One gap: a member who has the previous page open on screen 4 (Jadi member) during the deploy is not finished by it any more, and stays on that screen until a reload brings the Tech Support screen. Since #212, a page opened before that deploy cannot save screens 4 to 6 for someone without a username: the server asks for it, and a reload brings screen 3.
