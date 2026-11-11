/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const values = { fullName: "Teman Pengujian", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "teman.uji" };
const steps = [1, 2, 3, 4, 5, 6] as const;
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
    expect(saved).toMatchObject({ nextStep: 3, campus: "Kampus di luar saran", studyProgram: "Program studi baru" });
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
    const retried = await owner.mutation(api.members.saveStep, { step: 6, revision: 5, values });
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

  it("sends a profile past screen 3 without an Instagram username back to screen 3", async () => {
    const t = setup(); const owner = await member(t);
    for (const step of [1, 2] as const) await owner.mutation(api.members.saveStep, { step, revision: step - 1, values });
    const profile = (await owner.query(api.members.profile))!;
    // Saved before screen 3 asked for Instagram: waiting on the GDG invitation.
    await t.run((ctx) => ctx.db.patch(profile._id, { nextStep: 5 }));
    await expect(owner.mutation(api.members.saveStep, { step: 4, revision: 2, values })).rejects.toThrow("langkah sebelumnya");
    await expect(owner.mutation(api.members.saveStep, { step: 3, revision: 2, values: { ...values, instagram: "" } })).rejects.toThrow("Lengkapi");
    // Then on through the WhatsApp screen again, as the page does.
    expect(await owner.mutation(api.members.saveStep, { step: 3, revision: 2, values })).toMatchObject({ instagram: "teman.uji", nextStep: 4 });
    for (const [index, step] of ([4, 5] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index + 3, values });
    expect((await owner.query(api.members.profile))?.completedAt).toBeUndefined();
    expect(await owner.mutation(api.members.saveStep, { step: 6, revision: 5, values })).toMatchObject({ memberType: "member", completedAt: expect.any(Number) });
  });

  it("stores the Instagram username from screen 3, read from @, a profile link or capitals, and keeps it on later screens", async () => {
    const owner = await member(setup());
    for (const step of [1, 2] as const) await owner.mutation(api.members.saveStep, { step, revision: step - 1, values });
    for (const instagram of ["", "nama kamu!", "nama..kamu", "namakamu.", "a".repeat(31)]) {
      await expect(owner.mutation(api.members.saveStep, { step: 3, revision: 2, values: { ...values, instagram } })).rejects.toThrow("Lengkapi");
    }
    // A page from before the question sends no username, and screen 3 still needs one.
    const older = { fullName: values.fullName, campus: values.campus, studyProgram: values.studyProgram };
    await expect(owner.mutation(api.members.saveStep, { step: 3, revision: 2, values: older })).rejects.toThrow("Lengkapi");
    expect(await owner.mutation(api.members.saveStep, { step: 3, revision: 2, values: { ...values, instagram: " https://www.instagram.com/Nama_Kamu.27/?hl=id " } })).toMatchObject({ instagram: "nama_kamu.27", nextStep: 4 });
    for (const [index, step] of ([4, 5, 6] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index + 3, values: { ...older, instagram: "" } });
    expect(await owner.query(api.members.profile)).toMatchObject({ instagram: "nama_kamu.27", completedAt: expect.any(Number) });
  });

  it("stores whether the member studies at a campus or a school, and accepts a page that does not say", async () => {
    const t = setup(); const student = await member(t); const older = await member(t, "older-page@example.com");
    await student.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    const school = { ...values, campus: "SMKN 1 BOGOR", studyProgram: "Rekayasa Perangkat Lunak", institutionKind: "school" as const };
    expect(await student.mutation(api.members.saveStep, { step: 2, revision: 1, values: school })).toMatchObject({ institutionKind: "school", campus: "SMKN 1 BOGOR", nextStep: 3 });
    // Later screens send no kind and keep the saved one; a hand-made kind outside the two is rejected.
    for (const [index, step] of ([3, 4, 5, 6] as const).entries()) await student.mutation(api.members.saveStep, { step, revision: index + 2, values });
    expect(await student.query(api.members.profile)).toMatchObject({ institutionKind: "school", completedAt: expect.any(Number) });
    await expect(older.mutation(api.members.saveStep, { step: 1, revision: 0, values: { ...values, institutionKind: "kantor" } } as never)).rejects.toThrow();
    // A page from before the question (a backend-first deploy) still saves the education screen, with no kind.
    await older.mutation(api.members.saveStep, { step: 1, revision: 0, values });
    expect(await older.mutation(api.members.saveStep, { step: 2, revision: 1, values })).not.toHaveProperty("institutionKind");
  });

  it("offers Tech Support as the last screen: the GDG invitation no longer finishes onboarding", async () => {
    const owner = await member(setup());
    for (const [index, step] of ([1, 2, 3, 4, 5] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index, values });
    expect(await owner.query(api.members.profile)).toMatchObject({ nextStep: 6 });
    expect((await owner.query(api.members.profile))?.completedAt).toBeUndefined();
    await expect(owner.query(api.techSupport.mine, {})).rejects.toThrow("Selesaikan perkenalan");
    await owner.mutation(api.members.saveStep, { step: 6, revision: 5, values });
    expect(await owner.query(api.techSupport.mine, {})).toEqual([]);
  });

  it("rejects a community tag sent with any onboarding screen", async () => {
    const owner = await member(setup());
    const tags = [{ memberType: "core", division: "Technical" }, { memberType: "bod", division: "" }, { memberType: "member", division: "Media & Creative" }];
    // Every screen with tag fields added, as an old tab from the role screen's days or a hand-made call would send.
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
    for (const [index, step] of ([1, 2, 3, 4] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index, values });
    const profile = (await owner.query(api.members.profile))!;
    await t.run((ctx) => ctx.db.patch(profile._id, { memberType: "core", division: "Media & Creative", tagConfirmedAt: Date.now(), tagConfirmedBy: "staff" }));
    for (const [index, step] of ([5, 6] as const).entries()) await owner.mutation(api.members.saveStep, { step, revision: index + 4, values });
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

describe("editing a completed profile (#235)", () => {
  const edit = { ...values, institutionKind: "campus" as const };
  const read = (t: ReturnType<typeof setup>) => t.run(async (ctx) => (await ctx.db.query("memberProfiles").first())!);

  it("lets a member change their own answers, normalised as onboarding does", async () => {
    const t = setup(); const owner = await member(t);
    await onboard(owner);
    const before = await read(t);
    const saved = await owner.mutation(api.members.updateProfile, { revision: 6, values: {
      fullName: "  Rania   Putri ", institutionKind: "school", campus: " SMKN 1   BOGOR ", studyProgram: "Rekayasa Perangkat Lunak", instagram: " https://www.instagram.com/Rania.Putri/ ",
    } });
    expect(saved).toMatchObject({ fullName: "Rania Putri", institutionKind: "school", campus: "SMKN 1 BOGOR", studyProgram: "Rekayasa Perangkat Lunak", instagram: "rania.putri", revision: 7 });
    // Onboarding's state, the tag and completion stay as they were.
    expect(saved).toMatchObject({ nextStep: 6, memberType: "member", completedAt: before.completedAt });
    expect((await owner.query(api.dashboard.viewer))?.name).toBe("Rania Putri");
    // Only the caller's own profile: there is no owner argument, and no tag or access field.
    for (const extra of [{ ownerId: "someone-else" }, { memberType: "core" }, { role: "admin" }]) {
      await expect(owner.mutation(api.members.updateProfile, { revision: 7, values: edit, ...extra } as never)).rejects.toThrow();
    }
    // saveStep still never changes a completed profile.
    expect(await owner.mutation(api.members.saveStep, { step: 1, revision: 7, values: { ...values, fullName: "Nama Lain" } })).toMatchObject({ fullName: "Rania Putri" });
  });

  it("refuses a stale revision with onboarding's message, but accepts a retry of a save that went through", async () => {
    const t = setup(); const owner = await member(t);
    await onboard(owner);
    const renamed = { ...edit, fullName: "Nama Baru" };
    expect(await owner.mutation(api.members.updateProfile, { revision: 6, values: renamed })).toMatchObject({ revision: 7 });
    expect(await owner.mutation(api.members.updateProfile, { revision: 6, values: renamed })).toMatchObject({ revision: 7, fullName: "Nama Baru" });
    await expect(owner.mutation(api.members.updateProfile, { revision: 6, values: { ...edit, fullName: "Tab Lama" } })).rejects.toThrow("Profil berubah di tab atau perangkat lain");
    expect(await read(t)).toMatchObject({ fullName: "Nama Baru", revision: 7 });
  });

  it("refuses an unfinished profile, a signed-out caller, and answers onboarding would refuse", async () => {
    const t = setup(); const owner = await member(t); const halfway = await member(t, "halfway@example.com");
    await expect(t.mutation(api.members.updateProfile, { revision: 0, values: edit })).rejects.toThrow("Masuk kembali");
    for (const [index, step] of ([1, 2] as const).entries()) await halfway.mutation(api.members.saveStep, { step, revision: index, values });
    await expect(halfway.mutation(api.members.updateProfile, { revision: 2, values: edit })).rejects.toThrow("Selesaikan perkenalan");
    await onboard(owner);
    for (const wrong of [{ fullName: " " }, { campus: "" }, { studyProgram: "x".repeat(151) }, { instagram: "" }, { instagram: "nama..kamu" }, { fullName: "x".repeat(121) }]) {
      await expect(owner.mutation(api.members.updateProfile, { revision: 6, values: { ...edit, ...wrong } }), JSON.stringify(wrong)).rejects.toThrow("Periksa isian");
    }
    await expect(owner.mutation(api.members.updateProfile, { revision: 6, values: { ...edit, institutionKind: "kantor" } } as never)).rejects.toThrow();
    expect(await owner.query(api.members.profile)).toMatchObject({ revision: 6, fullName: values.fullName });
  });

  it("records when the Instagram username changes, and only when it really does", async () => {
    const t = setup(); const owner = await member(t);
    await onboard(owner);
    // Onboarding's first username is not a change.
    expect((await read(t)).instagramChangedAt).toBeUndefined();
    await owner.mutation(api.members.updateProfile, { revision: 6, values: { ...edit, fullName: "Nama Baru" } });
    expect((await read(t)).instagramChangedAt).toBeUndefined();
    // The same username typed with "@" and capitals normalises to the stored one: nothing is written.
    expect(await owner.mutation(api.members.updateProfile, { revision: 7, values: { ...edit, fullName: "Nama Baru", instagram: "@TEMAN.UJI" } })).toMatchObject({ revision: 7 });
    expect((await read(t)).instagramChangedAt).toBeUndefined();
    const changed = await owner.mutation(api.members.updateProfile, { revision: 7, values: { ...edit, fullName: "Nama Baru", instagram: "teman.baru" } });
    expect(changed).toMatchObject({ instagram: "teman.baru", instagramChangedAt: changed.updatedAt });
    await owner.mutation(api.members.updateProfile, { revision: 8, values: { ...edit, fullName: "Nama Lagi", instagram: "teman.baru" } });
    expect((await read(t)).instagramChangedAt).toBe(changed.updatedAt);
    // A profile that finished before the username was asked gets one, which counts as a change.
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("memberProfiles").first())!._id, { instagram: undefined, instagramChangedAt: undefined }));
    expect(await owner.mutation(api.members.updateProfile, { revision: 9, values: { ...edit, fullName: "Nama Lagi", instagram: "teman.baru" } })).toMatchObject({ instagramChangedAt: expect.any(Number) });
  });
});
