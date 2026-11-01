/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import type { TechSupportValues } from "../src/lib/tech-support-request";

const modules = import.meta.glob("./**/*.ts");
const hour = 3600000;

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, name: string) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer", nextStep: 4, revision: 4,
    updatedAt: Date.now(), completedAt: Date.now(), memberType: "member",
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
const values = (extra: Partial<TechSupportValues> = {}): TechSupportValues => ({
  competition: "Gemastik 2026", competitionUrl: "https://gemastik.kemdikbud.go.id", deadline: "2099-11-20", participation: "team",
  teamName: "Tim Dino", helpKinds: ["Review pitch deck", "Ideasi"], progress: "Sudah ada prototipe dan proposal awal.", ...extra,
});

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik");
  const admin = await account(t, "admin@example.com", "Admin");
  const handler = await account(t, "comex@example.com", "Sari Comex");
  const member = await account(t, "member@example.com", "Rania Member");
  const other = await account(t, "other@example.com", "Bima Member");
  await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
  await owner.mutation(api.dashboard.setTechSupportHandler, { ownerId: handler.id, handler: true });
  return { t, owner, admin, handler, member, other };
}

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("Tech Support requests", () => {
  it("validates a request, saves it as new, and shows the member only their own", async () => {
    const { member, other } = await world();
    await expect(member.mutation(api.techSupport.submit, { values: values({ competition: " ", helpKinds: [], participation: "" }) })).rejects.toThrow(/Lengkapi/);
    await expect(member.mutation(api.techSupport.submit, { values: values({ teamName: " " }) })).rejects.toThrow(/Lengkapi/);
    await expect(member.mutation(api.techSupport.submit, { values: values({ competitionUrl: "gemastik" }) })).rejects.toThrow(/Lengkapi/);
    await expect(member.mutation(api.techSupport.submit, { values: values({ deadline: "2020-01-01" }) })).rejects.toThrow(/Lengkapi/);
    // Unknown help kinds are dropped, and kinds come back in the program's order.
    await member.mutation(api.techSupport.submit, { values: values({ helpKinds: ["Review pitch deck", "Ideasi", "Joki"] }) });
    await other.mutation(api.techSupport.submit, { values: values({ participation: "solo", teamName: "Tim Lain" }) });

    const [mine] = await member.query(api.techSupport.mine, {});
    expect(mine).toMatchObject({ competition: "Gemastik 2026", teamName: "Tim Dino", helpKinds: ["Ideasi", "Review pitch deck"], status: "new", mentorName: null });
    expect(mine).not.toHaveProperty("note");
    expect(await member.query(api.techSupport.mine, {})).toHaveLength(1);
    // A solo request keeps no team name.
    expect((await other.query(api.techSupport.mine, {}))[0]).toMatchObject({ participation: "solo", teamName: null });
  });

  it("limits how many requests a member has open at once", async () => {
    const { handler, member } = await world();
    const first = await member.mutation(api.techSupport.submit, { values: values() });
    await member.mutation(api.techSupport.submit, { values: values() });
    await member.mutation(api.techSupport.submit, { values: values() });
    await expect(member.mutation(api.techSupport.submit, { values: values() })).rejects.toThrow(/masih punya 3 permintaan/);
    await handler.mutation(api.techSupport.handle, { id: first, status: "closed", mentorName: "", note: "Lombanya batal." });
    await expect(member.mutation(api.techSupport.submit, { values: values() })).resolves.toBeTruthy();
  });

  it("opens the queue to owners, admins and granted handlers only, and only while the grant and account last", async () => {
    const { owner, admin, handler, member } = await world();
    await member.mutation(api.techSupport.submit, { values: values() });
    for (const caller of [owner, admin, handler]) expect((await caller.query(api.techSupport.queue, {})).requests).toHaveLength(1);
    await expect(member.query(api.techSupport.queue, {})).rejects.toThrow(/pengelola Tech Support/);
    const [row] = (await handler.query(api.techSupport.queue, {})).requests;
    expect(row.member).toMatchObject({ name: "Rania Member", email: "member@example.com", campus: "IPB University" });

    await owner.mutation(api.dashboard.setActive, { ownerId: handler.id, active: false });
    await expect(handler.query(api.techSupport.queue, {})).rejects.toThrow(/dinonaktifkan/);
    await owner.mutation(api.dashboard.setActive, { ownerId: handler.id, active: true });
    expect(await handler.query(api.dashboard.viewer, {})).toMatchObject({ techSupportHandler: true });
    await owner.mutation(api.dashboard.setTechSupportHandler, { ownerId: handler.id, handler: false });
    await expect(handler.query(api.techSupport.queue, {})).rejects.toThrow(/pengelola Tech Support/);
    expect(await handler.query(api.dashboard.viewer, {})).toMatchObject({ techSupportHandler: false });
    expect(await admin.query(api.dashboard.viewer, {})).toMatchObject({ techSupportHandler: true });
  });

  it("lets only owners grant the queue, to active members who are not staff, and logs each change", async () => {
    const { t, owner, admin, handler, member } = await world();
    await expect(admin.mutation(api.dashboard.setTechSupportHandler, { ownerId: member.id, handler: true })).rejects.toThrow(/Hanya pemilik/);
    await expect(owner.mutation(api.dashboard.setTechSupportHandler, { ownerId: admin.id, handler: true })).rejects.toThrow(/sudah bisa/);
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await expect(owner.mutation(api.dashboard.setTechSupportHandler, { ownerId: member.id, handler: true })).rejects.toThrow(/Aktifkan kembali/);
    // Granting again changes nothing and logs nothing.
    await owner.mutation(api.dashboard.setTechSupportHandler, { ownerId: handler.id, handler: true });
    const log = await t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(log.filter((row) => row.change === "techSupportHandler").map(({ targetId, from, to }) => ({ targetId, from, to }))).toEqual([{ targetId: handler.id, from: "off", to: "on" }]);
    expect((await owner.query(api.dashboard.member, { ownerId: handler.id }))).toMatchObject({ techSupportHandler: true });
  });

  it("moves a request through its statuses, needs a mentor to match, and keeps the first match time", async () => {
    try {
      const { handler, member } = await world();
      const id = await member.mutation(api.techSupport.submit, { values: values() });
      await expect(handler.mutation(api.techSupport.handle, { id, status: "inProgress", mentorName: "Dika", note: "" })).rejects.toThrow(/tidak bisa langsung/);
      await expect(handler.mutation(api.techSupport.handle, { id, status: "matched", mentorName: " ", note: "" })).rejects.toThrow(/nama mentor/);
      await expect(handler.mutation(api.techSupport.handle, { id, status: "matched", mentorName: "Dika", note: "x".repeat(501) })).rejects.toThrow(/Catatan maksimal/);

      await handler.mutation(api.techSupport.handle, { id, status: "matched", mentorName: " Dika  Aprilio Wibowo ", note: "Dihubungi lewat WhatsApp." });
      const matched = (await handler.query(api.techSupport.queue, {})).requests[0];
      expect(matched).toMatchObject({ status: "matched", mentorName: "Dika Aprilio Wibowo", note: "Dihubungi lewat WhatsApp.", handledBy: "Sari Comex", closedAt: null });
      expect((await member.query(api.techSupport.mine, {}))[0]).toMatchObject({ status: "matched", mentorName: "Dika Aprilio Wibowo" });

      vi.setSystemTime(Date.now() + 2 * hour); // sessions last a day
      await handler.mutation(api.techSupport.handle, { id, status: "inProgress", mentorName: "Dika Aprilio Wibowo", note: "" });
      await handler.mutation(api.techSupport.handle, { id, status: "closed", mentorName: "Dika Aprilio Wibowo", note: "Selesai mock judging." });
      const closed = (await handler.query(api.techSupport.queue, {})).requests[0];
      expect(closed).toMatchObject({ status: "closed", matchedAt: matched.matchedAt });
      expect(closed.closedAt).toBeGreaterThan(matched.matchedAt!);
      await expect(handler.mutation(api.techSupport.handle, { id, status: "matched", mentorName: "Dika", note: "" })).rejects.toThrow(/tidak bisa langsung/);
      await handler.mutation(api.techSupport.handle, { id, status: "inProgress", mentorName: "Dika Aprilio Wibowo", note: "" });
      expect((await handler.query(api.techSupport.queue, {})).requests[0]).toMatchObject({ status: "inProgress", closedAt: null, matchedAt: matched.matchedAt });
    } finally { vi.useRealTimers(); }
  });

  it("counts requests facilitated and distinct teams supported for the queue", async () => {
    const { owner, handler, member, other } = await world();
    const solo = await member.mutation(api.techSupport.submit, { values: values({ participation: "solo" }) });
    const team = await member.mutation(api.techSupport.submit, { values: values() });
    // A teammate asks for the same team and competition, with different spacing and case.
    const teammate = await other.mutation(api.techSupport.submit, { values: values({ teamName: " tim  dino " }) });
    const otherTeam = await other.mutation(api.techSupport.submit, { values: values({ teamName: "Tim Lain" }) });
    const declined = await owner.mutation(api.techSupport.submit, { values: values({ teamName: "Tim Batal" }) });
    for (const id of [solo, team, teammate]) await handler.mutation(api.techSupport.handle, { id, status: "matched", mentorName: "Maghfira", note: "" });
    await handler.mutation(api.techSupport.handle, { id: team, status: "inProgress", mentorName: "Maghfira", note: "" });
    await handler.mutation(api.techSupport.handle, { id: teammate, status: "closed", mentorName: "Maghfira", note: "" });
    await handler.mutation(api.techSupport.handle, { id: declined, status: "closed", mentorName: "", note: "Di luar cakupan." });

    const { kpis } = await handler.query(api.techSupport.queue, {});
    expect(kpis).toEqual({ facilitated: 3, teams: 1, byStatus: { new: 1, matched: 1, inProgress: 1, closed: 2 } });
    await handler.mutation(api.techSupport.handle, { id: otherTeam, status: "matched", mentorName: "Badzlan", note: "" });
    expect((await handler.query(api.techSupport.queue, {})).kpis).toMatchObject({ facilitated: 4, teams: 2 });
  });

  it("deletes a member's requests with their account", async () => {
    const { t, owner, member } = await world();
    await member.mutation(api.techSupport.submit, { values: values() });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Rania Member" })).toMatchObject({ techSupportRequests: 1 });
    expect(await t.run((ctx) => ctx.db.query("techSupportRequests").collect())).toEqual([]);
  });
});
