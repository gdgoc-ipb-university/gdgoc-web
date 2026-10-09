import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const appreciationValues = v.object({
  fullName: v.string(), memberType: v.string(), campus: v.string(), studyProgram: v.string(),
  instagram: v.string(), achievement: v.string(), eventName: v.string(), organizer: v.string(),
  level: v.string(), participation: v.string(), teamName: v.string(), teamMembers: v.string(),
  eventDate: v.string(), story: v.string(), documentationLinks: v.string(), publicationConsent: v.boolean(),
});
export const memberType = v.union(v.literal("member"), v.literal("core"), v.literal("bod"));
export const assignmentStatus = v.union(v.literal("draft"), v.literal("published"), v.literal("closed"));
export const appreciationStatus = v.union(v.literal("draft"), v.literal("submitted"), v.literal("reviewing"), v.literal("revision"), v.literal("published"));
export const accessChange = v.union(
  v.literal("role"), v.literal("reviewer"), v.literal("active"), v.literal("memberType"), v.literal("assignmentReviewer"), v.literal("deleted"),
);
export const rubricBreakdown = v.array(v.object({ name: v.string(), max: v.number(), points: v.number() }));

export default defineSchema({
  memberProfiles: defineTable({
    ownerId: v.string(), fullName: v.string(), campus: v.string(), studyProgram: v.string(),
    nextStep: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    revision: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
    // Self-declared community role; staff can correct it. Profiles from before this field prompt once.
    memberType: v.optional(memberType), division: v.optional(v.string()),
    // Dashboard access. Owners come from APPRECIATION_ADMIN_EMAILS, never from this table.
    role: v.optional(v.literal("admin")), deactivatedAt: v.optional(v.number()), accessUpdatedBy: v.optional(v.string()),
    // Apresiasi review granted by an owner; separate from `role`, and suspended while deactivated.
    appreciationReviewer: v.optional(v.boolean()),
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
    // Scores run from 0 to this; older assignments without it are graded out of 100 (assignmentMaxScore).
    // With a rubric, maxScore is the sum of the criteria maxes and reviews carry one point value per criterion.
    maxScore: v.optional(v.number()), rubric: v.optional(v.array(v.object({ name: v.string(), max: v.number() }))),
    // Members staff chose to review this assignment's submissions (account IDs), e.g. a Catalyst role's mentors. Staff review every assignment.
    reviewers: v.optional(v.array(v.string())),
    // The community tags given this assignment (assignmentAudience); staff see every assignment. Rows without it predate audiences and are Core Team only.
    audience: v.optional(v.array(memberType)),
  })
    .index("by_status_due", ["status", "dueAt"])
    .index("by_updated", ["updatedAt"]),
  // Every slug an assignment has used, so links keep working after a rename.
  assignmentSlugs: defineTable({ slug: v.string(), assignmentId: v.id("assignments") })
    .index("by_slug", ["slug"])
    .index("by_assignment", ["assignmentId"]),
  assignmentSubmissions: defineTable({
    // `answer` is plain text (older submissions, previews); `answerDoc` is the sanitized rich-text JSON.
    assignmentId: v.id("assignments"), ownerId: v.string(), answer: v.string(), answerDoc: v.optional(v.string()),
    revision: v.number(), submittedAt: v.number(),
    // The latest review; `submittedAt > reviewedAt` means the member resubmitted since (isStaleReview).
    score: v.optional(v.number()), feedback: v.optional(v.string()), reviewedAt: v.optional(v.number()), reviewedBy: v.optional(v.string()),
    // With a rubric: the criteria as they were when scored, each with its points, so later rubric edits do not relabel a past review.
    breakdown: v.optional(rubricBreakdown),
    // Set while a reviewer has asked for a revision (the note is `feedback`); the member can resubmit even after closing. Resubmitting clears it.
    revisionRequestedAt: v.optional(v.number()),
  })
    .index("by_assignment_owner", ["assignmentId", "ownerId"])
    .index("by_assignment_submitted", ["assignmentId", "submittedAt"])
    .index("by_owner", ["ownerId"]),
  // One row per review action, so a score's history survives re-reviews (like appreciationReviews).
  submissionReviews: defineTable({
    submissionId: v.id("assignmentSubmissions"), assignmentId: v.id("assignments"), reviewerId: v.string(),
    score: v.optional(v.number()), breakdown: v.optional(rubricBreakdown), feedback: v.string(), createdAt: v.number(),
    revisionRequested: v.optional(v.boolean()), // a revision request rather than a score; `feedback` is its note
  }).index("by_submission", ["submissionId", "createdAt"]),
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
  // Bogor Run: one row per accepted, server-replayed run. `week` comes from when the run's token was issued.
  gameRuns: defineTable({
    ownerId: v.string(), nonce: v.string(), seed: v.number(), issuedAt: v.number(),
    endTick: v.number(), score: v.number(), week: v.string(), submittedAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_owner", ["ownerId", "submittedAt"])
    .index("by_submitted", ["submittedAt"]), // bogorRun.pruneRuns deletes rows after 30 days.
  // Each player's best per period ("all" or a week key). `name` is the public short name; `hidden` mirrors gamePlayers.
  gameBests: defineTable({
    ownerId: v.string(), period: v.string(), score: v.number(), name: v.string(), achievedAt: v.number(), hidden: v.boolean(),
  })
    .index("by_owner_period", ["ownerId", "period"])
    .index("by_period_hidden_score", ["period", "hidden", "score"]),
  // Staff moderation that also applies to bests set later: `hiddenAt` while hidden; who hid (and as which role) and who
  // restored last are kept. A deactivated account is hidden too, from memberProfiles.deactivatedAt, not from here.
  gamePlayers: defineTable({
    ownerId: v.string(), hiddenAt: v.optional(v.number()), hiddenBy: v.optional(v.string()),
    hiddenByRole: v.optional(v.union(v.literal("owner"), v.literal("admin"))), restoredAt: v.optional(v.number()), restoredBy: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]),
  // Player and run counts per period, kept as counters so the board never scans every run.
  gameStats: defineTable({ period: v.string(), players: v.number(), runs: v.number() })
    .index("by_period", ["period"]),
  // One row per access change made in the dashboard (accessLog.ts). Account IDs only: names are looked up when owners read it.
  accessLog: defineTable({
    at: v.number(), actorId: v.string(), targetId: v.string(), change: accessChange,
    // The value before and after: "admin"/"member", "on"/"off", "active"/"deactivated", or a community tag as "core:Technical".
    from: v.string(), to: v.string(), assignmentId: v.optional(v.id("assignments")),
  })
    .index("by_at", ["at"])
    .index("by_target", ["targetId", "at"]),
  // One row per deleted account: who deleted it, when, and how many rows of each kind went. No personal data.
  accountDeletions: defineTable({
    deletedAt: v.number(), deletedBy: v.string(),
    counts: v.object({
      appreciations: v.number(), appreciationReviews: v.number(), submissions: v.number(), submissionReviews: v.number(),
      files: v.number(), gameRuns: v.number(), gameBests: v.number(), reviewerGrants: v.number(), sessions: v.number(), accounts: v.number(),
    }),
  }).index("by_deleted", ["deletedAt"]),
});
