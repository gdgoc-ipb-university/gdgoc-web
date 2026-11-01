import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { dashboardAccess, isActive, requireMember, requireStaff, roleOf } from "./access";
import { logAccess } from "./accessLog";
import { newNonce } from "./bogorRunToken";
import { chapterPeriod, inChapterPeriod } from "../src/lib/chapter";
import { cardNumber, cardPrefix, cardTokenPattern, type CardStatus } from "../src/lib/member-card";

async function cardOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("memberCards").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

async function profileOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

/** The next member number of the current chapter year. The counter row is read and written in the caller's transaction. */
async function nextNumber(ctx: MutationCtx) {
  const counter = await ctx.db.query("cardCounters").withIndex("by_period", (q) => q.eq("period", chapterPeriod.year)).unique();
  const issued = (counter?.issued ?? 0) + 1;
  if (counter) await ctx.db.patch(counter._id, { issued });
  else await ctx.db.insert("cardCounters", { period: chapterPeriod.year, issued });
  return cardNumber(cardPrefix(), issued);
}

type Holder = { profile: Doc<"memberProfiles"> | null; user: { email: string; emailVerified: boolean; image?: string | null } | null };

/** Valid only for an onboarded, active holder in the chapter year the card was opened in, and not blocked. */
export function cardStatus(card: Doc<"memberCards"> | null, { profile, user }: Holder, now: number): CardStatus {
  if (!card || !profile?.completedAt || !user) return "unknown";
  if (!isActive(roleOf(user.email, user.emailVerified, profile), profile)) return "inactive";
  if (card.revokedAt) return "revoked";
  if (card.period !== chapterPeriod.year || !inChapterPeriod(now)) return "expired";
  return "valid";
}

/** Everything the card shows: for its holder, and for staff checking the person in front of them. Never the email. */
function fullCard(card: Doc<"memberCards">, { profile, user }: Holder, status: CardStatus) {
  return {
    status, ownerId: card.ownerId, number: card.number, token: card.token, period: card.period, issuedAt: card.issuedAt,
    revokedAt: card.revokedAt ?? null, name: profile?.fullName ?? "", photo: user?.image ?? null,
    campus: profile?.campus ?? "", studyProgram: profile?.studyProgram ?? "",
    memberType: profile?.memberType ?? null, division: profile?.division ?? null, tagConfirmed: Boolean(profile?.tagConfirmedAt),
  };
}

/** The caller's card, or null before they first open it. The page calls `ensure` on load, which issues it. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user, profile } = await requireMember(ctx);
    const card = await cardOf(ctx, user._id);
    if (!card) return null;
    const holder = { profile, user };
    return fullCard(card, holder, cardStatus(card, holder, Date.now()));
  },
});

/**
 * Issues the caller's card the first time they open it, and again with that year's number and a new token once a new
 * chapter year has started. Otherwise it changes nothing, so the page can call it on every load.
 */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const card = await cardOf(ctx, user._id);
    if (card?.period === chapterPeriod.year) return;
    const fields = { period: chapterPeriod.year, number: await nextNumber(ctx), token: newNonce(), issuedAt: Date.now(), reissuedAt: undefined };
    if (card) await ctx.db.patch(card._id, fields);
    else await ctx.db.insert("memberCards", { ownerId: user._id, ...fields });
  },
});

/** Replaces the caller's QR: the old token, and every saved image or screenshot of it, stops working at once. */
export const reissue = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const card = await cardOf(ctx, user._id);
    if (!card) throw new ConvexError({ code: "NOT_FOUND", message: "Buka kartu anggotamu terlebih dahulu." });
    if (card.revokedAt) throw new ConvexError({ code: "REVOKED", message: "Kartu ini diblokir pengurus. Hubungi admin GDGoC IPB." });
    await ctx.db.patch(card._id, { token: newNonce(), reissuedAt: Date.now() });
  },
});

/**
 * What a scanned QR shows (`/k/<token>`). The holder and active staff get the whole card with the exact status.
 * Anyone else gets the name, community tag and chapter year of a valid card (E10, decision 5), and one "invalid" for
 * every other status, so a token never confirms that an account exists.
 */
export const verify = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const card = cardTokenPattern.test(token) ? await ctx.db.query("memberCards").withIndex("by_token", (q) => q.eq("token", token)).first() : null;
    const holder: Holder = card ? { profile: await profileOf(ctx, card.ownerId), user: await authComponent.getAnyUserById(ctx, card.ownerId) } : { profile: null, user: null };
    const status = cardStatus(card, holder, Date.now());
    const access = await dashboardAccess(ctx);
    if (access?.profile?.completedAt && access.active && access.role !== "member") {
      return { viewer: "staff" as const, status, card: card && fullCard(card, holder, status) };
    }
    if (card && access?.profile?.completedAt && access.user._id === card.ownerId) return { viewer: "self" as const, status, card: fullCard(card, holder, status) };
    if (status !== "valid" || !card || !holder.profile) return { viewer: "guest" as const, status: "invalid" as const, card: null };
    const { profile } = holder;
    return {
      viewer: "guest" as const, status: "valid" as const,
      card: { name: profile.fullName, memberType: profile.memberType ?? null, division: profile.division ?? null, tagConfirmed: Boolean(profile.tagConfirmedAt), period: card.period },
    };
  },
});

/**
 * Staff block a member's card, or lift the block, following the member-management hierarchy: admins act only on
 * members, owners also on admins, and no one on an owner or on themselves. Logged as a `card` access change.
 */
export const setRevoked = mutation({
  args: { ownerId: v.string(), revoked: v.boolean() },
  handler: async (ctx, { ownerId, revoked }) => {
    const actor = await requireStaff(ctx);
    if (ownerId === actor.user._id) throw new ConvexError("Kamu tidak bisa memblokir kartumu sendiri.");
    const profile = await profileOf(ctx, ownerId);
    if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
    const user = await authComponent.getAnyUserById(ctx, ownerId);
    const role = roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile);
    if (role === "owner") throw new ConvexError("Kartu pemilik tidak bisa diblokir dari dashboard.");
    if (role === "admin" && actor.role !== "owner") throw new ConvexError("Hanya pemilik yang bisa mengelola akun admin.");
    const card = await cardOf(ctx, ownerId);
    if (!card) throw new ConvexError({ code: "NOT_FOUND", message: "Anggota ini belum pernah membuka kartu anggotanya." });
    if (Boolean(card.revokedAt) === revoked) return;
    await ctx.db.patch(card._id, revoked ? { revokedAt: Date.now(), revokedBy: actor.user._id } : { revokedAt: undefined, revokedBy: undefined });
    await logAccess(ctx, { actorId: actor.user._id, targetId: ownerId, change: "card", from: revoked ? "active" : "revoked", to: revoked ? "revoked" : "active" });
  },
});
