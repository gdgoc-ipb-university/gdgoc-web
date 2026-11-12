/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { programEvents } from "../src/lib/bot-api";
import { programs } from "../src/lib/programs";

const modules = import.meta.glob("./**/*.ts");
const key = "bot-key-0123456789abcdef";
const site = "https://staging.example";
const paths = ["/bot/v1/programs", "/bot/v1/events", "/bot/v1/cohorts"];

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
      expect(keys(event)).toEqual(["end", "endsAt", "id", "note", "phase", "program", "start", "startsAt", "title", "url"]);
    }
    expect(body.events[0]).toMatchObject({ id: "tech-league/registrasi-gelombang-awal", url: `${site}/program/tech-league` });
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
