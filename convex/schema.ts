import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const appreciationValues = v.object({
  fullName: v.string(), memberType: v.string(), campus: v.string(), studyProgram: v.string(),
  instagram: v.string(), achievement: v.string(), eventName: v.string(), organizer: v.string(),
  level: v.string(), participation: v.string(), teamName: v.string(), teamMembers: v.string(),
  eventDate: v.string(), story: v.string(), documentationLinks: v.string(), publicationConsent: v.boolean(),
});
export const memberType = v.union(v.literal("member"), v.literal("core"));
export const assignmentStatus = v.union(v.literal("draft"), v.literal("published"), v.literal("closed"));
export const appreciationStatus = v.union(v.literal("draft"), v.literal("submitted"), v.literal("reviewing"), v.literal("revision"), v.literal("published"));

export default defineSchema({
  memberProfiles: defineTable({
    ownerId: v.string(), fullName: v.string(), campus: v.string(), studyProgram: v.string(),
    nextStep: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    revision: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
    // Self-declared community role; staff can correct it. Profiles from before this field prompt once.
    memberType: v.optional(memberType), division: v.optional(v.string()),
    // Dashboard access. Owners come from APPRECIATION_ADMIN_EMAILS, never from this table.
    role: v.optional(v.literal("admin")), deactivatedAt: v.optional(v.number()), accessUpdatedBy: v.optional(v.string()),
  }).index("by_owner", ["ownerId"])
    .index("by_completed", ["completedAt"])
    .searchIndex("search_name", { searchField: "fullName" }),
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
  assignments: defineTable({
    title: v.string(), slug: v.optional(v.string()), description: v.string(), dueAt: v.number(), status: assignmentStatus,
    revision: v.number(), createdBy: v.string(), createdAt: v.number(), updatedAt: v.number(), publishedAt: v.optional(v.number()),
  })
    .index("by_status_due", ["status", "dueAt"])
    .index("by_updated", ["updatedAt"]),
  // Every slug an assignment has used, so links keep working after a rename.
  assignmentSlugs: defineTable({ slug: v.string(), assignmentId: v.id("assignments") })
    .index("by_slug", ["slug"])
    .index("by_assignment", ["assignmentId"]),
  assignmentSubmissions: defineTable({
    assignmentId: v.id("assignments"), ownerId: v.string(), answer: v.string(),
    revision: v.number(), submittedAt: v.number(),
  })
    .index("by_assignment_owner", ["assignmentId", "ownerId"])
    .index("by_assignment_submitted", ["assignmentId", "submittedAt"])
    .index("by_owner", ["ownerId"]),
  // Uploads start pending and are attached by a submission; unclaimed ones are removed by a cron.
  submissionFiles: defineTable({
    assignmentId: v.id("assignments"), ownerId: v.string(), storageId: v.id("_storage"),
    name: v.string(), contentType: v.string(), size: v.number(), createdAt: v.number(),
    submissionId: v.optional(v.id("assignmentSubmissions")),
  })
    .index("by_storage", ["storageId"])
    .index("by_submission", ["submissionId", "createdAt"])
    .index("by_owner_assignment", ["ownerId", "assignmentId"])
    .index("by_assignment", ["assignmentId"]),
});
