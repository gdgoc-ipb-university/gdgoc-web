import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { bearerKey, botRateLimit, eventView, keyMatches, programEvents, programViews, requestsAvailable, siteLinks } from "../src/lib/bot-api";

// The chapter bot's read-only API (#259, docs/BOT_API.md): GET /bot/v1/<endpoint> with `Authorization: Bearer
// <BOT_READ_KEY>`. Responses are built field by field; nothing here returns a member, a submission or a flag.

export const prefix = "/bot/v1/";

/** Takes one request from the key's bucket, or says how long until the next one when it is empty. */
export const admit = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ retryAfterMs: number | null }> => {
    const now = Date.now();
    const bucket = await ctx.db.query("botRequests").first();
    const available = requestsAvailable(bucket, now);
    if (available < 1) return { retryAfterMs: Math.ceil((1 - available) * botRateLimit.refillMs) };
    if (bucket) await ctx.db.patch(bucket._id, { tokens: available - 1, tokensAt: now });
    else await ctx.db.insert("botRequests", { tokens: available - 1, tokensAt: now });
    return { retryAfterMs: null };
  },
});

function cohortView(cohort: Doc<"cohorts">) {
  return {
    id: cohort._id, slug: cohort.slug, name: cohort.name, status: cohort.status,
    roles: cohort.roles.map((role) => ({ key: role.key, name: role.name })),
    // The cohort's Discord channel, once the site creates one (#244).
    discordChannelId: null,
  };
}

/** Every cohort, newest first. */
export const cohorts = internalQuery({
  args: {},
  handler: async (ctx): Promise<ReturnType<typeof cohortView>[]> => (await ctx.db.query("cohorts").order("desc").collect()).map(cohortView),
});

/** Lists change rarely; a minute's caching spares the bucket. Errors and anything time-dependent are not cached. */
const listCache = "private, max-age=60";

function reply(status: number, body: object, cache = "no-store", headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, ...headers } });
}

/**
 * Every bot route. With no BOT_READ_KEY on the deployment every route answers 503; a missing or wrong key gets 401, the
 * same either way; an empty bucket 429. Only then is the path looked at, so unknown paths say nothing without the key.
 */
export const read = httpAction(async (ctx, request) => {
  const expected = process.env.BOT_READ_KEY?.trim();
  if (!expected) return reply(503, { error: "unavailable" });
  if (!(await keyMatches(bearerKey(request.headers.get("Authorization")), expected))) {
    return reply(401, { error: "unauthorized" }, "no-store", { "WWW-Authenticate": "Bearer" });
  }
  const { retryAfterMs } = await ctx.runMutation(internal.botApi.admit, {});
  if (retryAfterMs !== null) return reply(429, { error: "rate_limited" }, "no-store", { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) });

  const links = siteLinks({ SITE_URL: process.env.SITE_URL, LEAGUE_URL: process.env.LEAGUE_URL });
  const serverTime = Date.now();
  switch (new URL(request.url).pathname.slice(prefix.length)) {
    case "programs": return reply(200, { programs: programViews(links), serverTime }, listCache);
    case "events": return reply(200, { events: programEvents().map((event) => eventView(event, links)), serverTime }, listCache);
    case "cohorts": return reply(200, { cohorts: await ctx.runQuery(internal.botApi.cohorts, {}), serverTime }, listCache);
    default: return reply(404, { error: "not_found" });
  }
});
