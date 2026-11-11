# 0009. Discord is linked to a member's Google account, never used to sign in

- Status: Accepted
- Date: 2026-11-12
- Links: #241, #242

## Context

The chapter opens a Discord server beside the WhatsApp group (#241). Both are community spaces, used together. Members should land in the server with roles and private channels that follow what the site knows, so the site has to know each member's Discord account. A username typed into a form can't be trusted for access to member-only channels. Better Auth could add Discord as a second way to sign in, or link it to an account already signed in through Google. A second sign-in would let a Discord account create an account the roster doesn't know, and would make a member's Discord login a key to their site account.

## Decision

Google stays the only sign-in. Discord is a Better Auth provider used only through account linking, with the scopes `identify` and `guilds.join`, one Discord account per member and one member per Discord account. The site keeps its own record of the link (`discordLinks`) and adds the member to the chapter's one server with Discord's Add Guild Member call, from Convex with a bot token; no bot runs.

## Consequences

- Discord can't sign anyone in: `/sign-in/social` refuses it, its profile carries no email, and sign-up is off for it (`convex/discordAuth.ts`, tested). Better Auth's OAuth state doesn't name its provider, so the email lock is what stops a Google sign-in state replayed on Discord's callback from signing in the member who linked that Discord account. A Better Auth upgrade must keep those tests passing.
- Staff views and the role sync (#243 to #245) read `discordLinks`, never Better Auth's account table.
- Unlinking keeps the member in the server; the role sync removes the roles the site manages.
- Discord's redirects follow `SITE_URL` like Google's, so a new origin needs its callback registered with both ([setup](../DISCORD.md#setup)).
