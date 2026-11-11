/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accessLog from "../accessLog.js";
import type * as appreciations from "../appreciations.js";
import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as bogorRun from "../bogorRun.js";
import type * as bogorRunToken from "../bogorRunToken.js";
import type * as cards from "../cards.js";
import type * as cohorts from "../cohorts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as discord from "../discord.js";
import type * as discordLinks from "../discordLinks.js";
import type * as flags from "../flags.js";
import type * as gatherings from "../gatherings.js";
import type * as http from "../http.js";
import type * as league from "../league.js";
import type * as members from "../members.js";
import type * as photos from "../photos.js";
import type * as techSupport from "../techSupport.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  accessLog: typeof accessLog;
  appreciations: typeof appreciations;
  assignments: typeof assignments;
  auth: typeof auth;
  bogorRun: typeof bogorRun;
  bogorRunToken: typeof bogorRunToken;
  cards: typeof cards;
  cohorts: typeof cohorts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  discord: typeof discord;
  discordLinks: typeof discordLinks;
  flags: typeof flags;
  gatherings: typeof gatherings;
  http: typeof http;
  league: typeof league;
  members: typeof members;
  photos: typeof photos;
  techSupport: typeof techSupport;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
