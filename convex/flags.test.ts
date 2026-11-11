/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { toJakartaInput } from "../src/lib/assignment";

const modules = import.meta.glob("./**/*.ts");
const hour = 3600000;
const FLAG = "GDGOC{join-discord-2026}";
const points = { maxPoints: "100", minPoints: "20", decrement: "10" };
const task = (extra: object = {}, dueAt = Date.now() + 48 * hour) => ({
  title: "Join Discord", description: "Flag-nya ada di kanal #pengumuman.", dueAt: toJakartaInput(dueAt), audience: ["member" as const], flag: { flag: ` ${FLAG} `, ...points }, ...extra,
});

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, memberType: "member" | "core" = "member") {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: email.split("@")[0], email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 7 * 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: `Nama ${email.split("@")[0]}`, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), completedAt: Date.now(), memberType,
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
async function world(extra: object = {}) {
  const t = setup();
  const owner = await account(t, "owner@example.com");
  const [a, b, c, d] = await Promise.all(["a", "b", "c", "d"].map((name) => account(t, `${name}@example.com`)));
  const id = await owner.mutation(api.assignments.create, { values: task(extra), publish: true });
  return { t, owner, a, b, c, d, id };
}
const solve = (member: Awaited<ReturnType<typeof account>>, assignmentId: Id<"assignments">, flag = FLAG) => member.mutation(api.assignments.submitFlag, { assignmentId, flag });

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("flag tasks in Kelola tugas", () => {
  it("checks the points and the flag, and keeps the flag off the assignment row", async () => {
    const { t, owner, id } = await world();
    for (const flag of [{ ...points, flag: "  " }, { ...points, maxPoints: "10", minPoints: "20" }, { ...points, decrement: "-1" }, { ...points, maxPoints: "99.5" }, { ...points, minPoints: "" }]) {
      await expect(owner.mutation(api.assignments.create, { values: task({ flag: { flag: FLAG, ...flag } }), publish: false })).rejects.toThrow("Lengkapi isian flag");
    }
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({ kind: "flag", maxPoints: 100, minPoints: 20, decrement: 10 });
    expect([row?.maxScore, row?.rubric]).toEqual([undefined, undefined]);
    expect(JSON.stringify(row)).not.toContain(FLAG);
    expect((await owner.query(api.assignments.get, { id }))?.flag).toBe(FLAG);

    // A tab that sends no flag keeps it; a new flag and points apply from then on. The kind never changes.
    await owner.mutation(api.assignments.update, { id, revision: 0, values: { ...task(), flag: undefined, title: "Gabung Discord" } });
    expect((await owner.query(api.assignments.get, { id }))?.flag).toBe(FLAG);
    await owner.mutation(api.assignments.update, { id, revision: 1, values: task({ flag: { flag: "GDGOC{baru}", maxPoints: "50", minPoints: "50", decrement: "0" } }) });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ maxPoints: 50, minPoints: 50, decrement: 0, revision: 2 });
    expect((await owner.query(api.assignments.get, { id }))?.flag).toBe("GDGOC{baru}");
    const hand = await owner.mutation(api.assignments.create, { values: task({ flag: undefined }), publish: false });
    await expect(owner.mutation(api.assignments.update, { id: hand, revision: 0, values: task() })).rejects.toThrow("tidak bisa diubah");
  });

  it("keeps flag tasks out of hand grading, reviewers' queues and the missing list", async () => {
    const { t, owner, a, b, id } = await world();
    await expect(a.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: FLAG, fileIds: [] })).rejects.toThrow("dijawab dengan flag");
    await expect(a.mutation(api.assignments.generateUploadUrl, { assignmentId: id })).rejects.toThrow("dijawab dengan flag");
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "application/pdf" })));
    expect(await a.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "flag.pdf" })).toEqual({ error: "Tugas ini dijawab dengan flag, bukan kiriman." });
    await expect(owner.mutation(api.assignments.setReviewer, { id, ownerId: b.id, reviewer: true })).rejects.toThrow("tidak memakai penilai");
    // A reviewer added before (only possible by hand) still gets no review view.
    await t.run((ctx) => ctx.db.patch(id, { reviewers: [b.id] }));
    expect(await b.query(api.assignments.reviewing)).toEqual([]);
    await expect(b.query(api.assignments.submissions, { id, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow("hanya untuk admin");
    expect(await owner.query(api.assignments.missing, { id })).toEqual({ active: 0, submitted: 0, missing: [] });
  });

  it("can't go back to draft or be deleted once solved, and deleting an unsolved one removes its flag rows", async () => {
    const { t, owner, a, id } = await world();
    const unsolved = await owner.mutation(api.assignments.create, { values: task(), publish: true });
    await solve(a, unsolved, "salah");
    await owner.mutation(api.assignments.remove, { id: unsolved, revision: 0 });
    expect(await t.run(async (ctx) => [...await ctx.db.query("assignmentFlags").collect(), ...await ctx.db.query("flagAttempts").collect()].filter((row) => row.assignmentId === unsolved))).toEqual([]);
    await solve(a, id);
    await expect(owner.mutation(api.assignments.setStatus, { id, revision: 0, status: "draft" })).rejects.toThrow("sudah dipecahkan");
    await expect(owner.mutation(api.assignments.remove, { id, revision: 0 })).rejects.toThrow("sudah dipecahkan");
  });
});

describe("solving a flag task", () => {
  it("locks max(min, max − decrement × earlier solves) for each solver, down to the floor", async () => {
    const { t, owner, a, b, c, d } = await world();
    const id = await owner.mutation(api.assignments.create, { values: task({ flag: { flag: FLAG, maxPoints: "100", minPoints: "20", decrement: "30" } }), publish: true });
    const results = [];
    for (const member of [a, b, c, d]) results.push(await solve(member, id));
    expect(results.map((result) => result.ok && [result.place, result.points])).toEqual([[1, 100], [2, 70], [3, 40], [4, 20]]);
    // Later point changes leave earlier solves as they were.
    await owner.mutation(api.assignments.update, { id, revision: 0, values: task({ flag: { flag: FLAG, maxPoints: "500", minPoints: "0", decrement: "0" } }) });
    expect((await t.run((ctx) => ctx.db.query("flagSolves").collect())).map((row) => row.points)).toEqual([100, 70, 40, 20]);
  });

  it("gives members solving at the same moment different places", async () => {
    const { t, a, b, c, d, id } = await world();
    const results = await Promise.all([a, b, c, d].map((member) => solve(member, id)));
    expect(results.map((result) => result.ok && result.place).sort()).toEqual([1, 2, 3, 4]);
    expect((await t.run((ctx) => ctx.db.query("flagSolves").collect())).map((row) => row.points).sort((x, y) => y - x)).toEqual([100, 90, 80, 70]);
  });

  it("trims the flag, matches case, and refuses a second solve", async () => {
    const { a, b, id } = await world();
    expect(await solve(a, id, FLAG.toLowerCase())).toMatchObject({ ok: false, code: "WRONG", message: "Flag belum tepat." });
    expect(await solve(a, id, `\t${FLAG}  `)).toMatchObject({ ok: true, place: 1, points: 100 });
    await expect(solve(a, id)).rejects.toThrow("sudah memecahkan");
    await expect(solve(a, id, "salah")).rejects.toThrow("sudah memecahkan");
    // Only correct solves lower the value: the wrong try above did not.
    expect(await solve(b, id)).toMatchObject({ ok: true, place: 2, points: 90 });
  });

  it("rate-limits wrong flags per member and task, counts them, and refills a try each minute", async () => {
    const { t, owner, a, b, id } = await world();
    const other = await owner.mutation(api.assignments.create, { values: task(), publish: true });
    vi.useFakeTimers({ now: Date.now() });
    for (const left of [4, 3, 2, 1, 0]) expect(await solve(a, id, "GDGOC{tebak}")).toMatchObject({ ok: false, code: "WRONG", triesLeft: left });
    // With no try left even the right flag is not checked.
    const limited = await solve(a, id);
    expect(limited).toMatchObject({ ok: false, code: "LIMITED" });
    expect(!limited.ok && limited.code === "LIMITED" && limited.retryAt - Date.now()).toBe(60000);
    // Other tasks and other members have their own tries.
    expect(await solve(a, other, "salah")).toMatchObject({ code: "WRONG", triesLeft: 4 });
    expect(await solve(b, id, "salah")).toMatchObject({ code: "WRONG", triesLeft: 4 });
    vi.advanceTimersByTime(60000);
    expect(await solve(a, id, "salah lagi")).toMatchObject({ code: "WRONG", triesLeft: 0 });
    expect(await solve(a, id)).toMatchObject({ code: "LIMITED" });
    vi.advanceTimersByTime(60000);
    expect(await solve(a, id)).toMatchObject({ ok: true, place: 1 });
    const attempts = await t.run((ctx) => ctx.db.query("flagAttempts").collect());
    expect(attempts.find((row) => row.ownerId === a.id && row.assignmentId === id)?.wrong).toBe(6);
    expect(JSON.stringify(attempts)).not.toContain("tebak");
  });

  it("takes flags only while the task is open, before its due date, and for its audience", async () => {
    const { t, owner, a, id } = await world();
    const core = await account(t, "core@example.com", "core");
    await expect(solve(core, id)).rejects.toThrow("Tugas tidak ditemukan");
    await expect(solve(owner, id)).rejects.toThrow("hanya untuk member");
    const draft = await owner.mutation(api.assignments.create, { values: task(), publish: false });
    await expect(solve(a, draft)).rejects.toThrow("Tugas tidak ditemukan");
    const hand = await owner.mutation(api.assignments.create, { values: task({ flag: undefined }), publish: true });
    await expect(solve(a, hand)).rejects.toThrow("Tugas tidak ditemukan");
    await owner.mutation(api.assignments.setStatus, { id, revision: 0, status: "closed" });
    await expect(solve(a, id)).rejects.toThrow("sudah ditutup");
    const due = await owner.mutation(api.assignments.create, { values: task({}, Date.now() + hour), publish: true });
    vi.useFakeTimers({ now: Date.now() + 2 * hour });
    await expect(solve(a, due)).rejects.toThrow("Tenggat tugas ini sudah lewat");
    expect(await t.run((ctx) => ctx.db.query("flagAttempts").collect())).toEqual([]);
  });

  it("never sends the flag to a member", async () => {
    const { a, id } = await world();
    await solve(a, id, "salah");
    const seen = await Promise.all([
      a.query(api.assignments.get, { id }), a.query(api.assignments.list), a.query(api.assignments.reviewing), a.query(api.cohorts.mine),
      a.mutation(api.assignments.submitFlag, { assignmentId: id, flag: "salah lagi" }), a.mutation(api.assignments.submitFlag, { assignmentId: id, flag: FLAG }),
    ]);
    expect(seen[0]).toMatchObject({ flag: null, canManage: false });
    expect(JSON.stringify(seen)).not.toContain(FLAG);
  });
});
