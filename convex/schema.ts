import { defineSchema } from "convex/server";

import { jailbreakTables } from "./jailbreak/tables";
import { platformTables } from "./platform/tables";
import { unpredictableTables } from "./unpredictable/tables";

export default defineSchema({
  ...unpredictableTables,
  ...jailbreakTables,
  ...platformTables,
});
