# Bot API

A read-only HTTP API for the chapter's Discord bot (#259, epic E12). The bot lives in its own repository and reads what it announces, reminds about and answers from here; it never writes to the site. This page describes the API, not the bot.

The routes are Convex HTTP actions in `convex/botApi.ts`, registered in `convex/http.ts`; the parts that need no database are in `src/lib/bot-api.ts`.

## Access

- **Base URL.** The deployment's `.convex.site` URL, such as `https://adamant-lobster-969.convex.site` for production, plus `/bot/v1/`. The development deployment, which backs staging, serves the same routes at its own `.convex.site` URL.
- **Method.** `GET` only. Responses are JSON (`application/json; charset=utf-8`).
- **Key.** Send `Authorization: Bearer <BOT_READ_KEY>`. The server hashes both keys and compares the digests in constant time.
- **Setup.** Generate a key without spaces, for example with `openssl rand -hex 32`. Set it on each deployment the bot reads, typed at the prompt rather than on the command line, and put the same value in the bot host's environment:

  ```sh
  pnpm exec convex env --deployment dev set BOT_READ_KEY # prompts for the value
  pnpm exec convex env --prod set BOT_READ_KEY # prompts for the value
  ```

- **Rotation.** Set a new value in Convex and on the bot's host. Convex applies it at once, without a redeploy; the old key stops working immediately.

## Responses outside 200

They are checked in this order, so nothing about a path is revealed without the key.

| Status | Body | When |
| --- | --- | --- |
| 503 | `{"error":"unavailable"}` | `BOT_READ_KEY` is not set on the deployment. Every bot route answers this. |
| 401 | `{"error":"unauthorized"}` | The key is missing, wrong, or not a `Bearer` token. The answer is the same for each. |
| 429 | `{"error":"rate_limited"}` | The key's bucket is empty. `Retry-After` gives the seconds to wait. |
| 404 | `{"error":"not_found"}` | No such endpoint. |

## Limits and caching

- **Rate limit.** One token bucket for the key: a burst of 60 requests, refilling one a second. A wrong key takes nothing from it.
- **Caching.** Lists are sent with `Cache-Control: private, max-age=60`, and errors with `no-store`. Programs and events change only with a release of the site, so the bot can cache them for longer.

## Endpoints

Every response carries `serverTime`, the server's clock in epoch milliseconds. Times are epoch milliseconds, and days are WIB calendar days written `YYYY-MM-DD`. Links are absolute, built from the deployment's `SITE_URL`, and from `LEAGUE_URL` for Tech League where the league has its own host.

### `GET /bot/v1/programs`

The programs `/program` lists, in its order: the three flagships, then the regular ones. The list is `src/lib/programs.ts`, which the page renders too.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable: `catalyst`, `tech-league`, `tech-support`, `study-jam`, `google-programs`, `friday-tech-bulletin` |
| `name` | string | As on the card |
| `description` | string | Who it is for, in Indonesian |
| `schedule` | string | When it runs, as the card says it; Catalyst's says its schedule follows while the schedule is on hold |
| `url` | string or null | Its page, or null for a program announced only on Instagram |

```json
{
  "programs": [
    {
      "id": "tech-league",
      "name": "Tech League",
      "description": "Untuk tim yang ingin menguji karya di kompetisi nasional.",
      "schedule": "Pendaftaran 7 Desember 2026 – 6 Januari 2027.",
      "url": "https://league.gdgocipb.com/"
    }
  ],
  "serverTime": 1794474000000
}
```

### `GET /bot/v1/events`

The dated items the public program pages show: Tech League's full timeline, and Catalyst's timeline only while `catalyst.scheduleOnHold` is false, as on its page. Gatherings from the dashboard are not included: no public page lists them, and some are Core Team meetings.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | The program and the item's label as a slug, such as `tech-league/final-daring`. It survives a date change; renaming the item gives it a new id. |
| `program` | string | The program's `id` |
| `title` | string | The item's label |
| `phase` | string or null | Its group on the page (`Registrasi`, `Karya`, `Seleksi`, `Final`), or null |
| `note` | string or null | The line under the label, or null |
| `start`, `end` | string | First and last day; equal for a one-day item |
| `startsAt` | number | 00:00 WIB on `start` |
| `endsAt` | number | 00:00 WIB on the day after `end` |
| `url` | string | The program's page |

```json
{
  "events": [
    {
      "id": "tech-league/final-daring",
      "program": "tech-league",
      "title": "Final daring",
      "phase": "Final",
      "note": "Minggu, tiga cabang bersamaan.",
      "start": "2027-01-17",
      "end": "2027-01-17",
      "startsAt": 1800118800000,
      "endsAt": 1800205200000,
      "url": "https://league.gdgocipb.com/"
    }
  ],
  "serverTime": 1794474000000
}
```

### `GET /bot/v1/cohorts`

Every cohort, newest first, whatever its status.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | The cohort's Convex id |
| `slug` | string | As in `/dashboard/program/<slug>` |
| `name` | string | Such as `GDGoC Catalyst 2026/27` |
| `status` | string | `setup`, `active` or `ended` |
| `roles` | array of `{ key, name }` | Its roles; a key never changes once used |
| `discordChannelId` | null | The cohort's Discord channel, once the site creates one (#244) |

## Never returned

Responses are built field by field from an allowlist, never by spreading a stored row, and the tests assert the exact keys of every endpoint. No endpoint returns members' names, emails, phone numbers, account IDs or Discord IDs, enrolments, submissions, scores, flag values, Tech League teams and their codes, or the access log.
