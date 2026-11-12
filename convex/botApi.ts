import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assignmentPath, inAudience } from "../src/lib/assignment";
import {
  bearerKey, botRateLimit, changesOverlapMs, eventContent, eventView, keyMatches, parseSince, programEvents, programViews, requestsAvailable, siteLinks,
  type SiteLinks,
} from "../src/lib/bot-api";

// The chapter bot's read-only API (#259, docs/BOT_API.md): GET /bot/v1/<endpoint> with `Authorization: Bearer
// <BOT_READ_KEY>`. Responses are built field by field; nothing here returns a member, a submission or a flag.

export const prefix = "/bot/v1/";

type EventView = ReturnType<typeof eventView>;
type TaskView = ReturnType<typeof taskView>;

const links = () => siteLinks({ SITE_URL: process.env.SITE_URL, LEAGUE_URL: process.env.LEAGUE_URL });

/**
 * Records when each program event was first served as it is now. On an empty table the events count as old (0), so
 * the first request after this ships announces nothing; later releases that add or move an event get the time.
 */
async function recordEventVersions(ctx: MutationCtx, now: number) {
  const rows = await ctx.db.query("botEventVersions").collect();
  const stored = new Map(rows.map((row) => [row.eventId, row]));
  for (const event of programEvents()) {
    const content = eventContent(event), row = stored.get(event.id);
    if (!row) await ctx.db.insert("botEventVersions", { eventId: event.id, content, updatedAt: rows.length ? now : 0 });
    else if (row.content !== content) await ctx.db.patch(row._id, { content, updatedAt: now });
  }
}

/**
 * Takes one request from the key's bucket, or says how long until the next one when it is empty. An admitted request
 * also records the program events, before any endpoint reads them.
 */
export const admit = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ retryAfterMs: number | null }> => {
    const now = Date.now();
    const bucket = await ctx.db.query("botRequests").first();
    const available = requestsAvailable(bucket, now);
    if (available < 1) return { retryAfterMs: Math.ceil((1 - available) * botRateLimit.refillMs) };
    if (bucket) await ctx.db.patch(bucket._id, { tokens: available - 1, tokensAt: now });
    else await ctx.db.insert("botRequests", { tokens: available - 1, tokensAt: now });
    await recordEventVersions(ctx, now);
    return { retryAfterMs: null };
  },
});

async function eventViews(ctx: QueryCtx, site: SiteLinks): Promise<EventView[]> {
  const updated = new Map((await ctx.db.query("botEventVersions").collect()).map((row) => [row.eventId, row.updatedAt || null]));
  return programEvents().map((event) => eventView(event, site, updated.get(event.id) ?? null));
}

/** The program events, each with when it was first served as it is now. */
export const events = internalQuery({
  args: {},
  handler: async (ctx): Promise<EventView[]> => eventViews(ctx, links()),
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

/**
 * Whether members can see the task on the site: published (late work is accepted until staff close it), and either for
 * a cohort, whose participants see it, or for community tags that include Member. Drafts, closed tasks, Core Team or
 * BoD only tasks, and tasks from before audiences (Core Team) are left out.
 */
function shownToMembers(task: Doc<"assignments">) {
  return task.status === "published" && (task.cohortId !== undefined || inAudience(task, "member"));
}

function taskView(task: Doc<"assignments">, cohort: Doc<"cohorts"> | null, site: SiteLinks) {
  return {
    id: task._id, title: task.title, kind: task.kind === "flag" ? "flag" as const : "regular" as const,
    // `roles` are the cohort role keys the task is for; empty means every role.
    cohort: cohort && { id: cohort._id, name: cohort.name, roles: [...(task.cohortRoles ?? [])] },
    dueAt: task.dueAt, dueAtIso: new Date(task.dueAt).toISOString(), url: site.page(assignmentPath(task)),
    publishedAt: task.publishedAt ?? null, updatedAt: task.updatedAt,
  };
}

/** Open tasks members can see, soonest deadline first. A task whose cohort is gone reaches no one and is left out. */
async function openTasks(ctx: QueryCtx, site: SiteLinks) {
  const rows = await ctx.db.query("assignments").withIndex("by_status_due", (q) => q.eq("status", "published")).order("asc").take(200);
  const cohorts = new Map<Id<"cohorts">, Doc<"cohorts"> | null>();
  const views: TaskView[] = [];
  for (const task of rows.filter(shownToMembers)) {
    let cohort: Doc<"cohorts"> | null = null;
    if (task.cohortId) {
      if (!cohorts.has(task.cohortId)) cohorts.set(task.cohortId, await ctx.db.get(task.cohortId));
      cohort = cohorts.get(task.cohortId)!;
      if (!cohort) continue;
    }
    views.push(taskView(task, cohort, site));
  }
  return views;
}

export const tasks = internalQuery({
  args: {},
  handler: async (ctx): Promise<TaskView[]> => openTasks(ctx, links()),
});

/**
 * Open tasks and program events created or changed after `since`. Only tasks that are open now come, so a task closed
 * since then is simply absent; `/tasks` is the whole list.
 */
export const changes = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }): Promise<{ since: number; next: number; tasks: TaskView[]; events: EventView[]; serverTime: number }> => {
    const site = links(), now = Date.now();
    return {
      since, next: Math.max(since, now - changesOverlapMs),
      tasks: (await openTasks(ctx, site)).filter((task) => task.updatedAt > since),
      events: (await eventViews(ctx, site)).filter((event) => event.updatedAt !== null && event.updatedAt > since),
      serverTime: now,
    };
  },
});

/** Lists change rarely; a minute's caching spares the bucket. Errors and changes are not cached. */
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

  const url = new URL(request.url);
  const serverTime = Date.now();
  switch (url.pathname.slice(prefix.length)) {
    case "programs": return reply(200, { programs: programViews(links()), serverTime }, listCache);
    case "events": return reply(200, { events: await ctx.runQuery(internal.botApi.events, {}), serverTime }, listCache);
    case "tasks": return reply(200, { tasks: await ctx.runQuery(internal.botApi.tasks, {}), serverTime }, listCache);
    case "cohorts": return reply(200, { cohorts: await ctx.runQuery(internal.botApi.cohorts, {}), serverTime }, listCache);
    case "changes": {
      const since = parseSince(url.searchParams.get("since"));
      if (since === null) return reply(400, { error: "bad_request", message: "since must be epoch milliseconds" });
      return reply(200, await ctx.runQuery(internal.botApi.changes, { since }));
    }
    default: return reply(404, { error: "not_found" });
  }
});
