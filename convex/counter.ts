import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "ping"))
      .unique();
    return counter?.value ?? 0;
  },
});

export const increment = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "ping"))
      .unique();
    if (counter === null) {
      await ctx.db.insert("counters", { name: "ping", value: 1 });
      return 1;
    }
    await ctx.db.patch(counter._id, { value: counter.value + 1 });
    return counter.value + 1;
  },
});
