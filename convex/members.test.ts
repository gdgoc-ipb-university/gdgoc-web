/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const values = { fullName: "Teman Pengujian", campus: "IPB University", studyProgram: "Ilmu Komputer" };
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
    for (const step of [1, 2, 3, 4] as const) await owner.mutation(api.members.saveStep, { step, revision: step - 1, values });
    const completed = await owner.query(api.members.profile);
    expect(completed?.completedAt).toEqual(expect.any(Number));
    expect(completed).not.toHaveProperty("whatsappJoined");
    expect(completed).not.toHaveProperty("gdgJoined");
    const retried = await owner.mutation(api.members.saveStep, { step: 4, revision: 3, values });
    expect(retried.completedAt).toBe(completed?.completedAt);
    const newDraft = await owner.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    expect((await owner.query(api.appreciations.get, { id: newDraft })).values).toMatchObject(values);
    expect((await owner.query(api.appreciations.get, { id: oldDraft })).values).toMatchObject({ fullName: "Nama Google", campus: "", studyProgram: "" });
  });
});
