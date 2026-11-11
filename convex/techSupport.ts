import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireTechSupportHandler, requireTechSupportRequester } from "./access";
import { profileOf } from "./cards";
import { techSupportStatus } from "./schema";
import {
  maxOpenRequests, needsMentor, normalizeRequest, techSupportKpis, techSupportLimits, techSupportStatusLabels, techSupportTransitions, validateRequest,
} from "../src/lib/tech-support-request";

// Tech Support requests (#92). Members ask for a mentor for an outside competition; handlers (access.handlesTechSupport)
// match one, move the request through its statuses and keep a short note. Mentors have no account: their name is text.

const requestInput = v.object({
  competition: v.string(), competitionUrl: v.string(), deadline: v.string(), participation: v.union(v.literal("team"), v.literal("solo"), v.literal("")),
  teamName: v.string(), helpKinds: v.array(v.string()), progress: v.string(),
  // Optional only so a page loaded before #251 reaches `submit` and is asked to reload, instead of failing validation.
  whatsapp: v.optional(v.string()), discord: v.optional(v.string()),
});

/**
 * The caller's own requests, newest first, with the status and the matched mentor. Handler notes stay in the queue. The
 * form prefills the contact from the newest request that has one.
 */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireTechSupportRequester(ctx);
    const rows = await ctx.db.query("techSupportRequests").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").take(50);
    return rows.map((row) => ({
      _id: row._id, competition: row.competition, competitionUrl: row.competitionUrl, deadline: row.deadline, participation: row.participation,
      teamName: row.teamName ?? null, helpKinds: row.helpKinds, progress: row.progress, status: row.status,
      whatsapp: row.whatsapp ?? null, discord: row.discord ?? null, mentorName: row.mentorName ?? null, submittedAt: row.submittedAt, updatedAt: row.updatedAt,
    }));
  },
});

export const submit = mutation({
  args: { values: requestInput },
  handler: async (ctx, { values }) => {
    const { user } = await requireTechSupportRequester(ctx);
    if (values.whatsapp === undefined) throw new ConvexError({ code: "OUTDATED", message: "Form ini sudah diperbarui. Muat ulang halaman, lalu kirim lagi dengan nomor WhatsApp-mu." });
    const now = Date.now();
    const normal = normalizeRequest({ ...values, whatsapp: values.whatsapp, discord: values.discord ?? "" });
    const errors = validateRequest(normal, now);
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
    const open = (await ctx.db.query("techSupportRequests").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()).filter((row) => row.status !== "closed");
    if (open.length >= maxOpenRequests) throw new ConvexError(`Kamu masih punya ${open.length} permintaan yang berjalan. Tunggu salah satunya selesai sebelum mengajukan lagi.`);
    return ctx.db.insert("techSupportRequests", {
      ownerId: user._id, competition: normal.competition, competitionUrl: normal.competitionUrl, deadline: normal.deadline,
      participation: normal.participation || "solo", ...(normal.teamName ? { teamName: normal.teamName } : {}), helpKinds: normal.helpKinds,
      progress: normal.progress, whatsapp: normal.whatsapp, ...(normal.discord ? { discord: normal.discord } : {}), status: "new", submittedAt: now, updatedAt: now,
    });
  },
});

/**
 * Every request, newest first, with who asked and the program's counts. A chapter gets tens of requests a year, so the
 * queue reads them all and filters in the browser.
 */
export const queue = query({
  args: {},
  handler: async (ctx) => {
    await requireTechSupportHandler(ctx);
    const rows = await ctx.db.query("techSupportRequests").withIndex("by_submitted").order("desc").collect();
    const names = new Map<string, string | null>();
    for (const id of new Set(rows.flatMap((row) => row.handledBy ? [row.handledBy] : []))) {
      names.set(id, (await profileOf(ctx, id))?.fullName || (await authComponent.getAnyUserById(ctx, id))?.name || null);
    }
    const requests = await Promise.all(rows.map(async (row) => {
      const profile = await profileOf(ctx, row.ownerId);
      const account = await authComponent.getAnyUserById(ctx, row.ownerId);
      return {
        _id: row._id, ownerId: row.ownerId, competition: row.competition, competitionUrl: row.competitionUrl, deadline: row.deadline,
        participation: row.participation, teamName: row.teamName ?? null, helpKinds: row.helpKinds, progress: row.progress, status: row.status,
        whatsapp: row.whatsapp ?? null, discord: row.discord ?? null, mentorName: row.mentorName ?? null, note: row.note ?? null, submittedAt: row.submittedAt, updatedAt: row.updatedAt,
        matchedAt: row.matchedAt ?? null, closedAt: row.closedAt ?? null, handledBy: row.handledBy ? names.get(row.handledBy) ?? null : null,
        member: { name: profile?.fullName ?? "Anggota", email: account?.email ?? "", campus: profile?.campus ?? "", memberType: profile?.memberType ?? null, division: profile?.division ?? null },
      };
    }));
    return { requests, kpis: techSupportKpis(rows) };
  },
});

/**
 * A handler moves a request to another status (see techSupportTransitions) and records the mentor and a note. Matched
 * and in progress need a mentor's name; the first match sets `matchedAt`, which the facilitated count reads.
 */
export const handle = mutation({
  args: { id: v.id("techSupportRequests"), status: techSupportStatus, mentorName: v.string(), note: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireTechSupportHandler(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND", message: "Permintaan tidak ditemukan." });
    const mentorName = args.mentorName.trim().replace(/\s+/g, " "), note = args.note.trim();
    if (args.status !== row.status && !techSupportTransitions[row.status].includes(args.status)) {
      throw new ConvexError(`Permintaan berstatus ${techSupportStatusLabels[row.status]} tidak bisa langsung menjadi ${techSupportStatusLabels[args.status]}.`);
    }
    if (needsMentor(args.status) && !mentorName) throw new ConvexError({ code: "VALIDATION", message: "Tulis nama mentornya.", fields: { mentorName: "Tulis nama mentornya." } });
    if (mentorName.length > techSupportLimits.mentorName) throw new ConvexError({ code: "VALIDATION", message: `Nama mentor maksimal ${techSupportLimits.mentorName} karakter.`, fields: { mentorName: `Maksimal ${techSupportLimits.mentorName} karakter.` } });
    if (note.length > techSupportLimits.note) throw new ConvexError({ code: "VALIDATION", message: `Catatan maksimal ${techSupportLimits.note} karakter.`, fields: { note: `Maksimal ${techSupportLimits.note} karakter.` } });
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: args.status, mentorName: mentorName || undefined, note: note || undefined, updatedAt: now, handledBy: user._id,
      ...(needsMentor(args.status) && !row.matchedAt ? { matchedAt: now } : {}),
      closedAt: args.status === "closed" ? row.closedAt ?? now : undefined,
    });
  },
});
