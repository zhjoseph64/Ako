/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cashout_admin from "../cashout/admin.js";
import type * as cashout_config from "../cashout/config.js";
import type * as cashout_oauth from "../cashout/oauth.js";
import type * as cashout_rewards from "../cashout/rewards.js";
import type * as cashout_tables from "../cashout/tables.js";
import type * as cashout_wallet from "../cashout/wallet.js";
import type * as cashout_whop from "../cashout/whop.js";
import type * as counter from "../counter.js";
import type * as http from "../http.js";
import type * as jailbreak_bossAdapters from "../jailbreak/bossAdapters.js";
import type * as jailbreak_engine from "../jailbreak/engine.js";
import type * as jailbreak_evaluator from "../jailbreak/evaluator.js";
import type * as jailbreak_roomCode from "../jailbreak/roomCode.js";
import type * as jailbreak_rooms from "../jailbreak/rooms.js";
import type * as jailbreak_tables from "../jailbreak/tables.js";
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
  "cashout/admin": typeof cashout_admin;
  "cashout/config": typeof cashout_config;
  "cashout/oauth": typeof cashout_oauth;
  "cashout/rewards": typeof cashout_rewards;
  "cashout/tables": typeof cashout_tables;
  "cashout/wallet": typeof cashout_wallet;
  "cashout/whop": typeof cashout_whop;
  counter: typeof counter;
  http: typeof http;
  "jailbreak/bossAdapters": typeof jailbreak_bossAdapters;
  "jailbreak/engine": typeof jailbreak_engine;
  "jailbreak/evaluator": typeof jailbreak_evaluator;
  "jailbreak/roomCode": typeof jailbreak_roomCode;
  "jailbreak/rooms": typeof jailbreak_rooms;
  "jailbreak/tables": typeof jailbreak_tables;
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
