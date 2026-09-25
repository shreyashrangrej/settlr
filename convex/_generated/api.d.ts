/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as budgets from "../budgets.js";
import type * as email from "../email.js";
import type * as friends from "../friends.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_friendship from "../lib/friendship.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_receipts from "../lib/receipts.js";
import type * as lib_validators from "../lib/validators.js";
import type * as notifications from "../notifications.js";
import type * as personal from "../personal.js";
import type * as receipts from "../receipts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  budgets: typeof budgets;
  email: typeof email;
  friends: typeof friends;
  groups: typeof groups;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/friendship": typeof lib_friendship;
  "lib/input": typeof lib_input;
  "lib/ledger": typeof lib_ledger;
  "lib/notify": typeof lib_notify;
  "lib/receipts": typeof lib_receipts;
  "lib/validators": typeof lib_validators;
  notifications: typeof notifications;
  personal: typeof personal;
  receipts: typeof receipts;
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
