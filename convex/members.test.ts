/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const values = { fullName: "Teman Pengujian", campus: "IPB University", studyProgram: "Ilmu Komputer" };
const steps = [1, 2, 4, 5, 6] as const;
function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function member(t: ReturnType<typeof setup>, email = "onboarding@example.com", verified = true, expiresAt = Date.now() + 3600000) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: "Nama Google", email, emailVerified: verified, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id, email });
}

/** Saves every onboarding screen in order. */
async function onboard(account: Awaited<ReturnType<typeof member>>) {
  for (const [index, step] of steps.entries()) await account.mutation(api.members.saveStep, { step, revision: index, values });
}

describe("first-time member onboarding", () => {
  it("only writes profiles for active verified account owners", async () => {
    const t = setup();
    expect(await t.query(api.members.profile)).toBeNull();
    await expect(t.mutation(api.members.saveStep, { step: 1, revision: 0, values })).rejects.toThrow("Masuk kembali");
    for (const account of [await member(t, "unverified@example.com", false), await member(t, "expired@example.com", true, Date.now() - 1)]) {
      expect(await account.query(api.members.profile)).toBeNull();
      await expect(account.mutation(api.members.saveStep, { step: 1, revision: 0, values })).rejects.toThrow("Masuk kembali");
    }
  });

  it("resumes the next saved screen, preserves private profiles, and uses the chosen name", async () => {
    const t = setup(); const owner = await member(t); const other = await member(t, "other@example.com");
    await owner.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, fullName: "  Teman   Pengujian  " } });
    const restored = await owner.query(api.members.profile);
    expect(restored).toMatchObject({ fullName: "Teman Pengujian", nextStep: 2, revision: 1, campus: "" });
    expect(restored?.completedAt).toBeUndefined();
    expect(await other.query(api.members.profile)).toBeNull();
    expect((await owner.query(api.auth.viewer))?.name).toBe("Teman Pengujian");
    await other.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, fullName: "Akun Lain" } });
    expect((await owner.query(api.members.profile))?.fullName).toBe("Teman Pengujian");
  });

  it("validates required fields and ordering on the server while accepting unlisted education", async () => {
    const owner = await member(setup());
    await expect(owner.mutation(api.members.saveStep, { step: 4, revision: 0, values })).rejects.toThrow("langkah sebelumnya");
    await expect(owner.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, fullName: " " } })).rejects.toThrow("Lengkapi");
    await owner.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    await expect(owner.mutation(api.members.saveStep, { step: 2, revision: 1, values: { ...values, campus: "", studyProgram: "" } })).rejects.toThrow("Lengkapi");
    await expect(owner.mutation(api.members.saveStep, { step: 2, revision: 1, values: { ...values, studyProgram: "x".repeat(151) } })).rejects.toThrow("Lengkapi");
    const saved = await owner.mutation(api.members.saveStep, { step: 2, revision: 1, values: { ...values, campus: "Kampus di luar saran", studyProgram: "Program studi baru" } });
    expect(saved).toMatchObject({ nextStep: 4, campus: "Kampus di luar saran", studyProgram: "Program studi baru" });
  });

  it("makes retries safe and rejects stale edits from another tab", async () => {
    const t = setup(); const owner = await member(t);
    const saved = await owner.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    expect((await owner.mutation(api.members.saveStep, { step: 1, revision: 0, values }))._id).toBe(saved._id);
    await expect(owner.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, fullName: "Versi lama" } })).rejects.toThrow("perangkat lain");
    expect(await t.run((ctx) => ctx.db.query("memberProfiles").collect())).toHaveLength(1);
  });

  it("finishes without claiming external membership and prefills only new appreciation drafts", async () => {
    const owner = await member(setup());
    const oldDraft = await owner.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await onboard(owner);
    const completed = await owner.query(api.members.profile);
    expect(completed?.completedAt).toEqual(expect.any(Number));
    expect(completed).not.toHaveProperty("whatsappJoined");
    expect(completed).not.toHaveProperty("gdgJoined");
    const retried = await owner.mutation(api.members.saveStep, { step: 6, revision: 4, values });
    expect(retried.completedAt).toBe(completed?.completedAt);
    const newDraft = await owner.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    expect((await owner.query(api.appreciations.get, { id: newDraft })).values).toMatchObject({ fullName: values.fullName, campus: values.campus, studyProgram: values.studyProgram, memberType: "Member" });
    expect((await owner.query(api.appreciations.get, { id: oldDraft })).values).toMatchObject({ fullName: "Nama Google", campus: "", studyProgram: "" });
  });
  it("registers a new account as Member with no division", async () => {
    const owner = await member(setup());
    await onboard(owner);
    const profile = await owner.query(api.members.profile);
    expect(profile).toMatchObject({ memberType: "member", nextStep: 6 });
    expect(profile).not.toHaveProperty("division");
    expect(profile).not.toHaveProperty("tagConfirmedAt");
  });

  it("resumes a profile saved on the removed role screen at the WhatsApp screen", async () => {
    const t = setup(); const owner = await member(t);
    for (const step of [1, 2] as const) await owner.mutation(api.members.saveStep, { step, revision: step - 1, values });
    const profile = (await owner.query(api.members.profile))!;
    // Saved before the role screen was removed: waiting on screen 3.
    await t.run((ctx) => ctx.db.patch(profile._id, { nextStep: 3 }));
    await expect(owner.mutation(api.members.saveStep, { step: 5, revision: 2, values })).rejects.toThrow("langkah sebelumnya");
    expect(await owner.mutation(api.members.saveStep, { step: 4, revision: 2, values })).toMatchObject({ nextStep: 5 });
    const atOffer = await owner.mutation(api.members.saveStep, { step: 5, revision: 3, values });
    expect(atOffer).toMatchObject({ nextStep: 6 });
    expect(atOffer.completedAt).toBeUndefined();
    expect(await owner.mutation(api.members.saveStep, { step: 6, revision: 4, values })).toMatchObject({ memberType: "member", completedAt: expect.any(Number) });
  });

  it("stores whether the member studies at a campus or a school, and accepts a page that does not say", async () => {
    const t = setup(); const student = await member(t); const older = await member(t, "older-page@example.com");
    await student.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    const school = { ...values, campus: "SMKN 1 BOGOR", studyProgram: "Rekayasa Perangkat Lunak", institutionKind: "school" as const };
    expect(await student.mutation(api.members.saveStep, { step: 2, revision: 1, values: school })).toMatchObject({ institutionKind: "school", campus: "SMKN 1 BOGOR", nextStep: 4 });
    // Later screens send no kind and keep the saved one; a hand-made kind outside the two is rejected.
    for (const [index, step] of ([4, 5, 6] as const).entries()) await student.mutation(api.members.saveStep, { step, revision: index + 2, values });
    expect(await student.query(api.members.profile)).toMatchObject({ institutionKind: "school", completedAt: expect.any(Number) });
    await expect(older.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, institutionKind: "kantor" } } as never)).rejects.toThrow();
    // A page from before the question (a backend-first deploy) still saves the education screen, with no kind.
    await older.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    expect(await older.mutation(api.members.saveStep, { step: 2, revision: 1, values })).not.toHaveProperty("institutionKind");
  });

  it("offers Tech Support as the last screen: the GDG invitation no longer finishes onboarding", async () => {
    const owner = await member(setup());
    for (const [index, step] of ([1, 2, 4, 5] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index, values });
    expect(await owner.query(api.members.profile)).toMatchObject({ nextStep: 6 });
    expect((await owner.query(api.members.profile))?.completedAt).toBeUndefined();
    await expect(owner.query(api.techSupport.mine, {})).rejects.toThrow("Selesaikan perkenalan");
    await owner.mutation(api.members.saveStep, { step: 6, revision: 4, values });
    expect(await owner.query(api.techSupport.mine, {})).toEqual([]);
  });

  it("rejects a community tag sent with any onboarding screen", async () => {
    const owner = await member(setup());
    const tags = [{ memberType: "core", division: "Technical" }, { memberType: "bod", division: "" }, { memberType: "member", division: "Media & Creative" }];
    // The removed role screen, and every remaining one with tag fields added, as an old tab or a hand-made call would send.
    for (const tag of tags) await expect(owner.mutation(api.members.saveStep, { step: 3, revision: 0, values: { ...values, ...tag } } as never)).rejects.toThrow();
    for (const [index, step] of steps.entries()) {
      for (const tag of tags) await expect(owner.mutation(api.members.saveStep, { step, revision: index, values: { ...values, ...tag } } as never)).rejects.toThrow();
      await owner.mutation(api.members.saveStep, { step, revision: index, values });
    }
    const profile = await owner.query(api.members.profile);
    expect(profile).toMatchObject({ memberType: "member" });
    expect(profile).not.toHaveProperty("division");
  });

  it("never downgrades a tag staff assigned before onboarding finished", async () => {
    const t = setup(); const owner = await member(t);
    for (const [index, step] of ([1, 2, 4] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index, values });
    const profile = (await owner.query(api.members.profile))!;
    await t.run((ctx) => ctx.db.patch(profile._id, { memberType: "core", division: "Media & Creative", tagConfirmedAt: Date.now(), tagConfirmedBy: "staff" }));
    for (const [index, step] of ([5, 6] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index + 3, values });
    expect(await owner.query(api.members.profile)).toMatchObject({ memberType: "core", division: "Media & Creative", tagConfirmedAt: expect.any(Number), completedAt: expect.any(Number) });
  });

  it("gives an untagged account the Member tag and never any other", async () => {
    const t = setup(); const owner = await member(t);
    await expect(owner.mutation(api.members.registerAsMember)).rejects.toThrow("Selesaikan perkenalan");
    await onboard(owner);
    const profile = (await owner.query(api.members.profile))!;
    // Onboarded before community tags existed.
    await t.run((ctx) => ctx.db.patch(profile._id, { memberType: undefined }));
    await owner.mutation(api.members.registerAsMember);
    expect(await owner.query(api.members.profile)).toMatchObject({ memberType: "member" });
    expect(await owner.query(api.members.profile)).not.toHaveProperty("division");
    // A tag already set, by staff or self-declared earlier, stays as it is.
    await t.run((ctx) => ctx.db.patch(profile._id, { memberType: "bod", division: "Technical" }));
    await owner.mutation(api.members.registerAsMember);
    expect(await owner.query(api.members.profile)).toMatchObject({ memberType: "bod", division: "Technical" });
    // The old self-service role mutation is gone.
    await expect(owner.mutation(makeFunctionReference<"mutation">("members:saveRole"), { memberType: "core", division: "Technical" })).rejects.toThrow();
    expect(await owner.query(api.members.profile)).toMatchObject({ memberType: "bod", division: "Technical" });
  });
});
