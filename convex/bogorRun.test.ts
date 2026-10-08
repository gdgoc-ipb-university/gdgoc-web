/// <reference types="vite/client" />
import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { fromBase64Url, signToken, toBase64Url, verifyToken } from "./bogorRunToken";
import { ENGINE_VERSION, LIMITS, TICK_RATE, applyInput, autopilot, scoreOf, startRun, step } from "../src/lib/bogor-run/engine";
import { BOARD_SIZE, LEADERBOARD_SIZE, RANK_CAP, packInputs, weekKey } from "../src/lib/bogor-run/leaderboard";
import { RUN_RETENTION } from "./bogorRun";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "rahasia-pengujian-bogor-run";
const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 30, 3); // Wednesday 30 Sep 2026, 10:00 WIB.
type Test = ReturnType<typeof setup>;
type Played = { inputs: number[]; endTick: number; score: number };
type Issued = { token: string; seed: number; issuedAt: number };

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function account(t: Test, email: string, { name = "Teman Main", profile = true, verified = true } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: verified, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  // Sessions outlive the fake clock's jumps.
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 1000 * 24 * HOUR, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  if (profile) await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer", nextStep: 4, revision: 4, updatedAt: Date.now(), completedAt: Date.now(),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string, email });
}

/** Plays `seed` with the demo autopilot for `autoSeconds`, then lets the dino run into whatever comes next (or to the finish line). */
function play(seed: number, autoSeconds = 0): Played {
  const run = startRun(seed), inputs: number[] = [];
  while (run.phase === "running") {
    if (run.tick < autoSeconds * TICK_RATE) for (const code of autopilot(run)) if (applyInput(run, code)) inputs.push(run.tick, code);
    step(run);
  }
  return { inputs, endTick: run.tick, score: scoreOf(run) };
}
const simMs = (played: Played) => played.endTick / TICK_RATE * 1000;
async function issue(t: Test, at = Date.now()) {
  vi.setSystemTime(at);
  const ticket = await t.mutation(api.bogorRun.issueRun, { engine: ENGINE_VERSION });
  if (!ticket || "outdated" in ticket) throw new Error("no ticket");
  return ticket;
}
async function promote(t: Test, ownerId: string) {
  await t.run(async (ctx) => {
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
    await ctx.db.patch(profile!._id, { role: "admin" });
  });
}
const players = (t: Test) => t.run((ctx) => ctx.db.query("gamePlayers").collect());
async function tokenFor(seed: number, issuedAt = Date.now()) {
  return { token: (await signToken({ v: 2, engine: ENGINE_VERSION, seed, issuedAt, nonce: crypto.randomUUID().replaceAll("-", "") }, SECRET))!, seed, issuedAt };
}
/** Submits after exactly the real time the run needed, plus `lag`. */
async function submit(user: Pick<Test, "mutation">, issued: Issued, played: Played, { lag = 2000, ...override }: { lag?: number; inputs?: number[] | string; endTick?: number; score?: number } = {}) {
  vi.setSystemTime(issued.issuedAt + simMs(played) + lag);
  return user.mutation(api.bogorRun.submitRun, { token: issued.token, inputs: played.inputs, endTick: played.endTick, score: played.score, ...override });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Bogor Run tokens", () => {
  it("issues a fresh signed seed per call, and none without a secret", async () => {
    const t = setup();
    const first = await issue(t), second = await issue(t);
    expect(first).toMatchObject({ issuedAt: T0, seed: expect.any(Number) });
    expect(Number.isInteger(first.seed) && first.seed >= 0 && first.seed <= 0xffffffff).toBe(true);
    expect(first.token).not.toBe(second.token);
    expect(await verifyToken(first.token)).toEqual({ v: 2, engine: ENGINE_VERSION, seed: first.seed, issuedAt: T0, nonce: expect.stringMatching(/^[\w-]{22}$/) });
    expect(await t.run(async (ctx) => (await ctx.db.query("gameRuns").collect()).length)).toBe(0);
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(await t.mutation(api.bogorRun.issueRun, { engine: ENGINE_VERSION })).toBeNull();
  });

  it("issues tickets only for this engine version", async () => {
    const t = setup();
    expect(await t.mutation(api.bogorRun.issueRun, { engine: ENGINE_VERSION + 1 })).toEqual({ outdated: true });
    expect(await t.mutation(api.bogorRun.issueRun, { engine: ENGINE_VERSION - 1 })).toEqual({ outdated: true });
    // Clients from before the engine version send none: they ran engine 1, which this still is.
    // Past engine 1 they get null and keep playing unranked, as they would without a secret.
    const legacy = await t.mutation(api.bogorRun.issueRun, {});
    const token = legacy && "token" in legacy ? legacy.token : undefined;
    expect(token ? (await verifyToken(token))?.engine : null).toBe(ENGINE_VERSION === 1 ? 1 : null);
  });

  it("signs with HMAC-SHA256 under a key derived from the auth secret", async () => {
    const { token } = await tokenFor(7);
    const [body, sig] = token.split(".");
    const key = createHmac("sha256", SECRET).update("gdgoc:bogor-run:token:v1").digest();
    expect(createHmac("sha256", key).update(body).digest("base64url")).toBe(sig);
    expect(await verifyToken(token, "rahasia-lain")).toBeNull();
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    for (let n = 0; n <= bytes.length; n++) expect(fromBase64Url(toBase64Url(bytes.slice(0, n)))).toEqual(bytes.slice(0, n));
    expect(fromBase64Url("AB")).toBeNull(); // Non-zero padding bits: a second spelling of the same byte.
    expect(fromBase64Url("A")).toBeNull();
    expect(fromBase64Url("AA==")).toBeNull();
  });
});

describe("Bogor Run score submission", () => {
  it("accepts a replayed run and reports the player's standing", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com", { name: "Rania Putri" });
    const issued = await issue(t);
    const played = play(issued.seed, 20);
    expect(played.score).toBeGreaterThan(300);
    const saved = await submit(rania, issued, played);
    expect(saved).toEqual({
      ok: true, score: played.score,
      week: { key: "2026-09-28", best: played.score, rank: 1, improved: true },
      all: { best: played.score, rank: 1, improved: true },
    });
    const board = await rania.query(api.bogorRun.leaderboard, { period: "week" });
    expect(board).toEqual({
      key: "2026-09-28", signedIn: true, you: { rank: 1, score: played.score, hidden: false },
      entries: [{ id: expect.any(String), rank: 1, name: "Rania P.", score: played.score, you: true }],
    });
    expect(await t.query(api.bogorRun.leaderboard, { period: "all" })).toMatchObject({ key: "all", signedIn: false, you: null, entries: [{ name: "Rania P.", you: false }] });
    expect(await t.run((ctx) => ctx.db.query("gameRuns").collect())).toMatchObject([{ ownerId: rania.id, seed: issued.seed, issuedAt: T0, score: played.score, week: "2026-09-28" }]);
  });

  it("accepts long logs packed into a string", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const issued = await issue(t), played = play(issued.seed, 30);
    expect(await submit(rania, issued, played, { inputs: packInputs(played.inputs) })).toMatchObject({ ok: true, score: played.score });
    const next = await issue(t, Date.now()), other = play(next.seed, 5);
    expect(await submit(rania, next, other, { inputs: `${packInputs(other.inputs)},-11` })).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("rejects forged and tampered tokens", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const issued = await issue(t), played = play(issued.seed);
    const [body, sig] = issued.token.split(".");
    const claim = JSON.parse(new TextDecoder().decode(fromBase64Url(body)!));
    const encode = (value: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
    const forged = [
      "", "abc", ".", `${body}.`, `.${sig}`, `${body}.${sig}.${sig}`, `${body}.${sig}=`, `${body}.${sig}AAAA`, `${body} .${sig}`, `${body}.${sig.slice(0, -1)}`,
      `${encode({ ...claim, seed: claim.seed ^ 1 })}.${sig}`, // Another seed under the original signature.
      `${body}.${sig.slice(0, -2)}${sig.at(-2) === "A" ? "B" : "A"}${sig.at(-1)}`,
      (await signToken(claim, "rahasia-lain"))!,
      (await signToken({ ...claim, v: 3 } as never, SECRET))!,
      (await signToken({ ...claim, v: 1 } as never, SECRET))!, // v1 tokens carry no engine
      (await signToken({ v: 2, seed: claim.seed, issuedAt: claim.issuedAt, nonce: claim.nonce, extra: 1 } as never, SECRET))!,
      (await signToken({ ...claim, engine: 0 }, SECRET))!,
      (await signToken({ ...claim, engine: 1.5 }, SECRET))!,
      (await signToken({ ...claim, engine: "1" } as never, SECRET))!,
      (await signToken({ ...claim, admin: true } as never, SECRET))!,
      (await signToken({ ...claim, seed: -1 }, SECRET))!,
      (await signToken({ ...claim, seed: 1.5 }, SECRET))!,
      (await signToken({ ...claim, issuedAt: "0" } as never, SECRET))!,
      (await signToken({ ...claim, nonce: "pendek" }, SECRET))!,
      `${body}.${sig}`.padEnd(300, "A"),
    ];
    for (const token of forged) expect(await submit(rania, { ...issued, token }, played), token).toMatchObject({ ok: false, code: "INVALID" });
    expect(await submit(rania, issued, played)).toMatchObject({ ok: true });
  });

  it("accepts tokens issued before engine versions as engine 1, and turns other engines away as OUTDATED", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const nonce = () => crypto.randomUUID().replaceAll("-", "");
    const legacy = { token: (await signToken({ v: 1, seed: 11, issuedAt: Date.now(), nonce: nonce() } as never, SECRET))!, seed: 11, issuedAt: Date.now() };
    const played = play(11, 10);
    expect(await submit(rania, legacy, played)).toMatchObject(ENGINE_VERSION === 1 ? { ok: true, score: played.score } : { ok: false, code: "OUTDATED" });
    const other = { token: (await signToken({ v: 2, engine: ENGINE_VERSION + 1, seed: 12, issuedAt: Date.now(), nonce: nonce() }, SECRET))!, seed: 12, issuedAt: Date.now() };
    const stale = play(12, 10);
    expect(await submit(rania, other, stale)).toEqual({ ok: false, code: "OUTDATED", message: expect.stringContaining("Muat ulang") });
    expect(await t.run(async (ctx) => (await ctx.db.query("gameRuns").collect()).length)).toBe(ENGINE_VERSION === 1 ? 1 : 0);
  });

  it("rejects edited inputs, scores, and end ticks without burning the run", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const issued = await tokenFor(5), played = play(5, 20);
    const { inputs, endTick, score } = played;
    const edits: { inputs?: number[]; endTick?: number; score?: number }[] = [
      { score: score + 1 }, { score: score - 1 }, { score: -1 }, { score: 1.5 }, { score: NaN }, { score: Infinity },
      { endTick: endTick + 1 }, { endTick: endTick - 1 }, { endTick: 0 }, { endTick: -5 }, { endTick: endTick + 0.5 }, { endTick: NaN }, { endTick: 432_001 }, { endTick: 1e12 },
      { inputs: inputs.slice(0, -2) }, { inputs: inputs.slice(2) }, { inputs: [...inputs, endTick - 1] }, { inputs: [...inputs, endTick, 1] },
      { inputs: inputs.map((value, i) => (i === 1 ? 4 : value)) }, { inputs: inputs.map((value, i) => (i === 0 ? -1 : value)) },
      { inputs: inputs.map((value, i) => (i === 2 ? value + 0.5 : value)) }, { inputs: inputs.map((value, i) => (i === 2 ? NaN : value)) },
      { inputs: [inputs[2], inputs[3], inputs[0], inputs[1], ...inputs.slice(4)] }, { inputs: [] },
    ];
    for (const edit of edits) expect(await submit(rania, issued, played, edit), JSON.stringify(edit)).toMatchObject({ ok: false, code: "INVALID" });
    // A score that came from the right seed but a different, longer run still has to be the one claimed.
    const longer = play(5, 25);
    expect(await submit(rania, issued, longer, { score: score })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await t.run((ctx) => ctx.db.query("gameRuns").collect())).toEqual([]);
    expect(await submit(rania, issued, played)).toMatchObject({ ok: true, score });
  });

  it("rejects runs saved faster than they could be played, and stale ones", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const issued = await issue(t), played = play(issued.seed, 20), ms = simMs(played);
    expect(await submit(rania, issued, played, { lag: -ms })).toMatchObject({ ok: false, code: "TOO_EARLY" });
    expect(await submit(rania, issued, played, { lag: -0.03 * ms - 1001 })).toMatchObject({ ok: false, code: "TOO_EARLY" });
    expect(await submit(rania, issued, played, { lag: 12 * HOUR + 1 })).toMatchObject({ ok: false, code: "EXPIRED" });
    expect(await submit(rania, issued, played, { lag: -0.03 * ms - 999 })).toMatchObject({ ok: true });
    const late = await issue(t, T0 + HOUR);
    expect(await submit(rania, late, play(late.seed), { lag: 12 * HOUR })).toMatchObject({ ok: true });
  });

  it("makes each run single-use: idempotent for its owner, USED for anyone else", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com"), bima = await account(t, "bima@example.com");
    const issued = await issue(t), played = play(issued.seed, 20);
    const first = await submit(rania, issued, played);
    expect(await submit(rania, issued, played, { lag: 60_000 })).toEqual(first);
    expect(await submit(rania, issued, played, { score: 999_999, lag: 20 * HOUR })).toEqual(first);
    expect(await submit(bima, issued, played)).toEqual({ ok: false, code: "USED", message: expect.stringContaining("akun lain") });
    expect(await t.run((ctx) => ctx.db.query("gameRuns").collect())).toHaveLength(1);
    expect((await rania.query(api.bogorRun.leaderboard, { period: "all" })).entries).toHaveLength(1);
  });

  it("requires a signed-in, active account", async () => {
    const t = setup();
    const issued = await issue(t), played = play(issued.seed);
    expect(await submit(t, issued, played)).toMatchObject({ ok: false, code: "UNAUTHENTICATED", message: expect.stringContaining("Masuk") });
    expect(await submit(await account(t, "unverified@example.com", { verified: false }), issued, played)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    const inactive = await account(t, "inactive@example.com"), owner = await account(t, "owner@example.com");
    await t.run(async (ctx) => {
      for (const profile of await ctx.db.query("memberProfiles").collect()) await ctx.db.patch(profile._id, { deactivatedAt: Date.now() });
    });
    expect(await submit(inactive, issued, played)).toMatchObject({ ok: false, code: "DEACTIVATED" });
    expect(await submit(owner, issued, played)).toMatchObject({ ok: true }); // Owners are never deactivated.
    const google = await account(t, "baru@example.com", { name: "Pengunjung Baru Sekali", profile: false });
    const next = await tokenFor(9, Date.now());
    expect(await submit(google, next, play(9))).toMatchObject({ ok: true });
    expect((await t.query(api.bogorRun.leaderboard, { period: "all" })).entries.map((entry) => entry.name)).toContain("Pengunjung S.");
  });
});

describe("Bogor Run standings", () => {
  it("keeps only improving bests, per week and all time, with the week taken from the token", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com", { name: "Rania Putri" });
    const sunday = Date.UTC(2026, 9, 4, 16, 58); // Sunday 4 Oct, 23:58 WIB: the run ends after Monday begins.
    const high = await tokenFor(11, sunday), highRun = play(11, 30);
    expect(await submit(rania, high, highRun, { lag: 5 * 60_000 })).toMatchObject({ week: { key: "2026-09-28", improved: true }, all: { improved: true } });
    expect(weekKey(Date.now())).toBe("2026-10-05");

    const low = await tokenFor(12, Date.now()), lowRun = play(12);
    expect(lowRun.score).toBeLessThan(highRun.score);
    expect(await submit(rania, low, lowRun)).toEqual({
      ok: true, score: lowRun.score,
      week: { key: "2026-10-05", best: lowRun.score, rank: 1, improved: true },
      all: { best: highRun.score, rank: 1, improved: false },
    });
    const same = await tokenFor(12, Date.now());
    expect(await submit(rania, same, lowRun)).toMatchObject({ week: { best: lowRun.score, improved: false }, all: { improved: false } });

    await t.run(async (ctx) => {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", rania.id)).unique();
      await ctx.db.patch(profile!._id, { fullName: "Rania Kusuma" });
    });
    const better = await tokenFor(13, Date.now()), betterRun = play(13, 45);
    expect(betterRun.score).toBeGreaterThan(highRun.score);
    expect(await submit(rania, better, betterRun)).toMatchObject({ week: { best: betterRun.score, improved: true }, all: { best: betterRun.score, improved: true } });

    const lastWeek = await rania.query(api.bogorRun.leaderboard, { period: "week", week: "2026-09-28" });
    expect(lastWeek.entries).toEqual([{ id: expect.any(String), rank: 1, name: "Rania P.", score: highRun.score, you: true }]);
    const thisWeek = await rania.query(api.bogorRun.leaderboard, { period: "week" });
    expect(thisWeek).toMatchObject({ key: "2026-10-05", entries: [{ name: "Rania K.", score: betterRun.score }] });
    expect((await rania.query(api.bogorRun.board, { period: "week" })).stats).toEqual({ players: 1, runs: 3 });
    expect((await rania.query(api.bogorRun.board, { period: "all" })).stats).toEqual({ players: 1, runs: 4 });
    await expect(rania.query(api.bogorRun.leaderboard, { period: "week", week: "2026-10-06" })).rejects.toThrow("tidak valid");
    expect((await rania.query(api.bogorRun.leaderboard, { period: "all", week: "bukan" })).key).toBe("all");
  });

  it("ranks ties together, earliest first, and hides moderated players from the public", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik Situs" });
    const bima = await account(t, "bima@example.com", { name: "Bima Sakti" });
    const rania = await account(t, "rania@example.com", { name: "Rania Putri" });
    const cici = await account(t, "cici@example.com", { name: "Cici Lestari" });
    const tie = play(21);
    await submit(bima, await tokenFor(21, Date.now()), tie);
    await submit(rania, await tokenFor(21, Date.now()), tie);
    const topRun = play(22, 20);
    await submit(cici, await tokenFor(22, Date.now()), topRun);

    const ranks = (board: { entries: { name: string; rank: number | null }[] }) => board.entries.map(({ name, rank }) => [name, rank]);
    expect(ranks(await t.query(api.bogorRun.leaderboard, { period: "week" }))).toEqual([["Cici L.", 1], ["Bima S.", 2], ["Rania P.", 2]]);
    const hideCici = (await owner.query(api.bogorRun.board, { period: "week" })).entries[0];
    await expect(bima.mutation(api.bogorRun.setHidden, { entryId: hideCici.id, hidden: true })).rejects.toThrow("hanya untuk admin");
    await owner.mutation(api.bogorRun.setHidden, { entryId: hideCici.id, hidden: true });

    expect(ranks(await t.query(api.bogorRun.leaderboard, { period: "week" }))).toEqual([["Bima S.", 1], ["Rania P.", 1]]);
    expect(ranks(await t.query(api.bogorRun.leaderboard, { period: "all" }))).toEqual([["Bima S.", 1], ["Rania P.", 1]]);
    expect((await cici.query(api.bogorRun.leaderboard, { period: "week" })).you).toEqual({ rank: null, score: topRun.score, hidden: true });
    const staffView = await owner.query(api.bogorRun.board, { period: "week" });
    expect(staffView).toMatchObject({ canModerate: true, stats: { players: 3, runs: 3 }, you: null });
    expect(staffView.entries.map(({ name, rank, hidden, canHide }) => [name, rank, hidden, canHide])).toEqual([["Bima S.", 1, false, true], ["Rania P.", 1, false, true]]);
    expect(staffView.hiddenEntries).toEqual([{
      id: hideCici.id, rank: null, name: "Cici L.", score: topRun.score, achievedAt: expect.any(Number), hidden: true, you: false,
      hiddenAt: expect.any(Number), hiddenBy: "Pemilik S.", hiddenByRole: "owner", inactive: false, canRestore: true,
    }]);
    const memberView = await bima.query(api.bogorRun.board, { period: "week" });
    expect(memberView).toMatchObject({ canModerate: false, you: { rank: 1, score: tie.score, hidden: false }, hiddenEntries: [] });
    expect(memberView.entries.map(({ name }) => name)).toEqual(["Bima S.", "Rania P."]);
    expect(memberView.entries[0]).toEqual({ id: expect.any(String), rank: 1, name: "Bima S.", score: tie.score, achievedAt: expect.any(Number), hidden: false, you: true, canHide: false });

    // Moderation sticks to the player: a later best stays hidden until staff restore it.
    const again = await submit(cici, await tokenFor(23, Date.now()), play(23, 25));
    expect(again).toMatchObject({ ok: true, week: { rank: null }, all: { rank: null } });
    expect(ranks(await t.query(api.bogorRun.leaderboard, { period: "week" }))).toEqual([["Bima S.", 1], ["Rania P.", 1]]);
    await owner.mutation(api.bogorRun.setHidden, { entryId: hideCici.id, hidden: false });
    expect(ranks(await t.query(api.bogorRun.leaderboard, { period: "all" }))).toEqual([["Cici L.", 1], ["Bima S.", 2], ["Rania P.", 2]]);
    // The audit keeps who hid the player and who brought them back.
    const [record] = await players(t);
    expect(record).toMatchObject({ ownerId: cici.id, hiddenBy: owner.id, hiddenByRole: "owner", restoredBy: owner.id, restoredAt: expect.any(Number) });
    expect(record.hiddenAt).toBeUndefined();
    await expect(t.query(api.bogorRun.board, { period: "all" })).rejects.toThrow("Masuk kembali");
  });

  it("orders ties at the cut by who got there first and caps rank counting", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    await t.run(async (ctx) => {
      const best = (ownerId: string, score: number, achievedAt: number) => ctx.db.insert("gameBests", { ownerId, period: "all", score, name: ownerId, achievedAt, hidden: false });
      for (let i = 0; i < LEADERBOARD_SIZE - 1; i++) await best(`atas-${i}`, 1000 + i, T0);
      // The oldest row reached 500 first, though the index lists the newest first among equal scores.
      for (let i = 0; i < 3; i++) await best(`seri-${i}`, 500, T0 + i);
    });
    const top = await t.query(api.bogorRun.leaderboard, { period: "all" });
    expect(top.entries).toHaveLength(LEADERBOARD_SIZE);
    expect(top.entries.at(-1)).toMatchObject({ name: "seri-0", rank: LEADERBOARD_SIZE });

    await t.run(async (ctx) => {
      for (let i = 0; i < RANK_CAP; i++) await ctx.db.insert("gameBests", { ownerId: `ramai-${i}`, period: "all", score: 400, name: "Ramai", achievedAt: T0, hidden: false });
    });
    const run = play(31);
    expect(run.score).toBeLessThan(400);
    expect(await submit(rania, await tokenFor(31, Date.now()), run)).toMatchObject({ all: { rank: null } });
    expect((await rania.query(api.bogorRun.leaderboard, { period: "all" })).you).toEqual({ rank: null, score: run.score, hidden: false });
  });

  it("never exposes owner ids or emails", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik Situs" });
    const rania = await account(t, "rania@example.com", { name: "Rania Putri" });
    await submit(rania, await tokenFor(41, Date.now()), play(41));
    await submit(owner, await tokenFor(42, Date.now()), play(42));
    const views = [
      await t.query(api.bogorRun.leaderboard, { period: "week" }), await rania.query(api.bogorRun.leaderboard, { period: "all" }),
      await owner.query(api.bogorRun.board, { period: "week" }), await rania.query(api.bogorRun.board, { period: "all" }),
    ];
    const text = JSON.stringify(views);
    for (const secret of [owner.id, rania.id, owner.email, rania.email, "ownerId", "@", "Putri"]) expect(text).not.toContain(secret);
  });
});

describe("Bogor Run finish line", () => {
  it("saves a run that reaches the hour as finished, after the full hour has passed", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com", { name: "Rania Putri" }), bima = await account(t, "bima@example.com", { name: "Bima Sakti" });
    const issued = await issue(t), hour = play(issued.seed, 3700);
    expect(hour.endTick).toBe(LIMITS.maxTicks);
    const ms = simMs(hour);
    expect(await submit(rania, issued, hour, { lag: -0.03 * ms - 1001 })).toMatchObject({ ok: false, code: "TOO_EARLY" });
    expect(await submit(rania, issued, hour, { score: hour.score + 1 })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await submit(rania, issued, hour, { inputs: hour.inputs.slice(0, -40) })).toMatchObject({ ok: false, code: "INVALID" }); // Crashes before the line.
    expect(await submit(rania, issued, hour, { inputs: packInputs(hour.inputs) })).toEqual({
      ok: true, score: hour.score, week: { key: "2026-09-28", best: hour.score, rank: 1, improved: true }, all: { best: hour.score, rank: 1, improved: true },
    });
    // Every finished run scores the same, so the one who finished first stays on top.
    const second = await issue(t, T0 + 60_000), again = play(second.seed, 3700);
    expect(again.score).toBe(hour.score);
    expect(await submit(bima, second, again)).toMatchObject({ ok: true, all: { rank: 1 } });
    expect((await t.query(api.bogorRun.leaderboard, { period: "all" })).entries.map(({ name, rank }) => [name, rank])).toEqual([["Rania P.", 1], ["Bima S.", 1]]);
  }, 60_000);
});

describe("Bogor Run moderation", () => {
  it("lists hidden players for staff apart from the top 100, so they can always be restored", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik Situs" }), cici = await account(t, "cici@example.com", { name: "Cici Lestari" });
    const run = play(51);
    await submit(cici, await tokenFor(51, Date.now()), run);
    const [entry] = (await owner.query(api.bogorRun.board, { period: "all" })).entries;
    await owner.mutation(api.bogorRun.setHidden, { entryId: entry.id, hidden: true });
    await t.run(async (ctx) => {
      for (let i = 0; i < BOARD_SIZE + 5; i++) await ctx.db.insert("gameBests", { ownerId: `atas-${i}`, period: "all", score: run.score + 100 + i, name: "Atas", achievedAt: T0, hidden: false });
    });
    const staff = await owner.query(api.bogorRun.board, { period: "all" });
    expect(staff.entries).toHaveLength(BOARD_SIZE);
    expect(staff.entries.every((row) => !row.hidden && row.rank !== null)).toBe(true);
    expect(staff.hiddenEntries).toMatchObject([{ id: entry.id, name: "Cici L.", score: run.score, canRestore: true }]);
    expect((await cici.query(api.bogorRun.board, { period: "all" })).hiddenEntries).toEqual([]);
    await owner.mutation(api.bogorRun.setHidden, { entryId: staff.hiddenEntries[0].id, hidden: false });
    expect((await owner.query(api.bogorRun.board, { period: "all" })).hiddenEntries).toEqual([]);
    expect((await cici.query(api.bogorRun.leaderboard, { period: "all" })).you).toEqual({ rank: BOARD_SIZE + 6, score: run.score, hidden: false });
  });

  it("follows the dashboard hierarchy: admins moderate members only, never themselves, and cannot undo an owner", async () => {
    vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com,owner2@example.com");
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik Situs" }), owner2 = await account(t, "owner2@example.com", { name: "Pemilik Kedua" });
    const admin = await account(t, "admin@example.com", { name: "Admin Satu" }), admin2 = await account(t, "admin2@example.com", { name: "Admin Dua" });
    const m1 = await account(t, "m1@example.com", { name: "Anggota Satu" }), m2 = await account(t, "m2@example.com", { name: "Anggota Dua" });
    await promote(t, admin.id); await promote(t, admin2.id);
    const people = [owner, owner2, admin, admin2, m1, m2];
    for (const [i, person] of people.entries()) await submit(person, await tokenFor(60 + i, Date.now()), play(60 + i, i));
    const ids = new Map((await owner.query(api.bogorRun.board, { period: "all" })).entries.map((row) => [row.name, row.id]));
    const entry = (name: string) => ids.get(name)!;
    const hide = (who: typeof owner, name: string, hidden = true) => who.mutation(api.bogorRun.setHidden, { entryId: entry(name), hidden });

    // What each staff view offers matches what setHidden allows.
    const flags = async (who: typeof owner) => Object.fromEntries((await who.query(api.bogorRun.board, { period: "all" })).entries.map((row) => [row.name, row.canHide]));
    expect(await flags(owner)).toEqual({ "Pemilik S.": false, "Pemilik K.": true, "Admin S.": true, "Admin D.": true, "Anggota S.": true, "Anggota D.": true });
    expect(await flags(admin)).toEqual({ "Pemilik S.": false, "Pemilik K.": false, "Admin S.": false, "Admin D.": false, "Anggota S.": true, "Anggota D.": true });
    await expect(hide(admin, "Pemilik S.")).rejects.toThrow("Hanya pemilik");
    await expect(hide(admin, "Admin D.")).rejects.toThrow("Hanya pemilik");
    await expect(hide(admin, "Admin S.")).rejects.toThrow("skormu sendiri");
    await expect(hide(owner, "Pemilik S.")).rejects.toThrow("skormu sendiri");
    await expect(hide(m1, "Anggota D.")).rejects.toThrow("hanya untuk admin");
    await hide(owner, "Pemilik K."); await hide(owner, "Admin D.");
    expect((await t.query(api.bogorRun.leaderboard, { period: "all" })).entries.map(({ name }) => name).sort()).toEqual(["Admin S.", "Anggota D.", "Anggota S.", "Pemilik S."]);

    // An owner's hide stays an owner's: an admin can neither undo it nor take it over by hiding again.
    await hide(owner, "Anggota D.");
    await expect(hide(admin, "Anggota D.", false)).rejects.toThrow("hanya pemilik");
    await hide(admin, "Anggota D.");
    expect((await players(t)).find((row) => row.ownerId === m2.id)).toMatchObject({ hiddenBy: owner.id, hiddenByRole: "owner" });
    // An admin's hide can be undone by any staff; the record keeps both sides.
    await hide(admin, "Anggota S.");
    const adminView = await admin.query(api.bogorRun.board, { period: "all" });
    expect(Object.fromEntries(adminView.hiddenEntries.map((row) => [row.name, [row.hiddenBy, row.hiddenByRole, row.canRestore]]))).toEqual({
      "Pemilik K.": ["Pemilik S.", "owner", false], "Admin D.": ["Pemilik S.", "owner", false], "Anggota D.": ["Pemilik S.", "owner", false], "Anggota S.": ["Admin S.", "admin", true],
    });
    expect((await owner.query(api.bogorRun.board, { period: "all" })).hiddenEntries.every((row) => row.canRestore)).toBe(true);
    await hide(owner, "Anggota S.", false);
    await hide(owner, "Anggota D.", false);
    expect((await players(t)).find((row) => row.ownerId === m1.id)).toMatchObject({ hiddenBy: admin.id, hiddenByRole: "admin", restoredBy: owner.id, restoredAt: expect.any(Number) });
    expect((await t.query(api.bogorRun.leaderboard, { period: "all" })).entries.map(({ name }) => name)).toContain("Anggota D.");
    const text = JSON.stringify(await admin.query(api.bogorRun.board, { period: "all" }));
    for (const secret of people.flatMap((person) => [person.id, person.email])) expect(text).not.toContain(secret);
  });

  it("hides deactivated members and brings them back on reactivation unless staff hid them too", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik Situs" }), admin = await account(t, "admin@example.com", { name: "Admin Satu" });
    const gone = await account(t, "gone@example.com", { name: "Pergi Jauh" }), stay = await account(t, "stay@example.com", { name: "Tetap Ada" });
    await promote(t, admin.id);
    await submit(gone, await tokenFor(71, Date.now()), play(71, 10));
    await submit(stay, await tokenFor(72, Date.now()), play(72));
    const names = async () => (await t.query(api.bogorRun.leaderboard, { period: "all" })).entries.map(({ name }) => name);
    const entryId = (await owner.query(api.bogorRun.board, { period: "all" })).entries.find((row) => row.name === "Pergi J.")!.id;
    expect(await names()).toEqual(["Pergi J.", "Tetap A."]);

    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: false });
    expect(await names()).toEqual(["Tetap A."]);
    expect((await admin.query(api.bogorRun.board, { period: "all" })).hiddenEntries).toMatchObject([{ id: entryId, inactive: true, hiddenAt: null, hiddenBy: null, canRestore: false }]);
    await expect(owner.mutation(api.bogorRun.setHidden, { entryId, hidden: false })).rejects.toThrow("dinonaktifkan");
    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: true });
    expect(await names()).toEqual(["Pergi J.", "Tetap A."]);

    // Hidden by staff and deactivated: reactivation keeps the staff hide, and restoring it while inactive keeps them hidden.
    await owner.mutation(api.bogorRun.setHidden, { entryId, hidden: true });
    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: false });
    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: true });
    expect(await names()).toEqual(["Tetap A."]);
    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: false });
    await owner.mutation(api.bogorRun.setHidden, { entryId, hidden: false });
    expect(await names()).toEqual(["Tetap A."]);
    expect((await owner.query(api.bogorRun.board, { period: "all" })).hiddenEntries).toMatchObject([{ inactive: true, hiddenAt: null, canRestore: false }]);
    await admin.mutation(api.dashboard.setActive, { ownerId: gone.id, active: true });
    expect(await names()).toEqual(["Pergi J.", "Tetap A."]);
  });
});

describe("Bogor Run retention", () => {
  it("deletes per-run records after 30 days without reopening their tokens or touching the counters", async () => {
    const t = setup(); const rania = await account(t, "rania@example.com");
    const old = await issue(t), oldRun = play(old.seed);
    await submit(rania, old, oldRun);
    vi.setSystemTime(T0 + RUN_RETENTION - HOUR);
    const recent = await issue(t), recentRun = play(recent.seed);
    await submit(rania, recent, recentRun);
    const counts = () => t.run(async (ctx) => ({ runs: (await ctx.db.query("gameRuns").collect()).length, stats: await ctx.db.query("gameStats").collect(), bests: (await ctx.db.query("gameBests").collect()).length }));
    const before = await counts();
    vi.setSystemTime(T0 + RUN_RETENTION + 2 * HOUR);
    await t.mutation(internal.bogorRun.pruneRuns, {});
    const after = await counts();
    expect(after).toEqual({ ...before, runs: 1 });
    expect(await t.run((ctx) => ctx.db.query("gameRuns").collect())).toMatchObject([{ seed: recent.seed }]);
    // The pruned run's token is long expired, so it cannot be saved twice.
    vi.setSystemTime(T0 + RUN_RETENTION + 3 * HOUR);
    expect(await rania.mutation(api.bogorRun.submitRun, { token: old.token, inputs: oldRun.inputs, endTick: oldRun.endTick, score: oldRun.score })).toMatchObject({ ok: false, code: "EXPIRED" });
  });

  it("prunes a large backlog in batches", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const t = setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 1205; i++) await ctx.db.insert("gameRuns", { ownerId: "lama", nonce: `n${i}`, seed: i, issuedAt: T0, endTick: 400, score: 50, week: "2026-09-28", submittedAt: T0 });
    });
    vi.setSystemTime(T0 + RUN_RETENTION + 1);
    await t.mutation(internal.bogorRun.pruneRuns, {});
    expect(await t.run(async (ctx) => (await ctx.db.query("gameRuns").collect()).length)).toBe(205);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(async (ctx) => (await ctx.db.query("gameRuns").collect()).length)).toBe(0);
  });
});
