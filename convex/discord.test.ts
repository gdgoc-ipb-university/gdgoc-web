/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { createFunctionHandle } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const guild = "900000000000000001";
const settings = { DISCORD_CLIENT_ID: "discord-client", DISCORD_CLIENT_SECRET: "discord-secret", DISCORD_BOT_TOKEN: "bot-token", DISCORD_GUILD_ID: guild };

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Discord link record", () => {
  it("says Discord isn't set up until all four settings are on the deployment", async () => {
    const t = setup();
    expect(await t.query(api.discord.mine)).toBeNull();
    const member = await account(t, "anggota@example.com");
    vi.stubEnv("DISCORD_BOT_TOKEN", "");
    expect(await member.query(api.discord.mine)).toEqual({ configured: false, serverUrl: null, link: null });
    vi.stubEnv("DISCORD_BOT_TOKEN", "bot-token");
    expect(await member.query(api.discord.mine)).toEqual({ configured: true, serverUrl: `https://discord.com/channels/${guild}`, link: null });
  });

  it("is written with Better Auth's account row, once per member and once per Discord account", async () => {
    const t = setup();
    const member = await account(t, "anggota@example.com", { onboarded: false });
    const other = await account(t, "lain@example.com");
    await linkDiscord(t, member.id, "111");
    expect(await member.query(api.discord.mine)).toMatchObject({ link: { username: null, joinStatus: "pending", linkedAt: Date.now(), lastSyncedAt: null, lastError: null } });

    // Another member, or a second Discord account for the same member, is refused and Better Auth's insert undone.
    await expect(linkDiscord(t, other.id, "111")).rejects.toThrow("akun member lain");
    await expect(linkDiscord(t, member.id, "222")).rejects.toThrow("Putuskan dulu");
    expect(await accounts(t, other.id)).toEqual(["google"]);
    expect(await accounts(t, member.id)).toEqual(["discord", "google"]);
    expect(await t.run((ctx) => ctx.db.query("discordLinks").collect())).toHaveLength(1);
  });

  it("unlinks the record and Better Auth's account together, leaving Google", async () => {
    const t = setup();
    const member = await account(t, "anggota@example.com");
    await linkDiscord(t, member.id, "111");
    await member.mutation(api.discord.unlink, {});
    expect(await linkRow(t, member.id)).toBeNull();
    expect(await accounts(t, member.id)).toEqual(["google"]);
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
});
