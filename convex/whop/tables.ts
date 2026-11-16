import { defineTable } from "convex/server";
import { v } from "convex/values";

export const whopTables = {
  whopPayments: defineTable({
    paymentId: v.string(),
    deviceId: v.string(),
    pack: v.string(),
    tokens: v.number(),
    createdAt: v.number(),
  })
    .index("by_paymentId", ["paymentId"])
    .index("by_deviceId_and_createdAt", ["deviceId", "createdAt"]),
};
