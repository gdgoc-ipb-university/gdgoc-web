import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.hourly("remove unclaimed assignment uploads", { minuteUTC: 17 }, internal.assignments.cleanupUploads);
export default crons;
