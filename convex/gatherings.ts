import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, isOwner } from "./auth";
import { isActive, requireMember, requireStaff, roleOf } from "./access";
import { logAccess } from "./accessLog";
import { cardStatus, profileOf } from "./cards";
import { gatheringStatus, memberType } from "./schema";
import { cardTokenPattern } from "../src/lib/member-card";
import { maxHelpers, normalizeGathering, validateGathering, type GatheringValues } from "../src/lib/gathering";
import { fromJakartaInput } from "../src/lib/assignment";

// Gatherings and check-in by member card (E10, #117). Staff manage gatherings; door helpers check people in at the
// gatherings they help with, by scanning a card (`/k/<token>`) or from the list of who has not come yet.

const gatheringInput = v.object({ title: v.string(), startsAt: v.string(), endsAt: v.string(), venue: v.string(), audience: v.array(memberType) });

function notFound(): never { throw new ConvexError({ code: "NOT_FOUND", message: "Kegiatan tidak ditemukan." }); }

function clean(values: GatheringValues) {
  const normal = normalizeGathering(values);
  const errors = validateGathering(normal);
  if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
  return { title: normal.title, venue: normal.venue, audience: normal.audience, startsAt: fromJakartaInput(normal.startsAt), endsAt: fromJakartaInput(normal.endsAt) };
}

async function gatheringFor(ctx: QueryCtx | MutationCtx, id: Id<"gatherings">) {
  const gathering = await ctx.db.get(id);
  if (!gathering) notFound();
  return gathering;
}

/** Active staff, or a door helper of this gathering. Helpers only check people in; staff also manage the gathering. */
async function requireDoor(ctx: QueryCtx | MutationCtx, gathering: Doc<"gatherings">) {
  const access = await requireMember(ctx);
  const staff = access.role !== "member";
  if (!staff && !gathering.helpers.includes(access.user._id)) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk admin GDGoC IPB dan penjaga pintu kegiatan ini." });
  }
  return { ...access, staff };
}

/** Active, onboarded members, the pool a gathering's audience is drawn from. */
async function activeMembers(ctx: QueryCtx) {
  return (await ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0)).collect()).filter((profile) => !profile.deactivatedAt);
}

const inAudience = (gathering: Pick<Doc<"gatherings">, "audience">, profile: Pick<Doc<"memberProfiles">, "memberType">) =>
  Boolean(profile.memberType && gathering.audience.includes(profile.memberType));

async function namesOf(ctx: QueryCtx, ids: string[]) {
  const names = new Map<string, string | null>();
  for (const id of new Set(ids)) names.set(id, (await profileOf(ctx, id))?.fullName || (await authComponent.getAnyUserById(ctx, id))?.name || null);
  return names;
}

/** Gatherings, newest first, with how many came out of how many in the audience. Staff see all; helpers their own. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireMember(ctx);
    const staff = access.role !== "member";
    const all = await ctx.db.query("gatherings").withIndex("by_starts").order("desc").collect();
    const rows = staff ? all : all.filter((gathering) => gathering.helpers.includes(access.user._id));
    if (!staff && !rows.length) throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk admin GDGoC IPB dan penjaga pintu kegiatan." });
    const members = await activeMembers(ctx);
    return Promise.all(rows.map(async (gathering) => ({
      _id: gathering._id, title: gathering.title, startsAt: gathering.startsAt, endsAt: gathering.endsAt, venue: gathering.venue,
      audience: gathering.audience, status: gathering.status,
      checkIns: (await ctx.db.query("checkIns").withIndex("by_gathering_owner", (q) => q.eq("gatheringId", gathering._id)).collect()).length,
      audienceSize: members.filter((profile) => inAudience(gathering, profile)).length,
    })));
  },
});

/** One gathering for its door: who came and when, and who in the audience has not. Helpers' names are for staff. */
export const get = query({
  // A string, so a mistyped link reads as "not found" instead of failing validation.
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("gatherings", args.id);
    const gathering = id && await ctx.db.get(id);
    if (!id || !gathering) { await requireStaff(ctx); return null; }
    const { staff } = await requireDoor(ctx, gathering);
    const rows = await ctx.db.query("checkIns").withIndex("by_gathering_owner", (q) => q.eq("gatheringId", id)).collect();
    const names = await namesOf(ctx, [...rows.map((row) => row.checkedInBy), ...(staff ? gathering.helpers : [])]);
    const checkIns = await Promise.all(rows.map(async (row) => {
      const profile = await profileOf(ctx, row.ownerId);
      return {
        _id: row._id, ownerId: row.ownerId, name: profile?.fullName ?? "Anggota yang akunnya sudah dihapus", campus: profile?.campus ?? "", studyProgram: profile?.studyProgram ?? "",
        memberType: profile?.memberType ?? null, division: profile?.division ?? null,
        checkedInAt: row.checkedInAt, method: row.method, by: names.get(row.checkedInBy) ?? null, outsideAudience: row.outsideAudience,
      };
    }));
    const came = new Set(rows.map((row) => row.ownerId));
    const absent = (await activeMembers(ctx)).filter((profile) => inAudience(gathering, profile) && !came.has(profile.ownerId))
      .map((profile) => ({ ownerId: profile.ownerId, name: profile.fullName, campus: profile.campus, memberType: profile.memberType ?? null, division: profile.division ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
    return {
      _id: gathering._id, title: gathering.title, startsAt: gathering.startsAt, endsAt: gathering.endsAt, venue: gathering.venue,
      audience: gathering.audience, status: gathering.status, staff,
      helpers: staff ? gathering.helpers.map((ownerId) => ({ ownerId, name: names.get(ownerId) ?? "Anggota" })) : [],
      checkIns: checkIns.sort((a, b) => b.checkedInAt - a.checkedInAt), absent,
    };
  },
});

export const create = mutation({
  args: { values: gatheringInput },
  handler: async (ctx, { values }) => {
    const { user } = await requireStaff(ctx);
    const now = Date.now();
    return ctx.db.insert("gatherings", { ...clean(values), status: "draft", helpers: [], createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: { id: v.id("gatherings"), values: gatheringInput },
  handler: async (ctx, { id, values }) => {
    await requireStaff(ctx);
    await gatheringFor(ctx, id);
    await ctx.db.patch(id, { ...clean(values), updatedAt: Date.now() });
  },
});

/** Draft, open for check-in, or closed. Closing freezes the list; a gathering with check-ins cannot go back to draft. */
export const setStatus = mutation({
  args: { id: v.id("gatherings"), status: gatheringStatus },
  handler: async (ctx, { id, status }) => {
    await requireStaff(ctx);
    const gathering = await gatheringFor(ctx, id);
    if (gathering.status === status) return;
    if (status === "draft" && await ctx.db.query("checkIns").withIndex("by_gathering_owner", (q) => q.eq("gatheringId", id)).first()) {
      throw new ConvexError("Kegiatan yang sudah punya kehadiran tidak bisa kembali ke draft.");
    }
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

/** Deletes a draft that nobody has checked in to. */
export const remove = mutation({
  args: { id: v.id("gatherings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const gathering = await gatheringFor(ctx, id);
    if (gathering.status !== "draft") throw new ConvexError("Hanya draft yang bisa dihapus. Tutup kegiatan ini jika sudah selesai.");
    await ctx.db.delete(id);
  },
});

/** Staff add or remove a door helper: an active, onboarded member who is not staff. Logged like assignment reviewers. */
export const setHelper = mutation({
  args: { id: v.id("gatherings"), ownerId: v.string(), helper: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const gathering = await gatheringFor(ctx, args.id);
    const log = (from: string, to: string) => logAccess(ctx, { actorId: actor.user._id, targetId: args.ownerId, change: "gatheringHelper", from, to, gatheringId: gathering._id });
    if (!args.helper) {
      if (!gathering.helpers.includes(args.ownerId)) return;
      await ctx.db.patch(gathering._id, { helpers: gathering.helpers.filter((id) => id !== args.ownerId), updatedAt: Date.now() });
      await log("on", "off");
      return;
    }
    if (gathering.helpers.includes(args.ownerId)) return;
    const profile = await profileOf(ctx, args.ownerId);
    if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
    if (profile.deactivatedAt) throw new ConvexError("Aktifkan kembali akun ini sebelum menjadikannya penjaga pintu.");
    const account = await authComponent.getAnyUserById(ctx, args.ownerId);
    if (profile.role === "admin" || isOwner(account?.email ?? "", Boolean(account?.emailVerified))) throw new ConvexError("Admin dan pemilik sudah bisa mencatat kehadiran di semua kegiatan.");
    if (gathering.helpers.length >= maxHelpers) throw new ConvexError(`Maksimal ${maxHelpers} penjaga pintu per kegiatan.`);
    await ctx.db.patch(gathering._id, { helpers: [...gathering.helpers, args.ownerId], updatedAt: Date.now() });
    await log("off", "on");
  },
});

/**
 * Checks a member in while the gathering is open: by a scanned card's token, or by account from the door's list.
 * A second check-in reports the first one's time. Someone outside the audience is checked in only with `allowOutside`,
 * after the door has seen the warning, and is marked as such.
 */
export const checkIn = mutation({
  args: { id: v.id("gatherings"), token: v.optional(v.string()), ownerId: v.optional(v.string()), allowOutside: v.optional(v.boolean()) },
  handler: async (ctx, { id, token, ownerId, allowOutside }) => {
    const gathering = await gatheringFor(ctx, id);
    const door = await requireDoor(ctx, gathering);
    if (gathering.status !== "open") throw new ConvexError("Check-in kegiatan ini belum dibuka atau sudah ditutup.");
    let holderId: string, method: "scan" | "manual";
    if (token !== undefined) {
      const card = cardTokenPattern.test(token) ? await ctx.db.query("memberCards").withIndex("by_token", (q) => q.eq("token", token)).first() : null;
      const holder = card ? { profile: await profileOf(ctx, card.ownerId), user: await authComponent.getAnyUserById(ctx, card.ownerId) } : { profile: null, user: null };
      if (!card || cardStatus(card, holder, Date.now()) !== "valid") throw new ConvexError("Kartu ini tidak berlaku, jadi kehadirannya tidak bisa dicatat.");
      holderId = card.ownerId; method = "scan";
    } else if (ownerId !== undefined) {
      holderId = ownerId; method = "manual";
    } else throw new ConvexError("Pindai kartu atau pilih anggota yang hadir.");
    const profile = await profileOf(ctx, holderId);
    const user = profile && await authComponent.getAnyUserById(ctx, holderId);
    if (!profile?.completedAt || !isActive(roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile), profile)) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Anggota ini tidak aktif." });
    }
    const existing = await ctx.db.query("checkIns").withIndex("by_gathering_owner", (q) => q.eq("gatheringId", id).eq("ownerId", holderId)).unique();
    if (existing) return { result: "already" as const, name: profile.fullName, checkedInAt: existing.checkedInAt };
    const outsideAudience = !inAudience(gathering, profile);
    if (outsideAudience && !allowOutside) return { result: "outside" as const, name: profile.fullName, memberType: profile.memberType ?? null, division: profile.division ?? null };
    const checkedInAt = Date.now();
    await ctx.db.insert("checkIns", { gatheringId: id, ownerId: holderId, checkedInAt, checkedInBy: door.user._id, method, outsideAudience });
    return { result: "checkedIn" as const, name: profile.fullName, checkedInAt };
  },
});

/** Staff undo a mistaken check-in while the gathering is still open. */
export const removeCheckIn = mutation({
  args: { id: v.id("checkIns") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const row = await ctx.db.get(id);
    if (!row) return;
    const gathering = await gatheringFor(ctx, row.gatheringId);
    if (gathering.status !== "open") throw new ConvexError("Daftar hadir kegiatan yang sudah ditutup tidak bisa diubah.");
    await ctx.db.delete(id);
  },
});

/** The caller's own check-ins, newest first, for their card page. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const rows = await ctx.db.query("checkIns").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").take(50);
    return (await Promise.all(rows.map(async (row) => {
      const gathering = await ctx.db.get(row.gatheringId);
      return gathering && { _id: row._id, title: gathering.title, venue: gathering.venue, startsAt: gathering.startsAt, endsAt: gathering.endsAt, checkedInAt: row.checkedInAt };
    }))).filter((row) => row !== null);
  },
});
