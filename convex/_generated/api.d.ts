/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as counter from "../counter.js";
import type * as unpredictable_ai from "../unpredictable/ai.js";
import type * as unpredictable_crowd from "../unpredictable/crowd.js";
import type * as unpredictable_game from "../unpredictable/game.js";
import type * as unpredictable_llm from "../unpredictable/llm.js";
import type * as unpredictable_memory from "../unpredictable/memory.js";
import type * as unpredictable_seed from "../unpredictable/seed.js";
import type * as unpredictable_tables from "../unpredictable/tables.js";
import type * as unpredictable_text from "../unpredictable/text.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  counter: typeof counter;
  "unpredictable/ai": typeof unpredictable_ai;
  "unpredictable/crowd": typeof unpredictable_crowd;
  "unpredictable/game": typeof unpredictable_game;
  "unpredictable/llm": typeof unpredictable_llm;
  "unpredictable/memory": typeof unpredictable_memory;
  "unpredictable/seed": typeof unpredictable_seed;
  "unpredictable/tables": typeof unpredictable_tables;
  "unpredictable/text": typeof unpredictable_text;
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

export declare const components: {};
