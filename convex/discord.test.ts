/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { createFunctionHandle } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { retryDelays } from "./discord";

const modules = import.meta.glob("./**/*.ts");
const guild = "900000000000000001";
const settings = { DISCORD_CLIENT_ID: "discord-client", DISCORD_CLIENT_SECRET: "discord-secret", DISCORD_BOT_TOKEN: "bot-token", DISCORD_GUILD_ID: guild };
const busy = "Discord sedang sibuk. Kami mencoba lagi otomatis.";

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type T = ReturnType<typeof setup>;

async function account(t: T, email: string, { onboarded = true, deactivated = false } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: email.split("@")[0], email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "account", data: { userId: user._id, providerId: "google", accountId: `google-${email}`, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: email.split("@")[0], campus: "IPB University", studyProgram: "Ilmu Komputer", nextStep: onboarded ? 6 : 4,
    revision: 4, updatedAt: Date.now(), memberType: "member", ...(onboarded ? { completedAt: Date.now() } : {}), ...(deactivated ? { deactivatedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}

/** Better Auth's insert of a Discord account row at the end of a link, which runs the account trigger as the component does. */
function linkDiscord(t: T, userId: string, discordId: string) {
  return t.run(async (ctx) => ctx.runMutation(components.betterAuth.adapter.create, {
    input: { model: "account", data: { userId, providerId: "discord", accountId: discordId, accessToken: `token-${discordId}`, scope: "identify,guilds.join", createdAt: Date.now(), updatedAt: Date.now() } },
    onCreateHandle: await createFunctionHandle(internal.auth.onCreate),
  }));
}

const accounts = (t: T, userId: string) => t.query(components.betterAuth.adapter.findMany, {
  model: "account", where: [{ field: "userId", operator: "eq", value: userId }], paginationOpts: { numItems: 10, cursor: null },
}).then((result) => result.page.map((row: { providerId: string }) => row.providerId).sort());
const linkRow = (t: T, ownerId: string) => t.run((ctx) => ctx.db.query("discordLinks").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique());

type Reply = { status: number; body?: unknown };
/** Discord's API: `/users/@me` answers for `me`, and each Add Guild Member call takes the next reply. */
function mockDiscord(joins: Reply[], me = { id: "111", username: "temanuji" }) {
  const calls: { url: string; method: string; auth: string | null; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET", auth: new Headers(init.headers).get("authorization"), body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith("/users/@me")) return Response.json(me);
    const reply = joins.shift() ?? { status: 500 };
    return reply.body === undefined ? new Response(null, { status: reply.status }) : Response.json(reply.body, { status: reply.status });
  }));
  return calls.filter.bind(calls, (call) => call.method === "PUT");
}

/** Runs the joins that are due now, without waiting for retries. */
async function runDue(t: T) { vi.advanceTimersByTime(0); await t.finishInProgressScheduledFunctions(); }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.stubEnv("SITE_URL", "http://localhost:3104");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-long-enough-for-better-auth");
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Discord link record", () => {
  it("says Discord isn't set up until all four settings are on the deployment", async () => {
    const t = setup();
    expect(await t.query(api.discord.mine)).toBeNull();
    const member = await account(t, "anggota@example.com");
    vi.stubEnv("DISCORD_BOT_TOKEN", "");
    expect(await member.query(api.discord.mine)).toEqual({ configured: false, serverUrl: null, link: null });
    expect(await t.query(internal.discord.linkProblem, { userId: member.id })).toBe("Discord belum disiapkan pengurus.");
    vi.stubEnv("DISCORD_BOT_TOKEN", "bot-token");
    expect(await member.query(api.discord.mine)).toEqual({ configured: true, serverUrl: `https://discord.com/channels/${guild}`, link: null });
    expect(await t.query(internal.discord.linkProblem, { userId: member.id })).toBeNull();
  });

  it("is written with Better Auth's account row, once per member and once per Discord account", async () => {
    const t = setup();
    mockDiscord([{ status: 201, body: {} }]);
    const member = await account(t, "anggota@example.com", { onboarded: false });
    const other = await account(t, "lain@example.com");
    await linkDiscord(t, member.id, "111");
    expect(await member.query(api.discord.mine)).toMatchObject({ link: { username: null, joinStatus: "pending", linkedAt: Date.now(), lastSyncedAt: null, lastError: null } });
    expect(await t.query(internal.discord.linkProblem, { userId: member.id })).toContain("sudah terhubung ke Discord");

    // Another member, or a second Discord account for the same member, is refused and Better Auth's insert undone.
    await expect(linkDiscord(t, other.id, "111")).rejects.toThrow("akun member lain");
    await expect(linkDiscord(t, member.id, "222")).rejects.toThrow("Putuskan dulu");
    expect(await accounts(t, other.id)).toEqual(["google"]);
    expect(await accounts(t, member.id)).toEqual(["discord", "google"]);
    expect(await t.run((ctx) => ctx.db.query("discordLinks").collect())).toHaveLength(1);
  });

  it("refuses linking for a deactivated account", async () => {
    const t = setup();
    const member = await account(t, "nonaktif@example.com", { deactivated: true });
    expect(await t.query(internal.discord.linkProblem, { userId: member.id })).toContain("dinonaktifkan");
  });

  it("unlinks the record and Better Auth's account together, leaving Google and stopping a pending join", async () => {
    const t = setup();
    const puts = mockDiscord([{ status: 201, body: {} }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await member.mutation(api.discord.unlink, {});
    expect(await linkRow(t, member.id)).toBeNull();
    expect(await accounts(t, member.id)).toEqual(["google"]);
    await runDue(t);
    expect(puts()).toEqual([]);
    expect(await member.query(api.discord.mine)).toMatchObject({ link: null });
    await expect(t.mutation(api.discord.unlink, {})).rejects.toThrow("Masuk kembali");

    // Better Auth's own unlink takes the record with it through the delete trigger.
    await linkDiscord(t, member.id, "111");
    await t.run(async (ctx) => ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: "account", where: [{ field: "userId", operator: "eq", value: member.id }, { field: "providerId", operator: "eq", value: "discord" }] },
      onDeleteHandle: await createFunctionHandle(internal.auth.onDelete),
    }));
    expect(await linkRow(t, member.id)).toBeNull();
  });

  it("shows staff who linked Discord, with the username and join status but not the Discord ID", async () => {
    vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com");
    const t = setup();
    mockDiscord([{ status: 201, body: {} }]);
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    const row = await owner.query(api.dashboard.member, { ownerId: member.id });
    expect(row?.discord).toEqual({ username: "temanuji", linkedAt: Date.now(), joinStatus: "joined", lastError: null });
    const list = await owner.query(api.dashboard.members, { search: "", filters: {}, page: 1, pageSize: 25 });
    expect(list.rows.map((entry) => entry.discord?.username ?? null).sort()).toEqual([null, "temanuji"]);
  });

  it("goes with a deleted account, counted", async () => {
    vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com");
    const t = setup();
    mockDiscord([{ status: 201, body: {} }]);
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "anggota" })).toMatchObject({ discordLinks: 1, accounts: 2 });
    expect(await t.run((ctx) => ctx.db.query("discordLinks").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("accountDeletions").first())).toMatchObject({ counts: { discordLinks: 1, accounts: 2 } });
  });
});

describe("joining the server", () => {
  it("adds the member with their token and the bot's, and records the username", async () => {
    const t = setup();
    const puts = mockDiscord([{ status: 201, body: { user: { id: "111" } } }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    expect(puts()).toEqual([{ url: `https://discord.com/api/v10/guilds/${guild}/members/111`, method: "PUT", auth: "Bot bot-token", body: { access_token: "token-111" } }]);
    expect(await member.query(api.discord.mine)).toMatchObject({ link: { username: "temanuji", joinStatus: "joined", lastSyncedAt: Date.now(), lastError: null } });
  });

  it("counts a member who is already in the server as joined", async () => {
    const t = setup();
    mockDiscord([{ status: 204 }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "joined", attempts: 1 });
  });

  it("waits as long as a 429 asks, then tries again", async () => {
    const t = setup();
    const puts = mockDiscord([{ status: 429, body: { message: "You are being rate limited.", retry_after: 2.5, global: false } }, { status: 201, body: {} }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "pending", lastError: busy, attempts: 1 });
    vi.advanceTimersByTime(2_400); await t.finishInProgressScheduledFunctions();
    expect(puts()).toHaveLength(1);
    vi.advanceTimersByTime(100); await t.finishInProgressScheduledFunctions();
    expect(puts()).toHaveLength(2);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "joined", attempts: 2 });
    expect((await linkRow(t, member.id))?.lastError).toBeUndefined();
  });

  it("backs off on Discord's errors and gives up after the last retry", async () => {
    const t = setup();
    const puts = mockDiscord(Array.from({ length: 10 }, () => ({ status: 503, body: { message: "Service Unavailable" } })));
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    for (const delay of retryDelays) {
      vi.advanceTimersByTime(delay - 1); await t.finishInProgressScheduledFunctions();
      expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "pending", lastError: busy });
      vi.advanceTimersByTime(1); await t.finishInProgressScheduledFunctions();
    }
    expect(puts()).toHaveLength(retryDelays.length + 1);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "failed", lastError: "Discord sedang bermasalah. Coba lagi nanti.", username: "temanuji" });
  });

  it("records a refusal for the member and lets them try again", async () => {
    const t = setup();
    const puts = mockDiscord([{ status: 403, body: { message: "Missing Permissions", code: 50013 } }, { status: 400, body: { message: "Maximum number of guilds reached (100)", code: 30001 } }, { status: 201, body: {} }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await runDue(t);
    expect(await member.query(api.discord.mine)).toMatchObject({ link: { joinStatus: "failed", lastError: "Bot GDGoC IPB belum punya izin menambahkan member. Pengurus perlu memeriksanya." } });
    await member.mutation(api.discord.retryJoin, {});
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "pending" });
    await runDue(t);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "failed", lastError: expect.stringContaining("100 server") });
    await member.mutation(api.discord.retryJoin, {});
    await runDue(t);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "joined", attempts: 3 });
    // A joined link has nothing to retry.
    await member.mutation(api.discord.retryJoin, {});
    await runDue(t);
    expect(puts()).toHaveLength(3);
  });

  it("doesn't add a deactivated account, or one whose token is gone", async () => {
    const t = setup();
    const puts = mockDiscord([{ status: 201, body: {} }]);
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", member.id)).unique();
      await ctx.db.patch(profile!._id, { deactivatedAt: Date.now() });
    });
    await runDue(t);
    expect(await linkRow(t, member.id)).toMatchObject({ joinStatus: "failed", lastError: expect.stringContaining("dinonaktifkan") });

    const other = await account(t, "lain@example.com");
    await linkDiscord(t, other.id, "222");
    await t.mutation(components.betterAuth.adapter.updateMany, {
      input: { model: "account", where: [{ field: "userId", operator: "eq", value: other.id }, { field: "providerId", operator: "eq", value: "discord" }], update: { accessToken: "deadbeef" } },
      paginationOpts: { numItems: 10, cursor: null },
    });
    await runDue(t);
    expect(await linkRow(t, other.id)).toMatchObject({ joinStatus: "failed", lastError: expect.stringContaining("Izin Discord sudah tidak berlaku") });
    expect(puts()).toEqual([]);
  });
});
