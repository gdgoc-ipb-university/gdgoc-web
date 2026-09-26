import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const appreciationValues = v.object({
  fullName: v.string(), memberType: v.string(), campus: v.string(), studyProgram: v.string(),
  instagram: v.string(), achievement: v.string(), eventName: v.string(), organizer: v.string(),
  level: v.string(), participation: v.string(), teamName: v.string(), teamMembers: v.string(),
  eventDate: v.string(), story: v.string(), documentationLinks: v.string(), publicationConsent: v.boolean(),
});
export const appreciationStatus = v.union(v.literal("draft"), v.literal("submitted"), v.literal("reviewing"), v.literal("revision"), v.literal("published"));

export default defineSchema({
  memberProfiles: defineTable({
    ownerId: v.string(), fullName: v.string(), campus: v.string(), studyProgram: v.string(),
    nextStep: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
    revision: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
  appreciations: defineTable({
    ownerId: v.string(), ownerName: v.string(), ownerEmail: v.string(), clientId: v.string(),
    values: appreciationValues, status: appreciationStatus, revision: v.number(),
    updatedAt: v.number(), submittedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()), postUrl: v.optional(v.string()),
    reviewedAt: v.optional(v.number()), reviewedBy: v.optional(v.string()),
  })
    .index("by_owner_updated", ["ownerId", "updatedAt"])
    .index("by_owner_client", ["ownerId", "clientId"])
    .index("by_status_updated", ["status", "updatedAt"]),
  appreciationReviews: defineTable({
    appreciationId: v.id("appreciations"), reviewerId: v.string(),
    status: appreciationStatus, note: v.string(), postUrl: v.string(), createdAt: v.number(),
  }).index("by_appreciation", ["appreciationId"]),
});
