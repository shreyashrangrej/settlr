/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistant from "../assistant.js";
import type * as auth from "../auth.js";
import type * as budgets from "../budgets.js";
import type * as chats from "../chats.js";
import type * as crons from "../crons.js";
import type * as digest from "../digest.js";
import type * as email from "../email.js";
import type * as expenses from "../expenses.js";
import type * as exports from "../exports.js";
import type * as friends from "../friends.js";
import type * as fx from "../fx.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as inbox from "../inbox.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_assistantTools from "../lib/assistantTools.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_expenseView from "../lib/expenseView.js";
import type * as lib_extract from "../lib/extract.js";
import type * as lib_friendship from "../lib/friendship.js";
import type * as lib_groupSplit from "../lib/groupSplit.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_profile from "../lib/profile.js";
import type * as lib_receipts from "../lib/receipts.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mcp from "../mcp.js";
import type * as notifications from "../notifications.js";
import type * as notifyEmail from "../notifyEmail.js";
import type * as personal from "../personal.js";
import type * as profiles from "../profiles.js";
import type * as receipts from "../receipts.js";
import type * as recurring from "../recurring.js";
import type * as scan from "../scan.js";
import type * as trash from "../trash.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assistant: typeof assistant;
  auth: typeof auth;
  budgets: typeof budgets;
  chats: typeof chats;
  crons: typeof crons;
  digest: typeof digest;
  email: typeof email;
  expenses: typeof expenses;
  exports: typeof exports;
  friends: typeof friends;
  fx: typeof fx;
  groups: typeof groups;
  http: typeof http;
  imports: typeof imports;
  inbox: typeof inbox;
  "lib/activity": typeof lib_activity;
  "lib/assistantTools": typeof lib_assistantTools;
  "lib/auth": typeof lib_auth;
  "lib/expenseView": typeof lib_expenseView;
  "lib/extract": typeof lib_extract;
  "lib/friendship": typeof lib_friendship;
  "lib/groupSplit": typeof lib_groupSplit;
  "lib/input": typeof lib_input;
  "lib/ledger": typeof lib_ledger;
  "lib/notify": typeof lib_notify;
  "lib/openrouter": typeof lib_openrouter;
  "lib/profile": typeof lib_profile;
  "lib/receipts": typeof lib_receipts;
  "lib/tokens": typeof lib_tokens;
  "lib/validators": typeof lib_validators;
  mcp: typeof mcp;
  notifications: typeof notifications;
  notifyEmail: typeof notifyEmail;
  personal: typeof personal;
  profiles: typeof profiles;
  receipts: typeof receipts;
  recurring: typeof recurring;
  scan: typeof scan;
  trash: typeof trash;
  usage: typeof usage;
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
