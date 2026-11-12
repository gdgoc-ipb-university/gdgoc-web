# Discord

Members connect a Discord account to the account they signed in with through Google, and the site adds them to the chapter's Discord server (#242, epic #241). Discord and the WhatsApp group are equal community spaces, used together. Google stays the only sign-in, and there is one server ([ADR 0009](decisions/0009-discord-linked-never-sign-in.md)).

## Setup

The maintainer does this once; none of it is code.

1. **Application.** In the [Discord Developer Portal](https://discord.com/developers/applications), create an application owned by a chapter account, or better by a developer team of chapter accounts. Its name and icon appear on Discord's consent screen.
2. **Redirects.** Under **OAuth2 → Redirects**, add these exactly:

   ```text
   https://www.gdgocipb.com/api/auth/callback/discord
   https://gdgoc-ipb.yorhagarden.xyz/api/auth/callback/discord
   http://127.0.0.1:3104/api/auth/callback/discord
   ```

   They are each deployment's `SITE_URL` plus `/api/auth/callback/discord`: production, staging (the development deployment), and a local backend. Like Google's, the callback stays on the main host; the league host never receives it. A new origin needs its callback here too.
3. **Bot.** Under **Bot**, reset the token and copy it. Turn off **Public Bot**, so only the application's owners can add it to a server, and leave **Requires OAuth2 Code Grant** off. The site never connects to Discord's gateway, so no privileged intents are needed.
4. **Add the bot to the server.** Open `https://discord.com/oauth2/authorize?client_id=<application ID>&scope=bot&permissions=268435473` and pick the chapter server. Add Guild Member needs **Create Instant Invite**; the same link also grants **Manage Channels** and **Manage Roles**, which the cohort channels (#244) and the role sync (#243) need. Then, in **Server Settings → Roles**, drag the bot's role above every role the site will manage.
5. **Server ID.** Turn on **Developer Mode** in Discord (**User Settings → Advanced**), right-click the server, and choose **Copy Server ID**.
6. **Convex settings.** Set the four values on each deployment that should offer Discord. Secrets are typed at the prompt, never on the command line:

   ```sh
   pnpm exec convex env --prod set DISCORD_CLIENT_ID <application ID>
   pnpm exec convex env --prod set DISCORD_CLIENT_SECRET # prompts for the value
   pnpm exec convex env --prod set DISCORD_BOT_TOKEN # prompts for the value
   pnpm exec convex env --prod set DISCORD_GUILD_ID <server ID>
   ```

   Repeat with `--deployment dev` for the development deployment, which backs staging. One application serves every deployment. To keep staging testers out of the chapter server, point the development deployment's `DISCORD_GUILD_ID` at a test server with the same bot in it.

Until all four values are set, Profil and onboarding say Discord isn't set up yet, Better Auth has no Discord provider, and nothing else changes. Convex applies environment changes at once, without a redeploy.

## Where members see it

- **Profil** (`/dashboard/profil`), beside the photo: "Hubungkan Discord"; once linked, the Discord username, the link date (WIB), the join status with Discord's last error, "Coba lagi" after a failure, "Buka server" (`https://discord.com/channels/<server ID>`) once in, and "Putuskan" after a confirmation.
- **Onboarding**, screen 4 (Komunitas): a Discord card beside the WhatsApp group's, with the same weight. Once linked, its "Terhubung sebagai" line follows the join status, with "Coba lagi" after a failure as on Profil. It can be skipped and done later from Profil.
- **Anyone** can join through the server's permanent invite, `communityLinks.discord` in `src/lib/community.ts`, which never expires and opens the general channel (#264). It is the "Server Discord" card on `/bergabung`, beside the WhatsApp group's, and the Discord link beside Instagram in the site footer and the Tech League footer. The invite gives no member roles; those come from connecting Discord on Profil, so the copy around it promises none.
- **Staff** (owners and admins) see the linked Discord username under the member's email on `/dashboard/anggota`, and a Discord fact on the member's page with the link date, the join status and the last error. The Discord ID stays on the server.
- After Discord's consent page, the member returns to the page they left with `discord=terhubung`, or `discord=gagal` and Better Auth's `error`, which the page turns into an Indonesian message and then removes from the address. The message after linking, and the one after "Coba lagi", are built from the join status as it changes, never fixed when the member returns (#261): being added, already in the server (also for someone who was there before linking), or not yet, with the reason. While that message shows, Profil's "Server" row keeps only its badge, so the reason appears once.

## Linking

"Hubungkan Discord" calls Better Auth's `linkSocial` for a signed-in member. Discord asks for two scopes only: `identify` (the account's ID and username) and `guilds.join` (leave to add it to the server). The site never asks for the email, the server list or messages. After the consent screen, Discord returns to `/api/auth/callback/discord` on the main host, Better Auth stores the account with its tokens encrypted (`encryptOAuthTokens`), and the member lands back where they started.

- **One each way.** A member has at most one Discord account, and a Discord account belongs to one member. Better Auth refuses a Discord account that another member holds (`error=account_already_linked_to_different_user`, shown in Indonesian), `/link-social` refuses a member who has one, and the account trigger settles a race.
- **Who may link.** `discord.linkProblem` answers `/link-social` first: Discord must be set up, and the account active (not deactivated). Onboarding counts, so a new member can link on the community screen.
- **Name and photo** stay Google's: linking copies nothing from Discord onto the account.

### Never a sign-in

`convex/discordAuth.ts` keeps Discord off the sign-in path with three locks, each tested in `convex/discordAuth.test.ts` against Better Auth with Discord mocked:

1. `/sign-in/social` refuses Discord with a 403.
2. Discord's profile is mapped to no email. Better Auth's OAuth state names no provider, so a state from a Google sign-in can be replayed on Discord's callback; without this lock that signs in the member who linked the Discord account. With it, the callback stops at `email_not_found` before looking up or creating anyone.
3. Sign-up is off for the provider.

Linking needs Discord in `trustedProviders` (it is never asked for an email that could vouch for the account) and `allowDifferentEmails`.

## Joining the server

Recording a link schedules `discord.join`, a Convex action:

1. It reads the member's Discord token through Better Auth's `getAccessToken`, which refreshes it when it has expired, and checks with `/users/@me` that the token belongs to the linked account. That call also gives the username.
2. It calls Discord's [Add Guild Member](https://discord.com/developers/docs/resources/guild#add-guild-member) (`PUT /guilds/{server}/members/{user}`) with the member's token and the bot's. 201 (added) and 204 (already a member) both count as joined, and set `lastSyncedAt`.
3. A 429 waits as long as Discord's `retry_after` asks. A 5xx or a network failure retries after 5 s, 30 s, 2 min, 10 min and 30 min, then the join is marked failed. Meanwhile Profil says Discord is busy and the site keeps trying.
4. Any other refusal is recorded at once in Indonesian, for example a ban (40007), the 100-server limit (30001), a bot without permission (403) or an unknown server (404). A deactivated account, or a token that no longer works, is not added.

"Coba lagi" on Profil and on onboarding's card (`discord.retryJoin`) starts a new round after a failure. A join scheduled for a link that has since gone finds nothing and stops.

Every Discord REST call goes through `convex/discordApi.ts`, which returns the status, Discord's error code and the wait for a 429 instead of throwing. Tests stub `fetch` there (`convex/discordApi.test.ts`, `convex/discord.test.ts`). The role sync (#243) adds its calls to that module.

## Data

`discordLinks` holds one row per linked member: the Discord user ID, the username (from Discord on the first sync), when it was linked, the server join status, how many join attempts were made, the last successful sync, and the last error. Account triggers in `convex/auth.ts` write and remove it in the same transaction as Better Auth's account row, so the two never disagree. Staff views and the role sync (#243 to #245) read this table, never Better Auth's.

- **Unlink.** "Putuskan" (`discord.unlink`) removes the row and Better Auth's Discord account together. The member stays in the server; `afterUnlink` in `convex/discordLinks.ts` is where #243 removes the roles the site manages.
- **Deletion.** `dashboard.deleteAccount` removes the row (counted as `discordLinks`) and the Discord account with the other Better Auth accounts.
