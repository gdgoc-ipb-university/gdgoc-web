# Member onboarding

The first authenticated visit to any `/dashboard` page redirects accounts without a completed member profile to `/onboarding`. This includes existing Google accounts that have never completed this introduction. The public landing and Google sign-in remain accessible without a profile.

## Five screens

1. **Kenalan:** a name prefilled from Google, editable before saving.
2. **Kampus:** searchable campus and study-program comboboxes. Both accept names outside the suggestions.
3. **Peran:** Member or Core Team. Core Team then requires one division: Program & Development, Media & Creative, Technical, Community & External, or Secretary Treasurer. The list lives in `src/lib/onboarding.ts`.
4. **WhatsApp:** an optional invitation to the group supplied by the community owner.
5. **Jadi member:** an optional invitation to the official GDG chapter, followed by completion and a return to the dashboard.

The role is self-declared and grants no permissions; it is a profile label that also prefills the Apresiasi "Peran" field. Members can change it on `/dashboard/profil`, and dashboard staff can correct it on `/dashboard/anggota`. Accounts that completed onboarding before the role step existed see a one-screen role prompt on their next dashboard visit. Profiles saved in the middle of the older four-screen flow resume at the role step.

External invitations open a new tab. Opening an invitation is not treated as proof of joining. Neither service is queried for membership, and no external join flags are stored. Both invitation screens can be skipped with the normal forward button.

## Persistence and access

`memberProfiles` contains the authenticated owner ID, chosen name, campus, study program, community role and division, next saved screen, revision, update time, and optional completion time. `members.profile` reads only the current verified account's profile; `members.saveStep` derives ownership from the active Better Auth session. No client-supplied owner ID is accepted.

Each **Lanjut** saves that screen before advancing. Reload resumes the next saved screen; unsaved keystrokes are not described as saved. Back preserves local values, and a failed save keeps edits on screen. Required fields and lengths are validated on the server, forward skipping is rejected, and revision checks prevent an old tab from overwriting newer data. Identical request retries are safe. Completion does not repeat on later visits. The only return destinations are `/dashboard` and `/dashboard/apresiasi/tinjau`. `members.saveRole` changes the role after completion.

New appreciation drafts prefill the chosen name, campus, study program, and Member/Core Team role. Existing drafts keep their existing values. The additive schema keeps the previous frontend functional during backend-first deployment. Google permissions and appreciation review authorization do not change.

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

Run `pnpm test`, `pnpm check`, and `pnpm build`. Deploy Convex with `pnpm exec convex deploy --yes` before deploying the frontend through the existing Vercel CLI workflow. No new environment variables or OAuth scopes are required.
