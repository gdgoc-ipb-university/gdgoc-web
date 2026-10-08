import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { isActive, requireMember, requireStaff, roleOf, type DashboardRole } from "./access";
import { newNonce, signToken, verifyToken } from "./bogorRunToken";
import { ENGINE_VERSION, LIMITS, TICK_RATE, replayRun } from "../src/lib/bogor-run/engine";
import { BOARD_SIZE, LEADERBOARD_SIZE, RANK_CAP, isWeekKey, shortName, unpackInputs, weekKey } from "../src/lib/bogor-run/leaderboard";

const HOUR = 3_600_000;
/** How long after its simulated end a run can still be saved, and how far an honest clock may lag the simulation. */
const SUBMIT_WINDOW = 12 * HOUR, PACE = 0.97, PACE_GRACE = 1000;
/**
 * Per-run records are kept this long. A nonce only has to be remembered until its token is EXPIRED (at most the
 * simulated hour plus SUBMIT_WINDOW), so pruning never reopens a run; bests and gameStats counters are not touched.
 */
export const RUN_RETENTION = 30 * 24 * HOUR;
const PRUNE_BATCH = 1000;
/** Equal scores at the cut of a top list, re-read so the earliest achiever wins the last places. */
const TIE_READ = 200;

const failures = {
  UNAUTHENTICATED: "Masuk dengan akun Google untuk menyimpan skor.",
  DEACTIVATED: "Akun ini sedang dinonaktifkan, jadi skornya tidak bisa disimpan.",
  INVALID: "Skor ini tidak cocok dengan permainannya, jadi tidak disimpan.",
  TOO_EARLY: "Skor ini terkirim lebih cepat dari lama permainannya, jadi tidak disimpan.",
  EXPIRED: "Permainan ini sudah terlalu lama untuk disimpan. Main lagi, yuk!",
  USED: "Skor dari permainan ini sudah disimpan akun lain.",
  OUTDATED: "Game sudah diperbarui sejak permainan ini dimulai, jadi skornya tidak bisa diperiksa. Muat ulang halaman, lalu main lagi.",
} as const;
export type SubmitFailure = keyof typeof failures;
function fail(code: SubmitFailure) { return { ok: false as const, code, message: failures[code] }; }

const period = v.union(v.literal("week"), v.literal("all"));
function periodKey(args: { period: "week" | "all"; week?: string }) {
  if (args.period === "all") return "all";
  const key = args.week ?? weekKey(Date.now());
  if (!isWeekKey(key)) throw new ConvexError({ code: "INVALID", message: "Minggu papan skor tidak valid." });
  return key;
}

function bestOf(ctx: QueryCtx | MutationCtx, ownerId: string, key: string) {
  return ctx.db.query("gameBests").withIndex("by_owner_period", (q) => q.eq("ownerId", ownerId).eq("period", key)).unique();
}
function playerOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("gamePlayers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}
function statsOf(ctx: QueryCtx | MutationCtx, key: string) {
  return ctx.db.query("gameStats").withIndex("by_period", (q) => q.eq("period", key)).unique();
}
function profileOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}
function bestsOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("gameBests").withIndex("by_owner_period", (q) => q.eq("ownerId", ownerId)).collect();
}

/** A player's dashboard role and whether a deactivated account (never an owner's) keeps them off the boards. */
async function playerAccess(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const [user, profile] = await Promise.all([authComponent.getAnyUserById(ctx, ownerId), profileOf(ctx, ownerId)]);
  const role = roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile);
  return { user, role, profile, inactive: !isActive(role, profile) };
}

/**
 * Moderation follows dashboard.setActive: nobody acts on themselves, admins only on members, owners on anyone else.
 * An admin also cannot undo a hide an owner set. Returns the refusal, or null when allowed.
 */
function moderationRefusal(actor: { id: string; role: DashboardRole }, target: { id: string; role: DashboardRole }, undo: DashboardRole | null) {
  if (actor.id === target.id) return "Kamu tidak bisa menyembunyikan atau menampilkan skormu sendiri.";
  if (actor.role === "owner") return null;
  if (target.role !== "member") return "Hanya pemilik yang bisa menyembunyikan atau menampilkan skor admin dan pemilik.";
  if (undo === "owner") return "Pemain ini disembunyikan pemilik, jadi hanya pemilik yang bisa menampilkannya lagi.";
  return null;
}

/**
 * Re-derives whether a player's bests are hidden: by staff (gamePlayers.hiddenAt) or because the account is
 * deactivated. dashboard.setActive calls this, so deactivation hides a player and reactivation restores them unless
 * staff hid them too.
 */
export async function syncBoardVisibility(ctx: MutationCtx, ownerId: string, inactive: boolean) {
  const hidden = inactive || Boolean((await playerOf(ctx, ownerId))?.hiddenAt);
  for (const row of await bestsOf(ctx, ownerId)) if (row.hidden !== hidden) await ctx.db.patch(row._id, { hidden });
}

/** 1 + the number of visible bests above `score`, or null past RANK_CAP. */
async function rankOf(ctx: QueryCtx | MutationCtx, key: string, score: number) {
  const above = await ctx.db.query("gameBests")
    .withIndex("by_period_hidden_score", (q) => q.eq("period", key).eq("hidden", false).gt("score", score)).take(RANK_CAP);
  return above.length < RANK_CAP ? above.length + 1 : null;
}

const byStanding = (a: Doc<"gameBests">, b: Doc<"gameBests">) => b.score - a.score || a.achievedAt - b.achievedAt || a._creationTime - b._creationTime;

/** The top `size` rows, ties broken by who reached the score first (the index alone orders ties by row age). */
async function topRows(ctx: QueryCtx, key: string, hidden: boolean, size: number) {
  const rows = await ctx.db.query("gameBests")
    .withIndex("by_period_hidden_score", (q) => q.eq("period", key).eq("hidden", hidden)).order("desc").take(size);
  if (rows.length < size) return rows.sort(byStanding);
  const edge = rows[size - 1].score;
  const ties = await ctx.db.query("gameBests")
    .withIndex("by_period_hidden_score", (q) => q.eq("period", key).eq("hidden", hidden).eq("score", edge)).take(TIE_READ);
  return [...rows.filter((row) => row.score > edge), ...ties].sort(byStanding).slice(0, size);
}

/** Visible rows ranked (ties share a rank), and the viewer's own standing. */
async function standings(ctx: QueryCtx, key: string, size: number, viewer: string | null) {
  let previous: { score: number; rank: number } | null = null;
  const ranked = (await topRows(ctx, key, false, size)).map((row, index) => {
    const rank: number = previous?.score === row.score ? previous.rank : index + 1;
    previous = { score: row.score, rank };
    return { row, rank };
  });
  const mine = viewer ? await bestOf(ctx, viewer, key) : null;
  const listed = mine && ranked.find(({ row }) => row._id === mine._id);
  return {
    ranked,
    you: mine ? { rank: mine.hidden ? null : listed ? listed.rank : await rankOf(ctx, key, mine.score), score: mine.score, hidden: mine.hidden } : null,
  };
}

/** Where a saved run leaves its owner. `improved` means this run set the best, so resubmits report the same. */
async function standing(ctx: MutationCtx, run: Pick<Doc<"gameRuns">, "ownerId" | "score" | "week" | "submittedAt">) {
  const placeIn = async (key: string) => {
    const best = await bestOf(ctx, run.ownerId, key);
    if (!best) return { best: 0, rank: null, improved: false };
    return { best: best.score, rank: best.hidden ? null : await rankOf(ctx, key, best.score), improved: best.achievedAt === run.submittedAt };
  };
  return { ok: true as const, score: run.score, week: { key: run.week, ...await placeIn(run.week) }, all: await placeIn("all") };
}

/**
 * A signed seed for one run. A mutation, not a query, so every call rolls a fresh seed; it writes nothing.
 * `engine` is the client's ENGINE_VERSION; clients from before it existed send none and run engine 1. A client on
 * another version gets `{ outdated: true }` (it reloads for ranked play); one that sends none gets null and plays unranked.
 */
export const issueRun = mutation({
  args: { engine: v.optional(v.number()) },
  handler: async (_ctx, { engine }) => {
    if ((engine ?? 1) !== ENGINE_VERSION) return engine === undefined ? null : { outdated: true as const };
    const seed = Math.floor(Math.random() * 4294967296) >>> 0, issuedAt = Date.now();
    const token = await signToken({ v: 2, engine: ENGINE_VERSION, seed, issuedAt, nonce: newNonce() });
    return token ? { token, seed, issuedAt } : null;
  },
});

/**
 * Saves a finished run after replaying it: one that crashed on its last tick, or reached the 1-hour finish line.
 * Expected rejections are returned, never thrown. The replay proves the score came from these inputs on this seed;
 * the clock checks prove at least the simulated time passed since the token was issued.
 */
export const submitRun = mutation({
  // `inputs` is the flat [tick, code, ...] log; longer than Convex's array limit it must be a packInputs string.
  args: { token: v.string(), inputs: v.union(v.array(v.number()), v.string()), endTick: v.number(), score: v.number() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) return fail("UNAUTHENTICATED");
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (!isActive(roleOf(user.email, user.emailVerified, profile), profile)) return fail("DEACTIVATED");
    const claim = await verifyToken(args.token);
    if (!claim) return fail("INVALID");
    const used = await ctx.db.query("gameRuns").withIndex("by_nonce", (q) => q.eq("nonce", claim.nonce)).first();
    if (used) return used.ownerId === user._id ? standing(ctx, used) : fail("USED");
    // A run saved before an engine bump still reports its standing above; a new one from another engine cannot be replayed.
    if (claim.engine !== ENGINE_VERSION) return fail("OUTDATED");

    const { endTick, score } = args;
    if (!Number.isInteger(endTick) || endTick < 1 || endTick > LIMITS.maxTicks || !Number.isSafeInteger(score) || score < 0) return fail("INVALID");
    const now = Date.now(), simMs = endTick / TICK_RATE * 1000;
    if (now < claim.issuedAt + simMs * PACE - PACE_GRACE) return fail("TOO_EARLY");
    if (now > claim.issuedAt + simMs + SUBMIT_WINDOW) return fail("EXPIRED");
    const inputs = typeof args.inputs === "string" ? unpackInputs(args.inputs, LIMITS.maxInputNumbers) : args.inputs;
    const replay = inputs && replayRun(claim.seed, inputs, endTick);
    // A saved run ended on its last tick: a crash, or reaching LIMITS.maxTicks (the finish line).
    if (!replay || !replay.ok || !(replay.crashed || replay.finished) || replay.score !== score) return fail("INVALID");

    const run = { ownerId: user._id, nonce: claim.nonce, seed: claim.seed, issuedAt: claim.issuedAt, endTick, score, week: weekKey(claim.issuedAt), submittedAt: now };
    await ctx.db.insert("gameRuns", run);
    const name = shortName(profile?.fullName || user.name), hidden = Boolean((await playerOf(ctx, user._id))?.hiddenAt); // Deactivated accounts never get here.
    for (const key of [run.week, "all"]) {
      const best = await bestOf(ctx, user._id, key);
      if (!best) await ctx.db.insert("gameBests", { ownerId: user._id, period: key, score, name, achievedAt: now, hidden });
      else if (score > best.score) await ctx.db.patch(best._id, { score, name, achievedAt: now, hidden });
      const stats = await statsOf(ctx, key);
      if (stats) await ctx.db.patch(stats._id, { players: stats.players + (best ? 0 : 1), runs: stats.runs + 1 });
      else await ctx.db.insert("gameStats", { period: key, players: 1, runs: 1 });
    }
    return standing(ctx, run);
  },
});

/** The in-game board: top 10 visible players and the viewer's own standing. Never exposes owner ids or emails. */
export const leaderboard = query({
  args: { period, week: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = periodKey(args);
    const user = await authComponent.safeGetAuthUser(ctx);
    const viewer = user?.emailVerified ? user._id : null;
    const { ranked, you } = await standings(ctx, key, LEADERBOARD_SIZE, viewer);
    return {
      key, entries: ranked.map(({ row, rank }) => ({ id: row._id, rank, name: row.name, score: row.score, you: row.ownerId === viewer })),
      you, signedIn: Boolean(viewer),
    };
  },
});

/**
 * The dashboard's top 100 visible players. Staff also get `hiddenEntries`: up to BOARD_SIZE hidden players of the
 * period, listed apart so they never push visible players off the top 100 nor fall off it themselves, with who hid them
 * and whether this viewer may restore them. `canHide`/`canRestore` apply the same rules as setHidden.
 */
export const board = query({
  args: { period, week: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireMember(ctx);
    const key = periodKey(args), staff = access.role !== "member", viewer = access.user._id, actor = { id: viewer, role: access.role };
    const { ranked, you } = await standings(ctx, key, BOARD_SIZE, viewer);
    const players = new Map<string, ReturnType<typeof playerAccess>>();
    const accessOf = (ownerId: string) => players.get(ownerId) ?? players.set(ownerId, playerAccess(ctx, ownerId)).get(ownerId)!;
    // Owners may hide anyone but themselves, so only an admin's view needs each player's role.
    const allowed = async (ownerId: string, undo: DashboardRole | null) => staff
      && !moderationRefusal(actor, { id: ownerId, role: access.role === "owner" || ownerId === viewer ? "member" : (await accessOf(ownerId)).role }, undo);
    const entries = await Promise.all(ranked.map(async ({ row, rank }) => ({
      id: row._id, rank, name: row.name, score: row.score, achievedAt: row.achievedAt, hidden: false, you: row.ownerId === viewer,
      canHide: await allowed(row.ownerId, null),
    })));
    const hiddenRows = staff ? (await ctx.db.query("gameBests")
      .withIndex("by_period_hidden_score", (q) => q.eq("period", key).eq("hidden", true)).order("desc").take(BOARD_SIZE)).sort(byStanding) : [];
    const hiddenEntries = await Promise.all(hiddenRows.map(async (row) => {
      const [player, target] = await Promise.all([playerOf(ctx, row.ownerId), accessOf(row.ownerId)]);
      const hiddenAt = player?.hiddenAt ?? null, hiddenByRole = hiddenAt === null ? null : player?.hiddenByRole ?? "admin";
      const hider = hiddenAt !== null && player?.hiddenBy ? await accessOf(player.hiddenBy) : null;
      return {
        id: row._id, rank: null, name: row.name, score: row.score, achievedAt: row.achievedAt, hidden: true, you: row.ownerId === viewer,
        hiddenAt, hiddenBy: hider ? shortName(hider.profile?.fullName || hider.user?.name || "") : null, hiddenByRole, inactive: target.inactive,
        // Reactivating the account is the only way back for a player hidden just for being deactivated.
        canRestore: (hiddenAt !== null || !target.inactive) && !moderationRefusal(actor, { id: row.ownerId, role: target.role }, hiddenByRole),
      };
    }));
    const stats = await statsOf(ctx, key);
    return { key, entries, hiddenEntries, you, canModerate: staff, stats: { players: stats?.players ?? 0, runs: stats?.runs ?? 0 } };
  },
});

/**
 * Hides or restores a player on every board, including bests they set later, under the setActive hierarchy (see
 * moderationRefusal). gamePlayers keeps who hid them last (and as which role) and who restored them last, and when.
 * A player hidden only because their account is deactivated comes back when it is reactivated, not here.
 */
export const setHidden = mutation({
  args: { entryId: v.id("gameBests"), hidden: v.boolean() },
  handler: async (ctx, { entryId, hidden }) => {
    const actor = await requireStaff(ctx);
    const entry = await ctx.db.get(entryId);
    if (!entry) throw new ConvexError({ code: "NOT_FOUND", message: "Skor ini tidak ditemukan." });
    const [player, target] = await Promise.all([playerOf(ctx, entry.ownerId), playerAccess(ctx, entry.ownerId)]);
    const undo = !hidden && player?.hiddenAt ? player.hiddenByRole ?? "admin" : null;
    const refusal = moderationRefusal({ id: actor.user._id, role: actor.role }, { id: entry.ownerId, role: target.role }, undo);
    if (refusal) throw new ConvexError({ code: "FORBIDDEN", message: refusal });
    if (!hidden && !player?.hiddenAt && target.inactive) {
      throw new ConvexError({ code: "INACTIVE", message: "Akun pemain ini sedang dinonaktifkan. Skornya tampil lagi setelah akunnya diaktifkan kembali." });
    }
    const now = Date.now();
    if (hidden && !player?.hiddenAt) {
      // A hide already in place keeps its author, so hiding again can't turn an owner's decision into an admin's.
      const record = { hiddenAt: now, hiddenBy: actor.user._id, hiddenByRole: actor.role === "owner" ? "owner" as const : "admin" as const };
      if (player) await ctx.db.patch(player._id, record);
      else await ctx.db.insert("gamePlayers", { ownerId: entry.ownerId, ...record });
    } else if (!hidden && player?.hiddenAt) {
      await ctx.db.patch(player._id, { hiddenAt: undefined, restoredAt: now, restoredBy: actor.user._id });
    }
    await syncBoardVisibility(ctx, entry.ownerId, target.inactive);
    return null;
  },
});

/** Daily: deletes per-run records older than RUN_RETENTION, a batch at a time, rescheduling itself while more remain. */
export const pruneRuns = internalMutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    const old = await ctx.db.query("gameRuns").withIndex("by_submitted", (q) => q.lt("submittedAt", Date.now() - RUN_RETENTION)).take(PRUNE_BATCH);
    for (const run of old) await ctx.db.delete(run._id);
    if (old.length === PRUNE_BATCH) await ctx.scheduler.runAfter(0, internal.bogorRun.pruneRuns, {});
    return null;
  },
});
