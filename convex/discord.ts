import { ConvexError, v, type Infer } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import { dashboardAccess, isActive, roleOf } from "./access";
import { addGuildMember, currentUser, isRetryable, type DiscordFailure } from "./discordApi";
import { linkOf, removeLink } from "./discordLinks";
import { discordServerUrl, discordSettings } from "../src/lib/discord";

const signInAgain = () => new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });
const notSetUp = "Discord belum disiapkan pengurus.";
const deactivated = "Akun ini sedang dinonaktifkan. Hubungi admin GDGoC IPB.";

/** Whether an account may be in the server: signed in through Google, and not deactivated. */
async function accountState(ctx: QueryCtx, userId: string) {
  const user = await authComponent.getAnyUserById(ctx, userId);
  if (!user?.emailVerified) return "missing" as const;
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", userId)).unique();
  return isActive(roleOf(user.email, user.emailVerified, profile), profile) ? "active" as const : "deactivated" as const;
}

/** The Discord section on Profil and in onboarding: whether Discord is set up, and the member's link. Onboarding counts. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) return null;
    const settings = discordSettings(process.env);
    const link = await linkOf(ctx, access.user._id);
    return {
      configured: Boolean(settings), serverUrl: settings ? discordServerUrl(settings.guildId) : null,
      link: link ? {
        username: link.username ?? null, linkedAt: link.linkedAt, joinStatus: link.joinStatus,
        lastSyncedAt: link.lastSyncedAt ?? null, lastError: link.lastError ?? null,
      } : null,
    };
  },
});

/** Asked by `/link-social` before a member links Discord (discordAuth.ts); the answer is shown to them. */
export const linkProblem = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<string | null> => {
    if (!discordSettings(process.env)) return notSetUp;
    const state = await accountState(ctx, userId);
    if (state !== "active") return state === "missing" ? "Masuk kembali dengan akun Google untuk melanjutkan." : deactivated;
    if (await linkOf(ctx, userId)) return "Akunmu sudah terhubung ke Discord. Putuskan dulu sebelum menghubungkan akun lain.";
    return null;
  },
});

/**
 * "Putuskan": removes the member's link and Better Auth's Discord account in one transaction, so no fresh sign-in is
 * needed as Better Auth's own unlink asks. The member stays in the server (discordLinks.removeLink).
 */
export const unlink = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) throw signInAgain();
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "account", where: [{ field: "userId", operator: "eq", value: access.user._id }, { field: "providerId", operator: "eq", value: "discord" }] },
      paginationOpts: { numItems: 10, cursor: null },
    });
    await removeLink(ctx, access.user._id);
  },
});

/** "Coba lagi" after a join failed: one more round of attempts. */
export const retryJoin = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) throw signInAgain();
    if (!access.active) throw new ConvexError({ code: "DEACTIVATED", message: deactivated });
    const link = await linkOf(ctx, access.user._id);
    if (!link) throw new ConvexError({ code: "NOT_FOUND", message: "Discord belum terhubung." });
    if (link.joinStatus !== "failed") return;
    await ctx.db.patch(link._id, { joinStatus: "pending", lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.discord.join, { linkId: link._id, attempt: 0 });
  },
});

/** Waits before each automatic retry after a 5xx or a network failure; after the last, the join is marked failed. */
export const retryDelays = [5_000, 30_000, 120_000, 600_000, 1_800_000];
const busy = "Discord sedang sibuk. Kami mencoba lagi otomatis.";

/** A short reason the member can act on, or that tells them to ask staff. */
export function joinFailure(failure: DiscordFailure) {
  if (failure.code === 40007) return "Akun Discord ini diblokir dari server GDGoC IPB. Hubungi pengurus.";
  if (failure.code === 30001) return "Akun Discord-mu sudah ada di 100 server, batas dari Discord. Keluar dari salah satu server, lalu coba lagi.";
  if (failure.status === 401 || failure.code === 50025) return "Izin Discord sudah tidak berlaku. Putuskan, lalu hubungkan lagi.";
  if (failure.status === 403) return "Bot GDGoC IPB belum punya izin menambahkan member. Pengurus perlu memeriksanya.";
  if (failure.status === 404) return "Server Discord GDGoC IPB tidak ditemukan. Pengurus perlu memeriksa pengaturannya.";
  return `Discord menolak permintaan (${failure.status}${failure.code ? `, kode ${failure.code}` : ""}).`;
}

function afterFailure(failure: DiscordFailure, attempt: number) {
  if (!isRetryable(failure)) return { kind: "failed" as const, error: joinFailure(failure) };
  if (attempt >= retryDelays.length) return { kind: "failed" as const, error: "Discord sedang bermasalah. Coba lagi nanti." };
  // A 429 says how long to wait; Discord's own errors and network failures back off.
  const delayMs = failure.status === 429 ? Math.max(failure.retryAfterMs ?? 0, 1_000) : retryDelays[attempt];
  return { kind: "retry" as const, delayMs, error: busy };
}

export const joinTarget = internalQuery({
  args: { linkId: v.id("discordLinks") },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get(linkId);
    return link ? { ownerId: link.ownerId, discordId: link.discordId, state: await accountState(ctx, link.ownerId) } : null;
  },
});

const outcome = v.union(
  v.object({ kind: v.literal("joined"), username: v.string() }),
  v.object({ kind: v.literal("retry"), delayMs: v.number(), error: v.string(), username: v.optional(v.string()) }),
  v.object({ kind: v.literal("failed"), error: v.string(), username: v.optional(v.string()) }),
);

/** Records one join attempt and schedules the next when Discord asked to wait. Nothing happens for a link that is gone. */
export const recordJoin = internalMutation({
  args: { linkId: v.id("discordLinks"), attempt: v.number(), outcome },
  handler: async (ctx, { linkId, attempt, outcome }) => {
    const link = await ctx.db.get(linkId);
    if (!link) return;
    const base = { username: outcome.username ?? link.username, attempts: link.attempts + 1 };
    if (outcome.kind === "joined") {
      await ctx.db.patch(linkId, { ...base, joinStatus: "joined", lastSyncedAt: Date.now(), lastError: undefined });
      return;
    }
    await ctx.db.patch(linkId, { ...base, joinStatus: outcome.kind === "retry" ? "pending" : "failed", lastError: outcome.error });
    if (outcome.kind === "retry") await ctx.scheduler.runAfter(outcome.delayMs, internal.discord.join, { linkId, attempt: attempt + 1 });
  },
});

/**
 * Adds a linked member to the chapter server with Discord's Add Guild Member call (discordApi.ts), using their own token
 * from Better Auth (refreshed when it has expired) and the bot's. Already in the server counts as joined. Scheduled by
 * `discordLinks.recordLink` and by `retryJoin`, and by itself after a 429, a 5xx or a network failure.
 */
export const join = internalAction({
  args: { linkId: v.id("discordLinks"), attempt: v.number() },
  handler: async (ctx, { linkId, attempt }): Promise<void> => {
    const target = await ctx.runQuery(internal.discord.joinTarget, { linkId });
    if (!target) return;
    const record = async (result: Infer<typeof outcome>) => { await ctx.runMutation(internal.discord.recordJoin, { linkId, attempt, outcome: result }); };
    const settings = discordSettings(process.env);
    if (!settings) return record({ kind: "failed", error: notSetUp });
    if (target.state !== "active") return record({ kind: "failed", error: "Akun ini sedang dinonaktifkan, jadi belum ditambahkan ke server." });
    let accessToken: string;
    try {
      accessToken = (await createAuth(ctx).api.getAccessToken({ body: { providerId: "discord", userId: target.ownerId } })).accessToken;
    } catch {
      return record({ kind: "failed", error: "Izin Discord sudah tidak berlaku. Putuskan, lalu hubungkan lagi." });
    }
    const me = await currentUser(accessToken);
    if (!me.ok) return record(afterFailure(me, attempt));
    const username = me.data.username;
    if (me.data.id !== target.discordId) return record({ kind: "failed", username, error: "Izin Discord ini milik akun lain. Putuskan, lalu hubungkan lagi." });
    const added = await addGuildMember({ guildId: settings.guildId, userId: target.discordId, accessToken, botToken: settings.botToken });
    return record(added.ok ? { kind: "joined", username } : { ...afterFailure(added, attempt), username });
  },
});
