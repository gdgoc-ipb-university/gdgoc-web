/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { cardTokenPattern } from "../src/lib/member-card";
import { noFilters } from "../src/lib/member-table";

// Bulk card printing for staff (#159): who to print, issuing missing numbers, and the cards with their tokens.
const modules = import.meta.glob("./**/*.ts");

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, name: string, { onboarded = true, image = true } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, image: image ? "https://lh3.googleusercontent.com/a/x=s96-c" : null, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), memberType: "member", ...(onboarded ? { completedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik");
  const admin = await account(t, "admin@example.com", "Admin");
  const rania = await account(t, "rania@example.com", "Rania Putri");
  const bima = await account(t, "bima@example.com", "Bima Sakti", { image: false });
  const citra = await account(t, "citra@example.com", "Citra Lestari");
  await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
  await owner.mutation(api.dashboard.setMemberType, { ownerId: rania.id, memberType: "core", division: "Technical" });
  return { t, owner, admin, rania, bima, citra };
}
type Caller = Awaited<ReturnType<typeof account>>;

const everyone = { kind: "filters" as const, search: "", filters: noFilters };
async function selection(caller: Caller, chosen: typeof everyone | { kind: "picked"; ownerIds: string[] } = everyone) {
  const rows: FunctionReturnType<typeof api.cards.printSelection>["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: FunctionReturnType<typeof api.cards.printSelection> = await caller.query(api.cards.printSelection, { selection: chosen, paginationOpts: { numItems: 2, cursor } });
    rows.push(...page.page);
    if (page.isDone) return rows;
    cursor = page.continueCursor;
  }
}
const byName = <T extends { name: string }>(rows: T[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("bulk card printing", () => {
  it("is for staff only, on the server", async () => {
    const { t, rania, bima } = await world();
    await rania.mutation(api.cards.ensure, {});
    for (const caller of [rania, t]) {
      await expect(caller.query(api.cards.printSelection, { selection: everyone, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow(/hanya untuk admin|Masuk kembali/);
      await expect(caller.query(api.cards.printCards, { ownerIds: [rania.id] })).rejects.toThrow(/hanya untuk admin|Masuk kembali/);
      await expect(caller.mutation(api.cards.issueFor, { ownerIds: [bima.id] })).rejects.toThrow(/hanya untuk admin|Masuk kembali/);
    }
    expect(await t.run((ctx) => ctx.db.query("memberCards").collect())).toHaveLength(1);
  });

  it("selects everyone matching the members table's filters and search, or a picked set, page by page and without tokens", async () => {
    const { t, owner, admin, rania, bima, citra } = await world();
    await rania.mutation(api.cards.ensure, {});
    await owner.mutation(api.cards.setRevoked, { ownerId: rania.id, revoked: true });
    await owner.mutation(api.dashboard.setActive, { ownerId: citra.id, active: false });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(8)], { type: "image/jpeg" })));
    await t.run(async (ctx) => {
      const profile = (await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", bima.id)).unique())!;
      await ctx.db.patch(profile._id, { photoStorageId: storageId });
    });
    await account(t, "fresh@example.com", "Belum Selesai", { onboarded: false });

    const all = byName(await selection(admin));
    expect(all.map((row) => row.name)).toEqual(["Admin", "Bima Sakti", "Citra Lestari", "Pemilik", "Rania Putri"]);
    expect(all.find((row) => row.ownerId === rania.id)).toEqual({ ownerId: rania.id, name: "Rania Putri", memberType: "core", division: "Technical", active: true, number: "2627-0001", blocked: true, photo: "google" });
    expect(all.find((row) => row.ownerId === bima.id)).toMatchObject({ number: null, blocked: false, active: true, photo: "uploaded" });
    expect(all.find((row) => row.ownerId === citra.id)).toMatchObject({ active: false, photo: "google" });
    expect(JSON.stringify(all)).not.toMatch(/token|example\.com/);

    const core = await selection(owner, { kind: "filters", search: "", filters: { ...noFilters, community: ["core"] } });
    expect(core.map((row) => row.name)).toEqual(["Rania Putri"]);
    const active = byName(await selection(owner, { kind: "filters", search: "", filters: { ...noFilters, community: ["member"], status: "active" } }));
    expect(active.map((row) => row.name)).toEqual(["Admin", "Bima Sakti", "Pemilik"]);
    const owners = await selection(owner, { kind: "filters", search: "", filters: { ...noFilters, access: ["owner"] } });
    expect(owners.map((row) => row.name)).toEqual(["Pemilik"]);
    expect((await selection(owner, { kind: "filters", search: "bima", filters: noFilters })).map((row) => row.name)).toEqual(["Bima Sakti"]);
    const picked = byName(await selection(owner, { kind: "picked", ownerIds: [citra.id, bima.id, "unknown"] }));
    expect(picked.map((row) => row.name)).toEqual(["Bima Sakti", "Citra Lestari"]);
  });

  it("issues missing numbers in the order given, once, never reusing one, and skips blocked and inactive members", async () => {
    const { t, owner, admin, rania, bima, citra } = await world();
    await rania.mutation(api.cards.ensure, {}); // 2627-0001
    await owner.mutation(api.cards.setRevoked, { ownerId: rania.id, revoked: true });
    const gone = await account(t, "gone@example.com", "Sudah Pergi");
    await gone.mutation(api.cards.ensure, {}); // 2627-0002, then deleted
    await owner.mutation(api.dashboard.deleteAccount, { ownerId: gone.id, confirmName: "Sudah Pergi" });
    const fresh = await account(t, "fresh@example.com", "Belum Selesai", { onboarded: false });
    const last = await account(t, "last@example.com", "Dewi Kartika");
    await last.mutation(api.cards.ensure, {}); // 2627-0003, then made last year's
    await t.run(async (ctx) => {
      const card = (await ctx.db.query("memberCards").withIndex("by_owner", (q) => q.eq("ownerId", last.id)).unique())!;
      await ctx.db.patch(card._id, { period: "2025/26", number: "2526-0019" });
    });
    await owner.mutation(api.dashboard.setActive, { ownerId: citra.id, active: false });
    const before = (await last.query(api.cards.mine, {}))!.token;

    const list = [bima.id, rania.id, citra.id, fresh.id, last.id, admin.id, bima.id];
    const first = await admin.mutation(api.cards.issueFor, { ownerIds: list });
    expect(first.issued).toEqual([{ ownerId: bima.id, number: "2627-0004" }, { ownerId: last.id, number: "2627-0005" }, { ownerId: admin.id, number: "2627-0006" }]);
    expect(first.skipped).toEqual([{ ownerId: rania.id, reason: "blocked" }, { ownerId: citra.id, reason: "inactive" }, { ownerId: fresh.id, reason: "missing" }]);
    // Issued exactly as when members open their card: a valid card of this year, with a new token for last year's.
    const renewed = (await last.query(api.cards.mine, {}))!;
    expect(renewed).toMatchObject({ status: "valid", period: "2026/27", number: "2627-0005" });
    expect(renewed.token).not.toBe(before);
    expect((await bima.query(api.cards.mine, {}))!.token).toMatch(cardTokenPattern);

    // Again: nothing new, and opening the card afterwards keeps the number.
    const again = await owner.mutation(api.cards.issueFor, { ownerIds: list });
    expect(again.issued).toEqual([]);
    expect(again.skipped.filter((row) => row.reason === "current").map((row) => row.ownerId)).toEqual([bima.id, last.id, admin.id]);
    await bima.mutation(api.cards.ensure, {});
    expect((await bima.query(api.cards.mine, {}))!.number).toBe("2627-0004");
    const numbers = (await t.run((ctx) => ctx.db.query("memberCards").collect())).map((card) => card.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(await t.run((ctx) => ctx.db.query("cardCounters").collect())).toMatchObject([{ period: "2026/27", issued: 6 }]);

    const log = await t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(log.filter((row) => row.change === "cardIssued").map(({ actorId, targetId, from, to }) => ({ actorId, targetId, from, to }))).toEqual([
      { actorId: admin.id, targetId: bima.id, from: "none", to: "2627-0004" },
      { actorId: admin.id, targetId: last.id, from: "2526-0019", to: "2627-0005" },
      { actorId: admin.id, targetId: admin.id, from: "none", to: "2627-0006" },
    ]);
    await expect(owner.mutation(api.cards.issueFor, { ownerIds: Array.from({ length: 51 }, (_, index) => `id-${index}`) })).rejects.toThrow(/Paling banyak 50/);
  });

  it("gives staff the whole card with its token for members with this year's card, at print time", async () => {
    const { t, admin, rania, bima, citra } = await world();
    await rania.mutation(api.cards.ensure, {});
    await bima.mutation(api.cards.ensure, {});
    await t.run(async (ctx) => {
      const card = (await ctx.db.query("memberCards").withIndex("by_owner", (q) => q.eq("ownerId", bima.id)).unique())!;
      await ctx.db.patch(card._id, { period: "2025/26" });
    });
    await rania.mutation(api.cards.reissue, {});
    const cards = await admin.query(api.cards.printCards, { ownerIds: [rania.id, bima.id, citra.id, rania.id] });
    const mine = (await rania.query(api.cards.mine, {}))!;
    expect(cards).toEqual([{ ...mine, photoSource: "google" }]);
  });
});
