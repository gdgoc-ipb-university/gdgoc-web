import { slugify } from "./assignment";
import { catalyst } from "./catalyst";
import { programs } from "./programs";
import { startOfDay } from "./schedule";
import { siteUrl } from "./site";
import { techLeague } from "./tech-league";

/**
 * The chapter bot's read-only API (#259, docs/BOT_API.md): the parts that need no database, so they are tested without
 * Convex. `convex/botApi.ts` serves them. Every response object is built here or there field by field, never by
 * spreading a stored row, so a field added to a table never reaches the bot by accident.
 */

/** A token bucket on the key: a burst of 60 requests, refilling one a second. */
export const botRateLimit = { requests: 60, refillMs: 1_000 } as const;
export type RequestBucket = { tokens: number; tokensAt: number };

/** Requests available now from the stored bucket; an unused key has the full bucket. Fractional while refilling. */
export function requestsAvailable(bucket: RequestBucket | null, now: number) {
  if (!bucket) return botRateLimit.requests;
  return Math.min(botRateLimit.requests, bucket.tokens + Math.max(0, now - bucket.tokensAt) / botRateLimit.refillMs);
}

/** The key from `Authorization: Bearer <key>`, or "" for a missing header or another scheme. */
export function bearerKey(header: string | null) {
  return /^Bearer +(\S+) *$/i.exec(header ?? "")?.[1] ?? "";
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/**
 * Whether `given` is the configured key. Both are hashed first, so the comparison always covers 32 bytes and takes the
 * same time wherever they differ, whatever their lengths.
 */
export async function keyMatches(given: string, expected: string) {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

/** The Convex environment values links are built from. */
export type SiteEnv = { SITE_URL?: string; LEAGUE_URL?: string };

function origin(value: string | undefined) {
  try { return value ? new URL(value).origin : null; } catch { return null; }
}

/**
 * Absolute links on the deployment's own site, so staging links to staging: SITE_URL, falling back to production, and
 * LEAGUE_URL for Tech League where the league has its own host.
 */
export function siteLinks(env: SiteEnv) {
  const site = origin(env.SITE_URL) ?? siteUrl;
  const league = origin(env.LEAGUE_URL);
  return {
    page: (path: string) => `${site}${path}`,
    /** A program's page, or null for a program announced only on Instagram. */
    program: (id: string) => {
      if (id === "tech-league") return league ? `${league}/` : `${site}${techLeague.path}`;
      const href = programs.find((program) => program.id === id)?.href;
      return href ? `${site}${href}` : null;
    },
  };
}
export type SiteLinks = ReturnType<typeof siteLinks>;

/** The programs as /program lists them. */
export function programViews(links: SiteLinks) {
  return programs.map((program) => ({
    id: program.id, name: program.title, description: program.audience, schedule: program.schedule, url: links.program(program.id),
  }));
}

/** A dated step on a public program page, as `catalyst.timeline` and `techLeague.timeline` list them (WIB days). */
type Step = { readonly label: string; readonly start: string; readonly end?: string; readonly phase?: string; readonly note?: string };

const day = 86_400_000;

/**
 * The dated items the public pages show: Tech League's full timeline, and Catalyst's only while its schedule is not on
 * hold, as on its page. An event's id is its program and its label as a slug, so it survives a date change; renaming
 * an item gives it a new id. `startsAt` is 00:00 WIB on the first day and `endsAt` 00:00 WIB after the last.
 */
export function programEvents(catalystOnHold = catalyst.scheduleOnHold) {
  const sources: { program: string; steps: readonly Step[] }[] = [
    ...(catalystOnHold ? [] : [{ program: "catalyst", steps: catalyst.timeline }]),
    { program: "tech-league", steps: techLeague.timeline },
  ];
  const taken = new Set<string>();
  return sources.flatMap(({ program, steps }) => steps.map((step) => {
    const base = `${program}/${slugify(step.label)}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    const end = step.end ?? step.start;
    return {
      id, program, title: step.label, phase: step.phase ?? null, note: step.note ?? null,
      start: step.start, end, startsAt: startOfDay(step.start), endsAt: startOfDay(end) + day,
    };
  }));
}
export type ProgramEvent = ReturnType<typeof programEvents>[number];

/** What makes an event new to the bot when it changes: its dates and its text. */
export function eventContent(event: ProgramEvent) {
  return JSON.stringify([event.title, event.phase, event.note, event.start, event.end]);
}

/**
 * An event as the bot gets it, with its program's page and when the site first served it as it is now (null for the
 * events already there when the API first ran).
 */
export function eventView(event: ProgramEvent, links: SiteLinks, updatedAt: number | null) {
  return {
    id: event.id, program: event.program, title: event.title, phase: event.phase, note: event.note,
    start: event.start, end: event.end, startsAt: event.startsAt, endsAt: event.endsAt, url: links.program(event.program), updatedAt,
  };
}

/**
 * How far `next` in /changes stays behind the server's clock, so a write that started before a request and committed
 * after it is still in the next one. The bot may see an item twice and keys its posts on `id` and `updatedAt`.
 */
export const changesOverlapMs = 10_000;

/** `?since=` as epoch milliseconds, or null when it is missing or not a whole number. */
export function parseSince(value: string | null) {
  if (!value || !/^\d{1,16}$/.test(value)) return null;
  const since = Number(value);
  return Number.isSafeInteger(since) ? since : null;
}
