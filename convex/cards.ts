import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { dashboardAccess, isActive, requireMember, requireStaff, roleOf } from "./access";
import { logAccess } from "./accessLog";
import { photoUrl } from "./photos";
import { filterFacts, filtersValidator, ownerIds } from "./dashboard";
import { newNonce } from "./bogorRunToken";
import { chapterPeriod, inChapterPeriod } from "../src/lib/chapter";
import { runsToday } from "../src/lib/gathering";
import { cardNumber, cardPrefix, cardTokenPattern, type CardStatus } from "../src/lib/member-card";
import { matchesFilters, noFilters } from "../src/lib/member-table";
import { PRINT_BATCH, type PhotoSource } from "../src/lib/card-print";

async function cardOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("memberCards").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

export async function profileOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

/** Today's open gatherings whose door an account runs: all of them for active staff, the ones they help at otherwise. */
export async function doorsFor(ctx: QueryCtx | MutationCtx, viewer: { id: string; staff: boolean }, now: number) {
  const open = await ctx.db.query("gatherings").withIndex("by_status", (q) => q.eq("status", "open")).collect();
  return open.filter((gathering) => runsToday(gathering, now) && (viewer.staff || gathering.helpers.includes(viewer.id)));
}

/** The next member number of the current chapter year. The counter row is read and written in the caller's transaction. */
async function nextNumber(ctx: MutationCtx) {
  const counter = await ctx.db.query("cardCounters").withIndex("by_period", (q) => q.eq("period", chapterPeriod.year)).unique();
  const issued = (counter?.issued ?? 0) + 1;
  if (counter) await ctx.db.patch(counter._id, { issued });
  else await ctx.db.insert("cardCounters", { period: chapterPeriod.year, issued });
  return cardNumber(cardPrefix(), issued);
}

/**
 * Gives an account this chapter year's card: the next number and a new token, on the card it has from an earlier year or
 * on a new one. Callers check first that it has no card of this year.
 */
async function issue(ctx: MutationCtx, ownerId: string, card: Doc<"memberCards"> | null) {
  const fields = { period: chapterPeriod.year, number: await nextNumber(ctx), token: newNonce(), issuedAt: Date.now(), reissuedAt: undefined };
  if (card) await ctx.db.patch(card._id, fields);
  else await ctx.db.insert("memberCards", { ownerId, ...fields });
  return fields.number;
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

/**
 * Everything the card shows: for its holder, and for staff checking the person in front of them. Never the email. The
 * photo is the uploaded one, else the Google one (photos.photoUrl).
 */
async function fullCard(ctx: QueryCtx, card: Doc<"memberCards">, { profile, user }: Holder, status: CardStatus) {
  return {
    status, ownerId: card.ownerId, number: card.number, token: card.token, period: card.period, issuedAt: card.issuedAt,
    revokedAt: card.revokedAt ?? null, name: profile?.fullName ?? "", photo: await photoUrl(ctx, profile, user?.image),
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
    return fullCard(ctx, card, holder, cardStatus(card, holder, Date.now()));
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
    await issue(ctx, user._id, card);
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
 * What a scanned QR shows (`/k/<token>`). Active staff, door helpers of a gathering running today, and the holder get
 * the whole card with the exact status; staff and helpers also get the gatherings they can check the holder into.
 * Anyone else gets the name, community tag and chapter year of a valid card (E10, decision 5), and one "invalid" for
 * every other status, so a token never confirms that an account exists.
 */
export const verify = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const card = cardTokenPattern.test(token) ? await ctx.db.query("memberCards").withIndex("by_token", (q) => q.eq("token", token)).first() : null;
    const holder: Holder = card ? { profile: await profileOf(ctx, card.ownerId), user: await authComponent.getAnyUserById(ctx, card.ownerId) } : { profile: null, user: null };
    const now = Date.now(), status = cardStatus(card, holder, now);
    const access = await dashboardAccess(ctx);
    const member = access?.profile?.completedAt && access.active ? access : null;
    const staff = Boolean(member && member.role !== "member");
    const doors = member ? await doorsFor(ctx, { id: member.user._id, staff }, now) : [];
    const gatherings = await Promise.all((card ? doors : []).map(async (gathering) => {
      const checkIn = await ctx.db.query("checkIns").withIndex("by_gathering_owner", (q) => q.eq("gatheringId", gathering._id).eq("ownerId", card!.ownerId)).unique();
      const memberType = holder.profile?.memberType;
      return {
        _id: gathering._id, title: gathering.title, venue: gathering.venue, checkedInAt: checkIn?.checkedInAt ?? null,
        inAudience: Boolean(memberType && gathering.audience.includes(memberType)),
      };
    }));
    if (staff || doors.length) return { viewer: staff ? "staff" as const : "helper" as const, status, card: card && await fullCard(ctx, card, holder, status), gatherings };
    if (card && access?.profile?.completedAt && access.user._id === card.ownerId) return { viewer: "self" as const, status, card: await fullCard(ctx, card, holder, status) };
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

const photoSource = (profile: Doc<"memberProfiles">, image: string | null | undefined): PhotoSource => profile.photoStorageId ? "uploaded" : image ? "google" : "initial";

/** One call of `printCards` or `issueFor` takes `PRINT_BATCH` members; the print page sends them in batches. */
function batch(ownerIds: string[]) {
  if (ownerIds.length > PRINT_BATCH) throw new ConvexError(`Paling banyak ${PRINT_BATCH} anggota sekaligus.`);
  return [...new Set(ownerIds)];
}

/**
 * The members staff chose to print (#159), page by page as the members CSV: everyone matching the members table's search
 * and filters, or the members they ticked. For each: name, tag, this chapter year's card number or null (no card, or one
 * from an earlier year), blocked, active, and the photo source. Never the QR token: `printCards` gives that at print time.
 */
export const printSelection = query({
  args: {
    selection: v.union(
      v.object({ kind: v.literal("filters"), search: v.string(), filters: filtersValidator }),
      v.object({ kind: v.literal("picked"), ownerIds: v.array(v.string()) }),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { selection, paginationOpts }) => {
    await requireStaff(ctx);
    const term = selection.kind === "filters" ? selection.search.trim().slice(0, 80) : "";
    const result = await (term
      ? ctx.db.query("memberProfiles").withSearchIndex("search_name", (q) => q.search("fullName", term))
      : ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0))).paginate(paginationOpts);
    const picked = selection.kind === "picked" ? new Set(selection.ownerIds) : null;
    const filters = selection.kind === "filters" ? { ...noFilters, ...selection.filters } : noFilters;
    const owners = !picked && filters.access.length ? await ownerIds(ctx) : new Set<string>();
    const chosen = result.page.filter((profile) => profile.completedAt && (picked ? picked.has(profile.ownerId) : matchesFilters(filterFacts(profile, owners), filters)));
    return {
      ...result,
      page: await Promise.all(chosen.map(async (profile) => {
        const [user, card] = await Promise.all([authComponent.getAnyUserById(ctx, profile.ownerId), cardOf(ctx, profile.ownerId)]);
        const role = roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile);
        return {
          ownerId: profile.ownerId, name: profile.fullName, memberType: profile.memberType ?? null, division: profile.division ?? null,
          active: isActive(role, profile), number: card?.period === chapterPeriod.year ? card.number : null, blocked: Boolean(card?.revokedAt),
          photo: photoSource(profile, user?.image),
        };
      })),
    };
  },
});

/**
 * The whole card of each given member who has this chapter year's card, QR token included, for the print PDF. Read at
 * print time, so a QR replaced after the summary prints current. Members without one are left out.
 */
export const printCards = query({
  args: { ownerIds: v.array(v.string()) },
  handler: async (ctx, { ownerIds: given }) => {
    await requireStaff(ctx);
    const now = Date.now();
    const cards = await Promise.all(batch(given).map(async (ownerId) => {
      const [card, profile, user] = await Promise.all([cardOf(ctx, ownerId), profileOf(ctx, ownerId), authComponent.getAnyUserById(ctx, ownerId)]);
      if (!card || card.period !== chapterPeriod.year || !profile?.completedAt) return null;
      const holder = { profile, user };
      return { ...await fullCard(ctx, card, holder, cardStatus(card, holder, now)), photoSource: photoSource(profile, user?.image) };
    }));
    return cards.filter((card) => card !== null);
  },
});

/**
 * Staff issue this chapter year's card to members who have none yet (#159), exactly as `ensure` does when a member opens
 * theirs: the year's next number from the counter and a new token, so a number is never reused. A member who already
 * has this year's card is left as it is, so sending the same list twice issues nothing new; a blocked card, an inactive
 * or not onboarded account is skipped. Numbers follow the order given. Each card issued is logged as `cardIssued`.
 */
export const issueFor = mutation({
  args: { ownerIds: v.array(v.string()) },
  handler: async (ctx, { ownerIds: given }) => {
    const actor = await requireStaff(ctx);
    const issued: { ownerId: string; number: string }[] = [], skipped: { ownerId: string; reason: "current" | "blocked" | "inactive" | "missing" }[] = [];
    // One at a time: each number reads and writes the year's counter.
    for (const ownerId of batch(given)) {
      const profile = await profileOf(ctx, ownerId);
      const user = profile?.completedAt ? await authComponent.getAnyUserById(ctx, ownerId) : null;
      if (!profile || !user) { skipped.push({ ownerId, reason: "missing" }); continue; }
      if (!isActive(roleOf(user.email, user.emailVerified, profile), profile)) { skipped.push({ ownerId, reason: "inactive" }); continue; }
      const card = await cardOf(ctx, ownerId);
      if (card?.revokedAt) { skipped.push({ ownerId, reason: "blocked" }); continue; }
      if (card?.period === chapterPeriod.year) { skipped.push({ ownerId, reason: "current" }); continue; }
      const number = await issue(ctx, ownerId, card);
      await logAccess(ctx, { actorId: actor.user._id, targetId: ownerId, change: "cardIssued", from: card?.number ?? "none", to: number });
      issued.push({ ownerId, number });
    }
    return { issued, skipped };
  },
});
