/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 20, cursor: null };
const everyone = { search: "", filter: "all" as const, paginationOpts: page };

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function account(t: ReturnType<typeof setup>, email: string, { onboarded = true, name = email.split("@")[0] } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), ...(onboarded ? { completedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("dashboard roles and member management", () => {
  it("derives roles from the allowlist and profile, and requires completed onboarding", async () => {
    const t = setup();
    expect(await t.query(api.dashboard.viewer)).toBeNull();
    const owner = await account(t, "owner@example.com");
    const fresh = await account(t, "fresh@example.com", { onboarded: false });
    expect(await owner.query(api.dashboard.viewer)).toMatchObject({ role: "owner", active: true, onboarded: true });
    expect(await fresh.query(api.dashboard.viewer)).toMatchObject({ role: "member", onboarded: false });
    await expect(fresh.query(api.assignments.list)).rejects.toThrow("Selesaikan perkenalan");
  });

  it("lets only owners promote and demote admins, never other owners", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "member@example.com");
    const other = await account(t, "other@example.com");
    await expect(member.query(api.dashboard.members, everyone)).rejects.toThrow("hanya untuk admin");
    await expect(member.mutation(api.dashboard.setRole, { ownerId: other.id, role: "admin" })).rejects.toThrow("Hanya pemilik");
    await owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "admin" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ role: "admin" });
    await expect(member.mutation(api.dashboard.setRole, { ownerId: other.id, role: "admin" })).rejects.toThrow("Hanya pemilik");
    await expect(owner.mutation(api.dashboard.setRole, { ownerId: owner.id, role: "member" })).rejects.toThrow("konfigurasi server");
    const admins = await member.query(api.dashboard.members, { ...everyone, filter: "admin" });
    expect(admins.page.map((row) => row.email)).toEqual(["member@example.com"]);
    await owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "member" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ role: "member" });
    const profile = await t.run((ctx) => ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", member.id)).unique());
    expect(profile).not.toHaveProperty("role");
  });

  it("lists only onboarded members with emails and roles", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    await account(t, "member@example.com", { name: "Anggota Satu" });
    await account(t, "fresh@example.com", { onboarded: false });
    const rows = (await owner.query(api.dashboard.members, everyone)).page;
    expect(rows.map((row) => [row.email, row.role]).sort()).toEqual([["member@example.com", "member"], ["owner@example.com", "owner"]]);
    expect(await owner.query(api.dashboard.stats)).toEqual({ members: 2, admins: 0, deactivated: 0 });
  });

  it("deactivates members, blocks their dashboard access, and protects admins and owners", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const admin = await account(t, "admin@example.com");
    const member = await account(t, "member@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await expect(member.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("hanya untuk admin");
    await expect(admin.mutation(api.dashboard.setActive, { ownerId: owner.id, active: false })).rejects.toThrow("pemilik tidak bisa");
    await expect(admin.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("akunmu sendiri");
    await expect(owner.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("Turunkan peran admin");

    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ active: false });
    await expect(member.query(api.assignments.list)).rejects.toThrow("dinonaktifkan");
    await expect(owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "admin" })).rejects.toThrow("Aktifkan kembali");
    expect((await owner.query(api.dashboard.members, { ...everyone, filter: "deactivated" })).page.map((row) => row.email)).toEqual(["member@example.com"]);

    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: true });
    expect(await member.query(api.assignments.list)).toEqual([]);
  });

  it("finds members by name", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    await account(t, "a@example.com", { name: "Rania Putri" });
    await account(t, "b@example.com", { name: "Bima Sakti" });
    const found = await owner.query(api.dashboard.members, { ...everyone, search: "rania" });
    expect(found.page.map((row) => row.fullName)).toEqual(["Rania Putri"]);
  });
});
