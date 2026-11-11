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
  v.literal("tagConfirmed"), v.literal("tagSelfChanged"),
  // A participant's enrolment in a cohort: their role, withdrawn or back, or a corrected email (the values are not kept).
  v.literal("enrolmentRole"), v.literal("enrolmentStatus"), v.literal("enrolmentEmail"),
  // Staff blocked a member card or lifted the block ("active"/"revoked").
  v.literal("card"),
  // Staff added or removed a door helper of one gathering ("on"/"off").
  v.literal("gatheringHelper"),
  // An owner granted or revoked the Tech Support queue ("on"/"off").
  v.literal("techSupportHandler"),
  // Staff removed a member's uploaded profile photo ("uploaded"/"removed").
  v.literal("photo"),
  // Staff made a member a mentor of one cohort role or removed them ("off" → role key, role key → "off").
  v.literal("cohortMentor"),
  // Staff issued a member's card for the chapter year from the print page (the old number or "none" → the new one).
  v.literal("cardIssued"),
  // Staff corrected a member's profile answers (#235): the fields that changed, comma-separated, in both `from` and `to`;
  // the values are not kept, like a corrected enrolment email.
  v.literal("profile"),
);
export const gatheringStatus = v.union(v.literal("draft"), v.literal("open"), v.literal("closed"));
export const rubricBreakdown = v.array(v.object({ name: v.string(), max: v.number(), points: v.number() }));
export const institutionKind = v.union(v.literal("campus"), v.literal("school"));
export const techSupportStatus = v.union(v.literal("new"), v.literal("matched"), v.literal("inProgress"), v.literal("closed"));
export const cohortStatus = v.union(v.literal("setup"), v.literal("active"), v.literal("ended"));
export const cohortRole = v.object({ key: v.string(), name: v.string() });
export const leagueTrack = v.union(v.literal("software"), v.literal("uiux"), v.literal("business"));

export default defineSchema({
  memberProfiles: defineTable({
    ownerId: v.string(), fullName: v.string(), campus: v.string(), studyProgram: v.string(),
    // Onboarding screen ids (src/lib/onboarding.ts); 3 was the role screen and is the Instagram screen since #212.
    nextStep: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6)),
    // Campus or school (SMA or SMK), chosen on the education screen; unset on profiles saved before it was asked.
    institutionKind: v.optional(institutionKind),
    // Instagram username without "@", from screen 3; core team checks the follow and the twibbon with it (#212).
    instagram: v.optional(v.string()),
    // When the username last changed after onboarding (#235), by the member or staff; staff re-check the follow and twibbon.
    instagramChangedAt: v.optional(v.number()),
    revision: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
    // Community tag: Member from onboarding; Core Team, BoD and divisions only from staff (#156). Tags members chose
    // themselves before that stay until staff change or confirm them; profiles from before this field register as Member once.
    memberType: v.optional(memberType), division: v.optional(v.string()),
    // Dashboard access. Owners come from APPRECIATION_ADMIN_EMAILS, never from this table.
    role: v.optional(v.literal("admin")), deactivatedAt: v.optional(v.number()), accessUpdatedBy: v.optional(v.string()),
    // Apresiasi review granted by an owner; separate from `role`, and suspended while deactivated.
    appreciationReviewer: v.optional(v.boolean()),
    // Set when staff set or confirm the community tag; cleared when the member changes it themselves. A confirmed
    // Media & Creative Core Team or BoD tag also grants Apresiasi review (auth.reviewsByTag).
    tagConfirmedAt: v.optional(v.number()), tagConfirmedBy: v.optional(v.string()),
    // The Tech Support queue granted by an owner, like `appreciationReviewer`; owners and admins handle it by role.
    techSupportHandler: v.optional(v.boolean()),
    // The member's own photo for the dashboard and the printed card (#146), ahead of the Google photo (photos.ts).
    photoStorageId: v.optional(v.id("_storage")), photoUploadedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"])
    .index("by_completed", ["completedAt"])
    .index("by_photo", ["photoStorageId"])
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
    // A cohort assignment (cohorts.ts) goes to that cohort's active participants instead of an audience, and only to these
    // role keys; absent or empty means every role. Its role's mentors review it like assignment reviewers.
    cohortId: v.optional(v.id("cohorts")), cohortRoles: v.optional(v.array(v.string())),
    // A flag task (#240) is graded by the site: the member submits a flag and gets points that drop with each solve. Without
    // `kind` the task is graded by hand. Its points are here; the flag itself is in assignmentFlags, away from this row.
    kind: v.optional(v.literal("flag")),
    maxPoints: v.optional(v.number()), minPoints: v.optional(v.number()), decrement: v.optional(v.number()),
  })
    .index("by_status_due", ["status", "dueAt"])
    .index("by_updated", ["updatedAt"])
    .index("by_cohort", ["cohortId"]),
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
  // A flag task's flag, one row per task. Only staff functions and the solve mutation read it, so no query that returns an
  // assignment row can hand the flag to a member.
  assignmentFlags: defineTable({ assignmentId: v.id("assignments"), flag: v.string(), updatedAt: v.number(), updatedBy: v.string() })
    .index("by_assignment", ["assignmentId"]),
  // One correct flag per member and task, with the points locked at solve time. `place` is the n of the points formula:
  // the solves that existed before it, plus one.
  flagSolves: defineTable({ assignmentId: v.id("assignments"), ownerId: v.string(), points: v.number(), place: v.number(), solvedAt: v.number() })
    .index("by_assignment", ["assignmentId", "solvedAt"])
    .index("by_assignment_owner", ["assignmentId", "ownerId"])
    .index("by_owner", ["ownerId"]),
  // Wrong flags per member and task: how many for staff, and the rate limit's bucket (src/lib/flag-task.ts). The guesses
  // themselves are not kept.
  flagAttempts: defineTable({
    assignmentId: v.id("assignments"), ownerId: v.string(), wrong: v.number(), lastWrongAt: v.number(), tokens: v.number(), tokensAt: v.number(),
  })
    .index("by_assignment_owner", ["assignmentId", "ownerId"])
    .index("by_owner", ["ownerId"]),
  // Bogor Run: one row per accepted, server-replayed run. `week` comes from when the run's token was issued.
  gameRuns: defineTable({
    ownerId: v.string(), nonce: v.string(), seed: v.number(), issuedAt: v.number(),
    endTick: v.number(), score: v.number(), week: v.string(), submittedAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_owner", ["ownerId", "submittedAt"])
    .index("by_submitted", ["submittedAt"]), // bogorRun.pruneRuns deletes rows after 30 days.
  // Each player's best per period ("all" or a week key). `name` is the public short name; `hidden` mirrors gamePlayers.
  // `endTick` is the best run's server-replayed length (120 ticks a second); bests saved before #232 have none.
  gameBests: defineTable({
    ownerId: v.string(), period: v.string(), score: v.number(), name: v.string(), achievedAt: v.number(), hidden: v.boolean(),
    endTick: v.optional(v.number()),
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
  // One run of a program, e.g. GDGoC Catalyst 2026/27, with its roles. Role keys never change once enrolments use them; names can.
  cohorts: defineTable({
    slug: v.string(), name: v.string(), roles: v.array(cohortRole), status: cohortStatus,
    attendanceTarget: v.optional(v.number()), // the share of sessions participants commit to, e.g. 0.7
    createdBy: v.string(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_slug", ["slug"]),
  // One participant of one cohort, keyed by email because accepted applicants are imported before most have an account.
  // `ownerId` is set once an account signs in with that verified email (cohorts.claimMine); queries read by it after that.
  enrolments: defineTable({
    cohortId: v.id("cohorts"), email: v.string(), name: v.string(), role: v.string(),
    ownerId: v.optional(v.string()), claimedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("withdrawn")),
    // The participant's team in this cohort (#107), so they are in at most one. Deleting the team clears it.
    teamId: v.optional(v.id("teams")),
    importedAt: v.number(), importedBy: v.string(), withdrawnAt: v.optional(v.number()), withdrawnBy: v.optional(v.string()),
  })
    .index("by_cohort_email", ["cohortId", "email"])
    .index("by_email", ["email"])
    .index("by_owner", ["ownerId"])
    .index("by_cohort_role", ["cohortId", "role"])
    .index("by_team", ["teamId"]),
  // A team of participants within one cohort, formed after session 1 (#107). Members are the enrolments with its `teamId`.
  teams: defineTable({ cohortId: v.id("cohorts"), name: v.string(), createdBy: v.string(), createdAt: v.number(), updatedAt: v.number() })
    .index("by_cohort", ["cohortId"]),
  // A member who mentors one role of a cohort and so reviews that role's assignments without being added to each.
  cohortMentors: defineTable({ cohortId: v.id("cohorts"), ownerId: v.string(), role: v.string(), addedBy: v.string(), addedAt: v.number() })
    .index("by_owner_cohort", ["ownerId", "cohortId"])
    .index("by_cohort_role", ["cohortId", "role"]),
  // One member card per account (E10, #113). Opening it in a new chapter year gives it that year's number and a new
  // token; the member replacing their QR changes the token alone. Staff block a card with `revokedAt`.
  memberCards: defineTable({
    ownerId: v.string(), period: v.string(), number: v.string(), token: v.string(), issuedAt: v.number(),
    reissuedAt: v.optional(v.number()), revokedAt: v.optional(v.number()), revokedBy: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_token", ["token"])
    .index("by_number", ["number"]),
  // How many member numbers each chapter year has given out, so a number is never reused, even after a deletion.
  cardCounters: defineTable({ period: v.string(), issued: v.number() }).index("by_period", ["period"]),
  // A chapter gathering that checks in with member cards (E10, #117). `audience` uses the community tags, as on
  // assignments; `helpers` are members staff chose to run the door of this gathering only (account IDs, up to 10).
  gatherings: defineTable({
    title: v.string(), startsAt: v.number(), endsAt: v.number(), venue: v.string(), audience: v.array(memberType),
    status: gatheringStatus, helpers: v.array(v.string()), createdBy: v.string(), createdAt: v.number(), updatedAt: v.number(),
  })
    .index("by_starts", ["startsAt"])
    .index("by_status", ["status", "startsAt"]),
  // One per member and gathering. `outsideAudience` marks a guest checked in after the warning.
  checkIns: defineTable({
    gatheringId: v.id("gatherings"), ownerId: v.string(), checkedInAt: v.number(), checkedInBy: v.string(),
    method: v.union(v.literal("scan"), v.literal("manual")), outsideAudience: v.boolean(),
  })
    .index("by_gathering_owner", ["gatheringId", "ownerId"])
    .index("by_owner", ["ownerId", "checkedInAt"]),
  // A member's request for a Tech Support mentor (#92). `deadline` is the competition's WIB date (YYYY-MM-DD). The mentor
  // is a name staff type in, because mentors have no account yet; `matchedAt` is set on the first match and never cleared,
  // so a request closed without a mentor is not counted as facilitated. `note` is for handlers only.
  techSupportRequests: defineTable({
    ownerId: v.string(), competition: v.string(), competitionUrl: v.string(), deadline: v.string(),
    participation: v.union(v.literal("team"), v.literal("solo")), teamName: v.optional(v.string()),
    helpKinds: v.array(v.string()), progress: v.string(), status: techSupportStatus,
    // How handlers reach the member (#251): a WhatsApp number stored as +628… and a Discord username, if given. Optional
    // for requests sent before they were asked; `techSupport.submit` requires the number.
    whatsapp: v.optional(v.string()), discord: v.optional(v.string()),
    mentorName: v.optional(v.string()), note: v.optional(v.string()),
    submittedAt: v.number(), updatedAt: v.number(), matchedAt: v.optional(v.number()), closedAt: v.optional(v.number()), handledBy: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId", "submittedAt"])
    .index("by_submitted", ["submittedAt"]),
  // A Tech League team of one season (#183), formed by members on the league. `code` stands in for the name in anonymous
  // judging, for staff and judges only, and never changes. `inviteToken` holds the invite code (#192), shown to the captain
  // and carried by the invite link, which the captain can replace; teams made before it held a 22-character token until
  // `league.assignInviteCodes`. `captainId` is one of its members. A team whose last member leaves is deleted, unless it is
  // registered: then it stays without a captain, flagged for staff (league.removeRow). `submittedAt` is set by submissions (#180) and locks the track. `registration` is set when staff import Program & Development's registration results and the
  // captain's email matches: present means registered, `paid` whether the payment is confirmed.
  leagueTeams: defineTable({
    season: v.string(), name: v.string(), track: leagueTrack, code: v.string(), inviteToken: v.string(), captainId: v.optional(v.string()),
    submittedAt: v.optional(v.number()), createdBy: v.string(), createdAt: v.number(), updatedAt: v.number(),
    registration: v.optional(v.object({ paid: v.boolean(), importedAt: v.number(), importedBy: v.string() })),
  })
    .index("by_code", ["code"])
    .index("by_invite", ["inviteToken"])
    .index("by_season", ["season"]),
  // One member of one team; `season` is copied from the team so a member is found in at most one team per season.
  leagueTeamMembers: defineTable({ teamId: v.id("leagueTeams"), season: v.string(), ownerId: v.string(), joinedAt: v.number() })
    .index("by_team", ["teamId", "joinedAt"])
    .index("by_owner", ["ownerId", "season"]),
  // One row per access change made in the dashboard (accessLog.ts). Account IDs only: names are looked up when owners read it.
  accessLog: defineTable({
    at: v.number(), actorId: v.string(), targetId: v.string(), change: accessChange,
    // The value before and after: "admin"/"member", "on"/"off", "active"/"deactivated", a community tag as "core:Technical",
    // or a cohort role key. Enrolment changes carry the cohort and enrolment; an unclaimed one has an empty `targetId`.
    from: v.string(), to: v.string(), assignmentId: v.optional(v.id("assignments")),
    cohortId: v.optional(v.id("cohorts")), enrolmentId: v.optional(v.id("enrolments")), gatheringId: v.optional(v.id("gatherings")),
  })
    .index("by_at", ["at"])
    .index("by_target", ["targetId", "at"]),
  // One row per deleted account: who deleted it, when, and how many rows of each kind went. No personal data.
  accountDeletions: defineTable({
    deletedAt: v.number(), deletedBy: v.string(),
    counts: v.object({
      appreciations: v.number(), appreciationReviews: v.number(), submissions: v.number(), submissionReviews: v.number(),
      files: v.number(), gameRuns: v.number(), gameBests: v.number(), reviewerGrants: v.number(), sessions: v.number(), accounts: v.number(),
      // Added with cohorts; rows from before them lack these.
      enrolments: v.optional(v.number()), mentorGrants: v.optional(v.number()),
      // Added with member cards and gatherings.
      cards: v.optional(v.number()), checkIns: v.optional(v.number()), helperGrants: v.optional(v.number()),
      // Added with Tech Support requests.
      techSupportRequests: v.optional(v.number()),
      // Added with uploaded profile photos.
      photos: v.optional(v.number()),
      // Added with Tech League teams: the teams the account left.
      leagueTeams: v.optional(v.number()),
      // Added with flag tasks (#240): solves and wrong-try counts.
      flagSolves: v.optional(v.number()), flagAttempts: v.optional(v.number()),
    }),
  }).index("by_deleted", ["deletedAt"]),
});
