import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { cashoutTables } from "./cashout/tables";
import { jailbreakTables } from "./jailbreak/tables";
import { unpredictableTables } from "./unpredictable/tables";

export default defineSchema({
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),
  ...unpredictableTables,
  ...jailbreakTables,
  ...cashoutTables,
});
