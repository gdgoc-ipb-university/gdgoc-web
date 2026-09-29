import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.hourly("remove unclaimed assignment uploads", { minuteUTC: 17 }, internal.assignments.cleanupUploads);
crons.daily("remove Bogor Run run records after 30 days", { hourUTC: 20, minuteUTC: 41 }, internal.bogorRun.pruneRuns); // 03:41 WIB
export default crons;
