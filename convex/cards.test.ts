/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { cardTokenPattern } from "../src/lib/member-card";

const modules = import.meta.glob("./**/*.ts");
const photo = "https://lh3.googleusercontent.com/a/example=s96-c";

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, name: string, { onboarded = true } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, image: photo, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), memberType: "core", division: "Technical", ...(onboarded ? { completedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik");
  const admin = await account(t, "admin@example.com", "Admin");
  const member = await account(t, "member@example.com", "Rania Putri");
  const other = await account(t, "other@example.com", "Bima Sakti");
  await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
  return { t, owner, admin, member, other };
}
type Caller = Awaited<ReturnType<typeof account>>;
async function open(caller: Caller) {
  await caller.mutation(api.cards.ensure, {});
  return (await caller.query(api.cards.mine, {}))!;
}

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("member cards", () => {
  it("issues one card per member on first open, numbered in order for the chapter year", async () => {
    const { member, other } = await world();
    expect(await member.query(api.cards.mine, {})).toBeNull();
    const first = await open(member);
    expect(first).toMatchObject({ status: "valid", number: "2627-0001", period: "2026/27", name: "Rania Putri", photo, memberType: "core", division: "Technical", tagConfirmed: false, revokedAt: null });
    expect(first.token).toMatch(cardTokenPattern);
    // Opening it again changes nothing.
    expect(await open(member)).toEqual(first);
    const second = await open(other);
    expect(second.number).toBe("2627-0002");
    expect(second.token).not.toBe(first.token);
  });

  it("is for onboarded, active members only", async () => {
    const { t, owner, member } = await world();
    const fresh = await account(t, "fresh@example.com", "Baru", { onboarded: false });
    await expect(fresh.mutation(api.cards.ensure, {})).rejects.toThrow(/Selesaikan perkenalan/);
    await expect(t.mutation(api.cards.ensure, {})).rejects.toThrow(/Masuk kembali/);
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await expect(member.mutation(api.cards.ensure, {})).rejects.toThrow(/dinonaktifkan/);
  });

  it("shows a guest only the name, community tag and chapter year of a valid card", async () => {
    const { t, member } = await world();
    const card = await open(member);
    const scan = await t.query(api.cards.verify, { token: card.token });
    expect(scan).toEqual({ viewer: "guest", status: "valid", card: { name: "Rania Putri", memberType: "core", division: "Technical", tagConfirmed: false, period: "2026/27" } });
    expect(JSON.stringify(scan)).not.toMatch(/example\.com|googleusercontent|IPB University|2627-/);
  });

  it("gives guests one answer for every card that is not valid", async () => {
    const { t, owner, member, other } = await world();
    const revoked = await open(member), inactive = await open(other);
    await owner.mutation(api.cards.setRevoked, { ownerId: member.id, revoked: true });
    await owner.mutation(api.dashboard.setActive, { ownerId: other.id, active: false });
    const invalid = { viewer: "guest", status: "invalid", card: null };
    for (const token of [revoked.token, inactive.token, "A".repeat(22), "not a token", ""]) {
      expect(await t.query(api.cards.verify, { token }), token).toEqual(invalid);
    }
    // Staff see why.
    expect((await owner.query(api.cards.verify, { token: revoked.token })).status).toBe("revoked");
    expect((await owner.query(api.cards.verify, { token: inactive.token })).status).toBe("inactive");
    expect(await owner.query(api.cards.verify, { token: "A".repeat(22) })).toEqual({ viewer: "staff", status: "unknown", card: null, gatherings: [] });
  });

  it("shows the whole card to staff and to its holder, and the guest view to other members", async () => {
    const { owner, admin, member, other } = await world();
    const card = await open(member);
    for (const caller of [owner, admin]) {
      expect(await caller.query(api.cards.verify, { token: card.token })).toMatchObject({ viewer: "staff", status: "valid", card: { ownerId: member.id, number: "2627-0001", photo, campus: "IPB University" } });
    }
    expect(await member.query(api.cards.verify, { token: card.token })).toMatchObject({ viewer: "self", card: { number: "2627-0001" } });
    expect(await other.query(api.cards.verify, { token: card.token })).toMatchObject({ viewer: "guest", status: "valid", card: { name: "Rania Putri" } });
  });

  it("replaces the QR: the old token stops working at once", async () => {
    const { t, member } = await world();
    const before = await open(member);
    await member.mutation(api.cards.reissue, {});
    const after = (await member.query(api.cards.mine, {}))!;
    expect(after.token).not.toBe(before.token);
    expect(after.number).toBe(before.number);
    expect((await t.query(api.cards.verify, { token: before.token })).status).toBe("invalid");
    expect((await t.query(api.cards.verify, { token: after.token })).status).toBe("valid");
  });

  it("refuses to replace a QR before the card is opened or while it is blocked", async () => {
    const { owner, member } = await world();
    await expect(member.mutation(api.cards.reissue, {})).rejects.toThrow(/Buka kartu/);
    await open(member);
    await owner.mutation(api.cards.setRevoked, { ownerId: member.id, revoked: true });
    await expect(member.mutation(api.cards.reissue, {})).rejects.toThrow(/diblokir/);
    expect((await member.query(api.cards.mine, {}))!.status).toBe("revoked");
  });

  it("lets staff block and unblock cards along the member hierarchy, and logs real changes", async () => {
    const { t, owner, admin, member } = await world();
    await open(member); await open(admin); await open(owner);
    await admin.mutation(api.cards.setRevoked, { ownerId: member.id, revoked: true });
    await admin.mutation(api.cards.setRevoked, { ownerId: member.id, revoked: true }); // no-op, not logged
    await admin.mutation(api.cards.setRevoked, { ownerId: member.id, revoked: false });
    await expect(admin.mutation(api.cards.setRevoked, { ownerId: admin.id, revoked: true })).rejects.toThrow(/sendiri/);
    await expect(admin.mutation(api.cards.setRevoked, { ownerId: owner.id, revoked: true })).rejects.toThrow(/pemilik tidak bisa/);
    await owner.mutation(api.cards.setRevoked, { ownerId: admin.id, revoked: true });
    const other = await account(t, "late@example.com", "Belum Buka");
    await expect(owner.mutation(api.cards.setRevoked, { ownerId: other.id, revoked: true })).rejects.toThrow(/belum pernah membuka/);
    const log = await t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(log.filter((row) => row.change === "card").map(({ actorId, targetId, from, to }) => ({ actorId, targetId, from, to }))).toEqual([
      { actorId: admin.id, targetId: member.id, from: "active", to: "revoked" },
      { actorId: admin.id, targetId: member.id, from: "revoked", to: "active" },
      { actorId: owner.id, targetId: admin.id, from: "active", to: "revoked" },
    ]);
  });

  it("refuses admins acting on another admin's card", async () => {
    const { t, owner, admin } = await world();
    const second = await account(t, "admin2@example.com", "Admin Dua");
    await owner.mutation(api.dashboard.setRole, { ownerId: second.id, role: "admin" });
    await open(second);
    await expect(admin.mutation(api.cards.setRevoked, { ownerId: second.id, revoked: true })).rejects.toThrow(/Hanya pemilik/);
  });

  it("gives a card from an earlier chapter year a new number and token when it is opened again", async () => {
    const { t, owner, member } = await world();
    const old = await open(member);
    await t.run(async (ctx) => {
      const card = (await ctx.db.query("memberCards").first())!;
      await ctx.db.patch(card._id, { period: "2025/26", number: "2526-0007" });
    });
    expect((await owner.query(api.cards.verify, { token: old.token })).status).toBe("expired");
    expect((await t.query(api.cards.verify, { token: old.token })).status).toBe("invalid");
    const renewed = await open(member);
    expect(renewed).toMatchObject({ status: "valid", period: "2026/27", number: "2627-0002" });
    expect(renewed.token).not.toBe(old.token);
  });

  it("deletes the card with the account and never gives its number out again", async () => {
    const { t, owner, member } = await world();
    const card = await open(member);
    const counts = await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Rania Putri" });
    expect(counts.cards).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("memberCards").collect())).toEqual([]);
    expect((await owner.query(api.cards.verify, { token: card.token })).status).toBe("unknown");
    const next = await account(t, "next@example.com", "Anggota Baru");
    expect((await open(next)).number).toBe("2627-0002");
  });
});
