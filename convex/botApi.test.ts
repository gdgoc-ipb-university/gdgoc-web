/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { slugify } from "../src/lib/assignment";
import { programEvents } from "../src/lib/bot-api";
import { programs } from "../src/lib/programs";

const modules = import.meta.glob("./**/*.ts");
const key = "bot-key-0123456789abcdef";
const site = "https://staging.example";
const paths = ["/bot/v1/programs", "/bot/v1/events", "/bot/v1/tasks", "/bot/v1/cohorts", "/bot/v1/changes?since=0"];

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type T = ReturnType<typeof setup>;

function get(t: T, path: string, authorization: string | null = `Bearer ${key}`) {
  return t.fetch(path, { headers: authorization === null ? {} : { Authorization: authorization } });
}
const keys = (value: object) => Object.keys(value).sort();

beforeEach(() => {
  vi.stubEnv("BOT_READ_KEY", key);
  vi.stubEnv("SITE_URL", site);
  vi.stubEnv("LEAGUE_URL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("the key", () => {
  it("answers 503 on every route while BOT_READ_KEY is not set", async () => {
    const t = setup();
    for (const value of [undefined, "", "  "]) {
      vi.stubEnv("BOT_READ_KEY", value);
      for (const path of [...paths, "/bot/v1/nope"]) {
        const response = await get(t, path);
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: "unavailable" });
      }
    }
  });

  it("answers 401 the same way for a missing, wrong or malformed key, before looking at the path", async () => {
    const t = setup();
    for (const authorization of [null, "", `Bearer ${key}x`, `Bearer ${key.slice(1)}`, `Basic ${key}`, key, "Bearer"]) {
      for (const path of [...paths, "/bot/v1/nope"]) {
        const response = await get(t, path, authorization);
        expect(response.status).toBe(401);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(await response.text()).toBe('{"error":"unauthorized"}');
      }
    }
    // A wrong key takes nothing from the bucket.
    expect(await t.run((ctx) => ctx.db.query("botRequests").first())).toBeNull();
  });

  it("answers 404 for an unknown path with the key", async () => {
    const response = await get(setup(), "/bot/v1/members");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});

describe("the rate limit", () => {
  it("answers 429 with Retry-After once the bucket is empty, and lets requests through as it refills", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("botRequests", { tokens: 0.2, tokensAt: Date.now() }));
    const limited = await get(t, "/bot/v1/programs");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
    expect(await limited.json()).toEqual({ error: "rate_limited" });

    await t.run(async (ctx) => {
      const bucket = (await ctx.db.query("botRequests").first())!;
      await ctx.db.patch(bucket._id, { tokens: 0, tokensAt: Date.now() - 1_500 });
    });
    expect((await get(t, "/bot/v1/programs")).status).toBe(200);
    expect((await get(t, "/bot/v1/programs")).status).toBe(429);
  });

  it("takes one request per call from a full bucket", async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) expect((await get(t, "/bot/v1/programs")).status).toBe(200);
    const bucket = await t.run((ctx) => ctx.db.query("botRequests").first());
    expect(bucket!.tokens).toBeGreaterThan(56.9);
    expect(bucket!.tokens).toBeLessThan(57.1);
  });
});

describe("the allowlist", () => {
  it("sends only these fields from /programs, cached for a minute", async () => {
    vi.stubEnv("LEAGUE_URL", "https://league.staging.example");
    const response = await get(setup(), "/bot/v1/programs");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    const body = await response.json();
    expect(keys(body)).toEqual(["programs", "serverTime"]);
    expect(body.programs.map((program: { id: string }) => program.id)).toEqual(programs.map((program) => program.id));
    for (const program of body.programs) expect(keys(program)).toEqual(["description", "id", "name", "schedule", "url"]);
    expect(body.programs[1]).toMatchObject({ id: "tech-league", url: "https://league.staging.example/" });
    expect(body.programs[3]).toMatchObject({ id: "study-jam", url: null });
  });

  it("sends only these fields from /events", async () => {
    const body = await (await get(setup(), "/bot/v1/events")).json();
    expect(keys(body)).toEqual(["events", "serverTime"]);
    expect(body.events).toHaveLength(programEvents().length);
    for (const event of body.events) {
      expect(keys(event)).toEqual(["end", "endsAt", "id", "note", "phase", "program", "start", "startsAt", "title", "updatedAt", "url"]);
    }
    // Events already there when the API first runs count as old.
    expect(body.events[0]).toMatchObject({ id: "tech-league/registrasi-gelombang-awal", url: `${site}/program/tech-league`, updatedAt: null });
  });

  it("sends only these fields from /cohorts, and nothing about who made them or who is in them", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const cohortId = await ctx.db.insert("cohorts", {
        slug: "catalyst-2026", name: "GDGoC Catalyst 2026/27", status: "active", attendanceTarget: 0.7,
        roles: [{ key: "hacker", name: "Hacker" }, { key: "hipster", name: "Hipster" }], createdBy: "staff-account-id", createdAt: 1, updatedAt: 2,
      });
      await ctx.db.insert("enrolments", {
        cohortId, email: "peserta@example.com", name: "Peserta Uji", role: "hacker", status: "active", importedAt: 1, importedBy: "staff-account-id",
      });
    });
    const response = await get(t, "/bot/v1/cohorts");
    const text = await response.clone().text();
    const body = await response.json();
    expect(keys(body)).toEqual(["cohorts", "serverTime"]);
    expect(body.cohorts).toHaveLength(1);
    expect(keys(body.cohorts[0])).toEqual(["discordChannelId", "id", "name", "roles", "slug", "status"]);
    expect(body.cohorts[0]).toMatchObject({ slug: "catalyst-2026", name: "GDGoC Catalyst 2026/27", status: "active", discordChannelId: null });
    expect(body.cohorts[0].roles).toEqual([{ key: "hacker", name: "Hacker" }, { key: "hipster", name: "Hipster" }]);
    for (const secret of ["staff-account-id", "peserta@example.com", "Peserta Uji", "0.7"]) expect(text).not.toContain(secret);
  });
});

const due = Date.parse("2026-12-01T23:59:00+07:00");
const secrets = ["GDG{rahasia-flag}", "Jawaban rahasia", "Isi tugas", "member-account-id", "staff-account-id", "reviewer-account-id", "peserta@example.com"];

/** A cohort and one task of each kind of audience and status, with a flag, a submission and a reviewer that must never show. */
function seed(t: T) {
  return t.run(async (ctx) => {
    const cohortId = await ctx.db.insert("cohorts", {
      slug: "catalyst-2026", name: "GDGoC Catalyst 2026/27", status: "active", roles: [{ key: "hacker", name: "Hacker" }, { key: "hustler", name: "Hustler" }],
      createdBy: "staff-account-id", createdAt: 1, updatedAt: 1,
    });
    const goneCohort = await ctx.db.insert("cohorts", { slug: "lama", name: "Lama", status: "ended", roles: [], createdBy: "staff-account-id", createdAt: 1, updatedAt: 1 });
    const base = { description: "Isi tugas", revision: 1, createdBy: "staff-account-id", createdAt: 1_000, updatedAt: 1_000 };
    let n = 0;
    const task = (title: string, fields: Partial<Doc<"assignments">> & Pick<Doc<"assignments">, "status">) =>
      ctx.db.insert("assignments", { ...base, title, slug: slugify(title), dueAt: due + n++ * 60_000, ...(fields.status === "draft" ? {} : { publishedAt: 1_000 }), ...fields });
    const ids = {
      member: await task("Untuk member", { status: "published", audience: ["member"], reviewers: ["reviewer-account-id"] }),
      everyone: await task("Untuk semua", { status: "published", audience: ["member", "core", "bod"], updatedAt: 5_000, publishedAt: 4_000 }),
      core: await task("Untuk core", { status: "published", audience: ["core"] }),
      bod: await task("Untuk BoD", { status: "published", audience: ["bod"] }),
      legacy: await task("Tugas lama", { status: "published" }),
      draft: await task("Masih draft", { status: "draft", audience: ["member"] }),
      closed: await task("Sudah ditutup", { status: "closed", audience: ["member"] }),
      hacker: await task("Untuk hacker", { status: "published", cohortId, cohortRoles: ["hacker"] }),
      cohort: await task("Untuk peserta", { status: "published", cohortId }),
      gone: await task("Cohort terhapus", { status: "published", cohortId: goneCohort }),
      flag: await task("Cari flag", { status: "published", audience: ["member"], kind: "flag", maxPoints: 100, minPoints: 20, decrement: 10 }),
    };
    await ctx.db.delete(goneCohort);
    await ctx.db.insert("assignmentFlags", { assignmentId: ids.flag, flag: "GDG{rahasia-flag}", updatedAt: 1, updatedBy: "staff-account-id" });
    await ctx.db.insert("assignmentSubmissions", { assignmentId: ids.member, ownerId: "member-account-id", answer: "Jawaban rahasia", revision: 1, submittedAt: 2, score: 87 });
    await ctx.db.insert("flagSolves", { assignmentId: ids.flag, ownerId: "member-account-id", points: 100, place: 1, solvedAt: 3 });
    await ctx.db.insert("enrolments", { cohortId, email: "peserta@example.com", name: "Peserta", role: "hacker", status: "active", importedAt: 1, importedBy: "staff-account-id" });
    return { cohortId, ids };
  });
}

describe("open tasks", () => {
  it("are the published tasks members can see: for Member, or for a cohort that still exists", async () => {
    const t = setup();
    const { ids } = await seed(t);
    const response = await get(t, "/bot/v1/tasks");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    const body = await response.json();
    expect(keys(body)).toEqual(["serverTime", "tasks"]);
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([ids.member, ids.everyone, ids.hacker, ids.cohort, ids.flag]);
  });

  it("send only these fields, with the cohort and roles a task is for", async () => {
    const t = setup();
    const { cohortId, ids } = await seed(t);
    const { tasks } = await (await get(t, "/bot/v1/tasks")).json();
    for (const task of tasks) {
      expect(keys(task)).toEqual(["cohort", "dueAt", "dueAtIso", "id", "kind", "publishedAt", "title", "updatedAt", "url"]);
      if (task.cohort) expect(keys(task.cohort)).toEqual(["id", "name", "roles"]);
    }
    expect(tasks[0]).toEqual({
      id: ids.member, title: "Untuk member", kind: "regular", cohort: null, dueAt: due, dueAtIso: "2026-12-01T16:59:00.000Z",
      url: `${site}/dashboard/tugas/untuk-member`, publishedAt: 1_000, updatedAt: 1_000,
    });
    expect(tasks[2].cohort).toEqual({ id: cohortId, name: "GDGoC Catalyst 2026/27", roles: ["hacker"] });
    expect(tasks[3].cohort).toEqual({ id: cohortId, name: "GDGoC Catalyst 2026/27", roles: [] });
    expect(tasks[4]).toMatchObject({ id: ids.flag, kind: "flag" });
  });

  it("send null for a task without a deadline, after the dated ones (#276)", async () => {
    const t = setup();
    const { ids } = await seed(t);
    // In the index a missing deadline sorts before every date, so read as one range these two would come first.
    const undated = await t.run(async (ctx) => {
      const id = await ctx.db.insert("assignments", {
        title: "Kapan saja", slug: "kapan-saja", description: "", status: "published", audience: ["member"], revision: 1, createdBy: "staff-account-id", createdAt: 1, updatedAt: 6_000, publishedAt: 6_000,
      });
      await ctx.db.patch(ids.member, { dueAt: undefined, updatedAt: 7_000 });
      return id;
    });
    const { tasks } = await (await get(t, "/bot/v1/tasks")).json();
    expect(tasks.map((task: { id: string }) => task.id)).toEqual([ids.everyone, ids.hacker, ids.cohort, ids.flag, ids.member, undated]);
    expect(tasks[5]).toEqual({
      id: undated, title: "Kapan saja", kind: "regular", cohort: null, dueAt: null, dueAtIso: null,
      url: `${site}/dashboard/tugas/kapan-saja`, publishedAt: 6_000, updatedAt: 6_000,
    });
    // A deadline removed is a change, as any edit is.
    const changes = await (await get(t, "/bot/v1/changes?since=6500")).json();
    expect(changes.tasks).toEqual([expect.objectContaining({ id: ids.member, dueAt: null, dueAtIso: null, updatedAt: 7_000 })]);
  });

  it("link a task without a slug by its id", async () => {
    const t = setup();
    const id = await t.run((ctx) => ctx.db.insert("assignments", {
      title: "Tanpa slug", description: "", dueAt: due, status: "published", audience: ["member"], revision: 1, createdBy: "staff-account-id", createdAt: 1, updatedAt: 1,
    }));
    const { tasks } = await (await get(t, "/bot/v1/tasks")).json();
    expect(tasks[0]).toMatchObject({ id, url: `${site}/dashboard/tugas/${id}`, publishedAt: null });
  });
});

describe("changes since a time", () => {
  it("need since as epoch milliseconds", async () => {
    const t = setup();
    for (const query of ["", "?since=", "?since=abc", "?since=-1", "?since=1.5", "?since=1e12", "?since=99999999999999999"]) {
      const response = await get(t, `/bot/v1/changes${query}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "bad_request", message: "since must be epoch milliseconds" });
    }
  });

  it("send the open tasks updated after since, and where to start next time", async () => {
    const t = setup();
    const { ids } = await seed(t);
    const before = Date.now();
    const response = await get(t, "/bot/v1/changes?since=3000");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(keys(body)).toEqual(["events", "next", "serverTime", "since", "tasks"]);
    expect(body.since).toBe(3_000);
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([ids.everyone]);
    expect(keys(body.tasks[0])).toEqual(["cohort", "dueAt", "dueAtIso", "id", "kind", "publishedAt", "title", "updatedAt", "url"]);
    expect(body.events).toEqual([]);
    expect(body.next).toBeGreaterThanOrEqual(before - 10_000);
    expect(body.next).toBe(body.serverTime - 10_000);

    const all = await (await get(t, "/bot/v1/changes?since=0")).json();
    expect(all.tasks.map((task: { id: string }) => task.id)).toEqual([ids.member, ids.everyone, ids.hacker, ids.cohort, ids.flag]);
    const future = await (await get(t, `/bot/v1/changes?since=${before + 3_600_000}`)).json();
    expect(future).toMatchObject({ tasks: [], events: [], next: before + 3_600_000 });
  });

  it("send a program event once a release adds or moves it", async () => {
    const t = setup();
    await get(t, "/bot/v1/programs"); // The first request records the events in place as old.
    expect(await t.run((ctx) => ctx.db.query("botEventVersions").collect())).toHaveLength(programEvents().length);
    // A release that moved one event and added another.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("botEventVersions").collect();
      await ctx.db.patch(rows.find((row) => row.eventId === "tech-league/final-daring")!._id, { content: "[\"Final daring\",\"Final\",null,\"2027-01-10\",\"2027-01-10\"]" });
      await ctx.db.delete(rows.find((row) => row.eventId === "tech-league/awarding-luring")!._id);
    });
    const since = Date.now() - 1;
    const body = await (await get(t, `/bot/v1/changes?since=${since}`)).json();
    expect(body.events.map((event: { id: string }) => event.id)).toEqual(["tech-league/final-daring", "tech-league/awarding-luring"]);
    for (const event of body.events) {
      expect(keys(event)).toEqual(["end", "endsAt", "id", "note", "phase", "program", "start", "startsAt", "title", "updatedAt", "url"]);
      expect(event.updatedAt).toBeGreaterThan(since);
    }
    const { events } = await (await get(t, "/bot/v1/events")).json();
    expect(events.filter((event: { updatedAt: number | null }) => event.updatedAt !== null)).toHaveLength(2);
    // Served once as it is now, an event is not new again.
    const later = await (await get(t, `/bot/v1/changes?since=${body.events[0].updatedAt}`)).json();
    expect(later.events).toEqual([]);
  });
});

describe("what is never sent", () => {
  it("leaves out flag values, submissions, people and task text on every endpoint", async () => {
    const t = setup();
    await seed(t);
    for (const path of paths) {
      const response = await get(t, path);
      expect(response.status).toBe(200);
      const text = await response.text();
      for (const secret of secrets) expect(text).not.toContain(secret);
      for (const field of ["flag", "score", "points", "answer", "email", "ownerId", "createdBy", "reviewers", "audience"]) expect(text).not.toContain(`"${field}":`);
    }
  });
});
