# Member onboarding

The first authenticated visit to any `/dashboard` page redirects accounts without a completed member profile to `/onboarding`. This includes existing Google accounts that have never completed this introduction. The public landing and Google sign-in remain accessible without a profile.

## Three screens

1. **Kenalan:** a name prefilled from Google, editable before saving.
2. **Kampus:** searchable campus and study-program comboboxes. Both accept names outside the suggestions.
3. **WhatsApp:** an optional invitation to the group supplied by the community owner, followed by completion and a return to the dashboard.

Signing in with Google on `/dashboard` is how people join, so onboarding no longer sends them to the external chapter page (#176).

## Community tag

Everyone registers as **Member** ([ADR 0007](decisions/0007-staff-assign-community-tags.md), #156). Onboarding has no role screen, and finishing it saves `memberType: "member"` with no division, unless the profile already has a tag. **Core Team** with a division (Program & Development, Media & Creative, Technical, Community & External, or Secretary Treasurer, listed in `src/lib/onboarding.ts`) and **BoD** (Board of Directors) come only from owners and admins on `/dashboard/anggota`. `/dashboard/profil` shows the tag read-only, with whether staff confirmed it.

The tag grants no permissions by itself; it decides which assignments a member gets and prefills the Apresiasi "Peran" field. Until #156 members chose Member or Core Team themselves. Those tags are kept as they are: a self-declared Core Team tag stays, marked unconfirmed, until staff change or confirm it. Accounts that completed onboarding before tags existed see a one-screen notice on their next dashboard visit and register as Member (`members.registerAsMember`, which never sets another tag).

Screen ids keep their numbers from the five-screen flow (1, 2, 4), so `memberProfiles.nextStep` needs no migration: a profile saved on the removed role screen (3) or the removed external chapter page screen (5) resumes at the WhatsApp invitation. `members.saveStep` still accepts step 5 from a tab opened before that screen went, and finishes it like step 4.

The WhatsApp invitation opens a new tab. Opening it is not treated as proof of joining. WhatsApp is not queried for membership, and no external join flags are stored. The invitation can be skipped: "Selesai, ke Dashboard" finishes onboarding either way.

## Persistence and access

`memberProfiles` contains the authenticated owner ID, chosen name, campus, study program, community tag and division, next saved screen, revision, update time, and optional completion time. `members.profile` reads only the current verified account's profile; `members.saveStep` derives ownership from the active Better Auth session. No client-supplied owner ID is accepted, and `saveStep` takes no community tag: a call that sends `memberType` or `division` is rejected.

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

Reviewed 26 September 2026. The campus and study-program options are a curated starting list, not a complete national registry, an official campus/program mapping, or proof of student enrollment. Both controls explicitly permit other values.

- [IPB undergraduate programs](https://www.ipb.ac.id/page/program-studi-sarjana/)
- [IPB admission and vocational program information](https://admisi.ipb.ac.id/biaya-pendidikan-ipb/)
- [Universitas Pakuan undergraduate programs](https://www.unpak.ac.id/program-studi/program-sarjana/)
- [Universitas Djuanda](https://unida.ac.id/)
- [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [React Aria ComboBox documentation](https://react-aria.adobe.com/ComboBox)

## Release

Onboarding ships with the rest of the site: a release to the `release` branch deploys Convex and then the frontend, as described in the Release section of `APRESIASI.md`. CI runs `pnpm check` and `pnpm test` on the pull request to `main` first. No onboarding-specific environment variables or OAuth scopes are required; the schema changes are additive, so the backend-first deploy keeps the previous frontend working.
