/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { toJakartaInput } from "../src/lib/assignment";

const modules = import.meta.glob("./**/*.ts");
const hour = 3600000;

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, name: string, memberType: "member" | "core" | "bod" = "member") {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer", nextStep: 4, revision: 4,
    updatedAt: Date.now(), completedAt: Date.now(), memberType, ...(memberType === "core" ? { division: "Technical" } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
type Caller = Awaited<ReturnType<typeof account>>;
const values = (title = "Rapat Core Team", audience: ("member" | "core" | "bod")[] = ["core"]) =>
  ({ title, venue: "Javano Coffee, Private Room 2", audience, startsAt: toJakartaInput(Date.now() - hour), endsAt: toJakartaInput(Date.now() + 3 * hour) });
async function tokenOf(caller: Caller) {
  await caller.mutation(api.cards.ensure, {});
  return (await caller.query(api.cards.mine, {}))!.token;
}

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik", "bod");
  const core = await account(t, "core@example.com", "Citra Core", "core");
  const member = await account(t, "member@example.com", "Rania Member");
  const sekben = await account(t, "sekben@example.com", "Sari Sekben");
  const gathering = await owner.mutation(api.gatherings.create, { values: values() });
  return { t, owner, core, member, sekben, gathering };
}

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("gatherings", () => {
  it("validates what staff enter, and starts as a draft", async () => {
    const { owner, gathering } = await world();
    await expect(owner.mutation(api.gatherings.create, { values: { ...values(), title: " ", audience: [] } })).rejects.toThrow(/Lengkapi/);
    const bad = { ...values(), endsAt: values().startsAt };
    await expect(owner.mutation(api.gatherings.create, { values: bad })).rejects.toThrow(/Lengkapi/);
    const [row] = await owner.query(api.gatherings.list, {});
    expect(row).toMatchObject({ _id: gathering, title: "Rapat Core Team", status: "draft", audience: ["core"], checkIns: 0, audienceSize: 1 });
  });

  it("checks a member in by their scanned card while open, and reports a repeat scan with the first time", async () => {
    const { t, owner, core, gathering } = await world();
    const token = await tokenOf(core);
    await expect(owner.mutation(api.gatherings.checkIn, { id: gathering, token })).rejects.toThrow(/belum dibuka/);
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    const first = await owner.mutation(api.gatherings.checkIn, { id: gathering, token });
    expect(first).toMatchObject({ result: "checkedIn", name: "Citra Core" });
    expect(await owner.mutation(api.gatherings.checkIn, { id: gathering, token })).toEqual({ result: "already", name: "Citra Core", checkedInAt: (first as { checkedInAt: number }).checkedInAt });
    const detail = (await owner.query(api.gatherings.get, { id: gathering }))!;
    expect(detail.checkIns).toEqual([expect.objectContaining({ name: "Citra Core", method: "scan", by: "Pemilik", outsideAudience: false })]);
    expect(detail.absent).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("checkIns").collect())).toHaveLength(1);
  });

  it("warns before checking in someone outside the audience, then marks them", async () => {
    const { owner, member, gathering } = await world();
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    const token = await tokenOf(member);
    expect(await owner.mutation(api.gatherings.checkIn, { id: gathering, token })).toEqual({ result: "outside", name: "Rania Member", memberType: "member", division: null });
    expect(await owner.mutation(api.gatherings.checkIn, { id: gathering, token, allowOutside: true })).toMatchObject({ result: "checkedIn" });
    expect((await owner.query(api.gatherings.get, { id: gathering }))!.checkIns[0]).toMatchObject({ name: "Rania Member", outsideAudience: true });
  });

  it("refuses cards that are not valid", async () => {
    const { owner, core, gathering } = await world();
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    const token = await tokenOf(core);
    await core.mutation(api.cards.reissue, {});
    for (const bad of [token, "not-a-token"]) await expect(owner.mutation(api.gatherings.checkIn, { id: gathering, token: bad })).rejects.toThrow(/tidak berlaku/);
  });

  it("lets a door helper who is not staff check people in by scanning, and nothing more", async () => {
    const { t, owner, core, member, sekben, gathering } = await world();
    const token = await tokenOf(core);
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    // Before being added, the scan shows Sari the guest view and the door refuses her.
    expect((await sekben.query(api.cards.verify, { token })).viewer).toBe("guest");
    await expect(sekben.mutation(api.gatherings.checkIn, { id: gathering, token })).rejects.toThrow(/hanya untuk/);
    await owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: sekben.id, helper: true });
    expect(await sekben.query(api.dashboard.viewer, {})).toMatchObject({ role: "member", doorHelper: true });
    const scan = await sekben.query(api.cards.verify, { token });
    expect(scan).toMatchObject({ viewer: "helper", status: "valid", card: { name: "Citra Core", number: expect.any(String) }, gatherings: [{ _id: gathering, title: "Rapat Core Team", checkedInAt: null, inAudience: true }] });
    expect(await sekben.mutation(api.gatherings.checkIn, { id: gathering, token })).toMatchObject({ result: "checkedIn" });
    expect((await sekben.query(api.cards.verify, { token })).gatherings).toEqual([expect.objectContaining({ checkedInAt: expect.any(Number) })]);
    // The door's list, without the helpers' names, and manual check-in for someone without their phone.
    const door = (await sekben.query(api.gatherings.get, { id: gathering }))!;
    expect(door).toMatchObject({ staff: false, helpers: [] });
    await sekben.mutation(api.gatherings.checkIn, { id: gathering, ownerId: member.id, allowOutside: true });
    expect((await sekben.query(api.gatherings.list, {})).map((row) => row.checkIns)).toEqual([2]);
    // Managing stays with staff.
    for (const call of [
      sekben.mutation(api.gatherings.setStatus, { id: gathering, status: "closed" }),
      sekben.mutation(api.gatherings.update, { id: gathering, values: values("Lain") }),
      sekben.mutation(api.gatherings.setHelper, { id: gathering, ownerId: member.id, helper: true }),
    ]) await expect(call).rejects.toThrow(/hanya untuk/);
    // A helper of one gathering is not a helper of another.
    const other = await owner.mutation(api.gatherings.create, { values: values("Kumpul member", ["member"]) });
    await owner.mutation(api.gatherings.setStatus, { id: other, status: "open" });
    await expect(sekben.mutation(api.gatherings.checkIn, { id: other, token })).rejects.toThrow(/hanya untuk/);
    const log = await t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(log.map(({ change, targetId, from, to, gatheringId }) => ({ change, targetId, from, to, gatheringId }))).toEqual([{ change: "gatheringHelper", targetId: sekben.id, from: "off", to: "on", gatheringId: gathering }]);
  });

  it("shows a scan only today's open gatherings", async () => {
    const { t, owner, core, gathering } = await world();
    const token = await tokenOf(core);
    expect((await owner.query(api.cards.verify, { token })).gatherings).toEqual([]);
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    expect((await owner.query(api.cards.verify, { token })).gatherings).toHaveLength(1);
    await t.run((ctx) => ctx.db.patch(gathering, { startsAt: Date.now() - 72 * hour, endsAt: Date.now() - 70 * hour }));
    expect((await owner.query(api.cards.verify, { token })).gatherings).toEqual([]);
  });

  it("freezes the list once closed, and keeps a gathering with check-ins out of draft", async () => {
    const { owner, core, member, gathering } = await world();
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    await owner.mutation(api.gatherings.checkIn, { id: gathering, ownerId: core.id });
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "closed" });
    await expect(owner.mutation(api.gatherings.checkIn, { id: gathering, ownerId: member.id, allowOutside: true })).rejects.toThrow(/ditutup/);
    const [row] = (await owner.query(api.gatherings.get, { id: gathering }))!.checkIns;
    await expect(owner.mutation(api.gatherings.removeCheckIn, { id: row._id })).rejects.toThrow(/ditutup/);
    await expect(owner.mutation(api.gatherings.setStatus, { id: gathering, status: "draft" })).rejects.toThrow(/draft/);
    await expect(owner.mutation(api.gatherings.remove, { id: gathering })).rejects.toThrow(/Hanya draft/);
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    await owner.mutation(api.gatherings.removeCheckIn, { id: row._id });
    expect((await owner.query(api.gatherings.get, { id: gathering }))!.checkIns).toEqual([]);
  });

  it("refuses door helpers who are staff, inactive, or one too many", async () => {
    const { t, owner, gathering } = await world();
    const admin = await account(t, "admin@example.com", "Admin");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await expect(owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: admin.id, helper: true })).rejects.toThrow(/sudah bisa/);
    const helpers = await Promise.all(Array.from({ length: 11 }, (_, index) => account(t, `h${index}@example.com`, `Helper ${index}`)));
    for (const helper of helpers.slice(0, 10)) await owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: helper.id, helper: true });
    await expect(owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: helpers[10].id, helper: true })).rejects.toThrow(/Maksimal 10/);
    await owner.mutation(api.dashboard.setActive, { ownerId: helpers[10].id, active: false });
    await owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: helpers[0].id, helper: false });
    await expect(owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: helpers[10].id, helper: true })).rejects.toThrow(/Aktifkan kembali/);
  });

  it("lists a member's own check-ins", async () => {
    const { owner, core, gathering } = await world();
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    await owner.mutation(api.gatherings.checkIn, { id: gathering, ownerId: core.id });
    expect(await core.query(api.gatherings.mine, {})).toEqual([expect.objectContaining({ title: "Rapat Core Team", venue: "Javano Coffee, Private Room 2" })]);
  });

  it("deletes check-ins and helper grants with the account", async () => {
    const { t, owner, core, sekben, gathering } = await world();
    await owner.mutation(api.gatherings.setStatus, { id: gathering, status: "open" });
    await owner.mutation(api.gatherings.checkIn, { id: gathering, ownerId: core.id });
    await owner.mutation(api.gatherings.setHelper, { id: gathering, ownerId: sekben.id, helper: true });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: core.id, confirmName: "Citra Core" })).toMatchObject({ checkIns: 1, helperGrants: 0 });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: sekben.id, confirmName: "Sari Sekben" })).toMatchObject({ checkIns: 0, helperGrants: 1 });
    expect(await t.run((ctx) => ctx.db.query("checkIns").collect())).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(gathering)))!.helpers).toEqual([]);
  });
});
