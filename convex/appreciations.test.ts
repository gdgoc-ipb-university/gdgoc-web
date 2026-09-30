/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { chapterPeriod, emptyAppreciation, validateAppreciation } from "../src/lib/appreciation";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 12, cursor: null };
const complete = {
  ...emptyAppreciation, fullName: "Member Pengujian", memberType: "Member", campus: "Kampus Bogor",
  instagram: "member.test", achievement: "Juara 1 UI/UX", eventName: "Kompetisi Pengujian", organizer: "Panitia Pengujian",
  level: "Nasional", participation: "Individu", eventDate: "2026-08-10", story: "Tim membuat rancangan aplikasi untuk pembelajaran.",
  documentationLinks: "https://example.com/dokumentasi", publicationConsent: true,
};

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function user(t: ReturnType<typeof setup>, email = "member@example.com", verified = true, expiresAt = Date.now() + 3600000) {
  const profile = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: "Member Pengujian", email, emailVerified: verified, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: profile._id, token: crypto.randomUUID(), expiresAt, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  return t.withIdentity({ subject: profile._id, sessionId: session._id, email });
}
afterEach(() => vi.unstubAllEnvs());

describe("private appreciation workflow", () => {
  it("offers BoD as the role only to members staff tagged as BoD", async () => {
    const t = setup(); const member = await user(t);
    const first = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    const ownerId = (await member.query(api.appreciations.get, { id: first })).ownerId;
    await member.mutation(api.appreciations.save, { id: first, revision: 0, values: { ...complete, memberType: "BoD" } });
    await expect(member.mutation(api.appreciations.submit, { id: first, revision: 1 })).rejects.toThrow("Lengkapi isian");
    await t.run((ctx) => ctx.db.insert("memberProfiles", { ownerId, fullName: "Member Pengujian", campus: "Kampus Bogor", studyProgram: "", nextStep: 5, revision: 5, updatedAt: Date.now(), completedAt: Date.now(), memberType: "bod" }));
    const second = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    expect((await member.query(api.appreciations.get, { id: second })).values.memberType).toBe("BoD");
    expect(await member.mutation(api.appreciations.submit, { id: first, revision: 1 })).toBe(first);
  });

  it("requires an active verified session, including for guessed record IDs", async () => {
    const t = setup();
    await expect(t.query(api.appreciations.mine, { paginationOpts: page })).rejects.toThrow("Masuk kembali");
    await expect(t.mutation(api.appreciations.create, { clientId: crypto.randomUUID() })).rejects.toThrow("Masuk kembali");
    const unverified = await user(t, "unverified@example.com", false);
    const expired = await user(t, "expired@example.com", true, Date.now() - 1);
    await expect(unverified.mutation(api.appreciations.create, { clientId: crypto.randomUUID() })).rejects.toThrow("Masuk kembali");
    await expect(expired.query(api.appreciations.mine, { paginationOpts: page })).rejects.toThrow("Masuk kembali");
  });

  it("saves partial drafts, restores them, and creates only one draft for a retried request", async () => {
    const t = setup(); const member = await user(t); const clientId = crypto.randomUUID();
    const id = await member.mutation(api.appreciations.create, { clientId });
    expect(await member.mutation(api.appreciations.create, { clientId })).toBe(id);
    const values = { ...emptyAppreciation, achievement: "Belum selesai", story: "Paragraf pertama" };
    const saved = await member.mutation(api.appreciations.save, { id, revision: 0, values });
    expect(saved.revision).toBe(1);
    expect((await member.query(api.appreciations.get, { id })).values).toEqual(values);
    expect((await member.query(api.appreciations.mine, { paginationOpts: page })).page).toHaveLength(1);
    await expect(member.mutation(api.appreciations.submit, { id, revision: 1 })).rejects.toThrow("Lengkapi isian");
  });

  it("prevents other members from reading, editing, submitting, deleting, or reviewing a draft", async () => {
    const t = setup(); const owner = await user(t); const other = await user(t, "other@example.com");
    const id = await owner.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    expect((await other.query(api.appreciations.mine, { paginationOpts: page })).page).toEqual([]);
    await expect(other.query(api.appreciations.get, { id })).rejects.toThrow("tidak ditemukan");
    await expect(other.mutation(api.appreciations.save, { id, revision: 0, values: complete })).rejects.toThrow("tidak ditemukan");
    await expect(other.mutation(api.appreciations.submit, { id, revision: 0 })).rejects.toThrow("tidak ditemukan");
    await expect(other.mutation(api.appreciations.removeDraft, { id, revision: 0 })).rejects.toThrow("tidak ditemukan");
    await expect(other.query(api.appreciations.queue, { status: "submitted", paginationOpts: page })).rejects.toThrow("tim peninjau");
    await expect(other.mutation(api.appreciations.review, { id, revision: 0, status: "published", note: "", postUrl: "https://www.instagram.com/p/test/" })).rejects.toThrow("tim peninjau");
  });

  it("rejects stale overwrites but accepts an identical transport retry", async () => {
    const member = await user(setup());
    const id = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await member.mutation(api.appreciations.save, { id, revision: 0, values: complete });
    expect((await member.mutation(api.appreciations.save, { id, revision: 0, values: complete })).revision).toBe(1);
    await expect(member.mutation(api.appreciations.save, { id, revision: 0, values: { ...complete, story: "Overwrite" } })).rejects.toThrow("perangkat lain");
    await expect(member.mutation(api.appreciations.removeDraft, { id, revision: 0 })).rejects.toThrow("perangkat lain");
    expect((await member.query(api.appreciations.get, { id })).values.story).toBe(complete.story);
  });

  it("validates submissions on the server, locks sent content, and makes repeated submits idempotent", async () => {
    const member = await user(setup());
    const id = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await member.mutation(api.appreciations.save, { id, revision: 0, values: { ...complete, documentationLinks: "javascript:alert(1)" } });
    await expect(member.mutation(api.appreciations.submit, { id, revision: 1 })).rejects.toThrow("Lengkapi isian");
    await member.mutation(api.appreciations.save, { id, revision: 1, values: complete });
    expect(await member.mutation(api.appreciations.submit, { id, revision: 2 })).toBe(id);
    expect(await member.mutation(api.appreciations.submit, { id, revision: 2 })).toBe(id);
    const doc = await member.query(api.appreciations.get, { id });
    expect(doc.status).toBe("submitted"); expect(doc.revision).toBe(3);
    await expect(member.mutation(api.appreciations.save, { id, revision: 3, values: complete })).rejects.toThrow("sudah terkirim");
    await expect(member.mutation(api.appreciations.removeDraft, { id, revision: 3 })).rejects.toThrow("Hanya draft");
  });

  it("supports restricted review, a revision round, and a verified Instagram publication link", async () => {
    vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "editor@example.com");
    const t = setup(); const member = await user(t); const admin = await user(t, "editor@example.com");
    const id = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    expect((await admin.query(api.appreciations.queue, { status: "submitted", paginationOpts: page })).page).toEqual([]);
    await expect(admin.query(api.appreciations.get, { id })).rejects.toThrow("tidak ditemukan");
    await member.mutation(api.appreciations.save, { id, revision: 0, values: complete });
    await member.mutation(api.appreciations.submit, { id, revision: 1 });
    expect((await admin.query(api.appreciations.queue, { status: "submitted", paginationOpts: page })).page).toHaveLength(1);
    await expect(admin.mutation(api.appreciations.review, { id, revision: 2, status: "revision", note: "", postUrl: "" })).rejects.toThrow("Jelaskan");
    await admin.mutation(api.appreciations.review, { id, revision: 2, status: "revision", note: "Tambahkan foto tim.", postUrl: "" });
    expect((await member.query(api.appreciations.get, { id })).reviewNote).toBe("Tambahkan foto tim.");
    await member.mutation(api.appreciations.save, { id, revision: 3, values: { ...complete, documentationLinks: "https://example.com/dokumentasi\nhttps://example.com/foto" } });
    await member.mutation(api.appreciations.submit, { id, revision: 4 });
    await expect(admin.mutation(api.appreciations.review, { id, revision: 5, status: "published", note: "", postUrl: "https://example.com/" })).rejects.toThrow("Instagram");
    await admin.mutation(api.appreciations.review, { id, revision: 5, status: "published", note: "Sudah terbit.", postUrl: "https://www.instagram.com/p/test-post/" });
    const doc = await member.query(api.appreciations.get, { id });
    expect(doc.status).toBe("published"); expect(doc.postUrl).toContain("instagram.com/p/");
    expect(await t.run((ctx) => ctx.db.query("appreciationReviews").collect())).toHaveLength(2);
  });

  it("rejects oversized draft payloads and limits unfinished drafts per member", async () => {
    const member = await user(setup());
    const id = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await expect(member.mutation(api.appreciations.save, { id, revision: 0, values: { ...complete, story: "x".repeat(2401) } })).rejects.toThrow("terlalu panjang");
    for (let i = 1; i < 10; i++) await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await expect(member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() })).rejects.toThrow("10 draft");
    await member.mutation(api.appreciations.removeDraft, { id, revision: 0 });
    expect((await member.query(api.appreciations.mine, { paginationOpts: page })).page).toHaveLength(9);
  });
});

describe("publication validation", () => {
  it("accepts a complete story and validates teams, consent, real dates, and public https links", () => {
    expect(validateAppreciation(complete, new Date("2026-09-24"))).toEqual({});
    const errors = validateAppreciation({ ...complete, participation: "Tim", eventDate: "2026-02-30", instagram: "https://instagram.com/test", publicationConsent: false, documentationLinks: "https://user:password@example.com/doc" });
    for (const key of ["teamName", "teamMembers", "eventDate", "instagram", "publicationConsent", "documentationLinks"]) expect(errors).toHaveProperty(key);
    expect(validateAppreciation({ ...complete, eventDate: "2099-01-01" })).toHaveProperty("eventDate");
    expect(validateAppreciation({ ...complete, documentationLinks: "https://127.0.0.1/doc" })).toHaveProperty("documentationLinks");
  });

  it("accepts only achievements announced in the current chapter year, 1 July 2026 to 1 July 2027 inclusive", () => {
    const after = new Date("2027-08-15T00:00:00+07:00");
    const period = /dalam periode GDGoC IPB 1 Juli 2026 – 1 Juli 2027/;
    expect(chapterPeriod).toMatchObject({ start: "2026-07-01", end: "2027-07-01" });
    for (const eventDate of ["2026-07-01", "2027-01-15", "2027-07-01"]) expect(validateAppreciation({ ...complete, eventDate }, after)).toEqual({});
    for (const eventDate of ["2026-06-30", "2025-12-01", "2027-07-02", "2028-01-01"]) expect(validateAppreciation({ ...complete, eventDate }, after).eventDate).toMatch(period);
    // Inside the period but not yet announced: the older "already happened" rule still applies.
    expect(validateAppreciation({ ...complete, eventDate: "2026-12-01" }, new Date("2026-09-30T12:00:00+07:00")).eventDate).toBe("Pilih tanggal pengumuman prestasi yang sudah berlangsung.");
    // Today counts in Bogor time: 30 September 23:30 WIB is still the 30th there.
    expect(validateAppreciation({ ...complete, eventDate: "2026-09-30" }, new Date("2026-09-30T16:30:00Z"))).toEqual({});
  });

  it("refuses a submission from outside the chapter year on the server", async () => {
    const member = await user(setup());
    const id = await member.mutation(api.appreciations.create, { clientId: crypto.randomUUID() });
    await member.mutation(api.appreciations.save, { id, revision: 0, values: { ...complete, eventDate: "2026-06-30" } });
    await expect(member.mutation(api.appreciations.submit, { id, revision: 1 })).rejects.toThrow("Lengkapi isian");
    await member.mutation(api.appreciations.save, { id, revision: 1, values: complete });
    expect(await member.mutation(api.appreciations.submit, { id, revision: 2 })).toBe(id);
  });
});
