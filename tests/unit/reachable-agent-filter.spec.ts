import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import { User } from "../../backend/src/modules/user/user.model";
import { reachableAgentFilter } from "../../backend/src/modules/user/presence";

// Production enables strictQuery (backend/src/config/db.ts). Under it, the old
// `deviceTokens: { $elemMatch: { $not: /^web-/ } }` was cast to an empty
// `$elemMatch: {}`, so an online cleaner whose app was closed was never offered
// a job even with a valid push token. Guard the cast filter, not just the source.
test("reachable-agent filter keeps the real-push-token condition under strictQuery", () => {
  const previous = mongoose.get("strictQuery");
  mongoose.set("strictQuery", true);
  try {
    const query = User.find(reachableAgentFilter(0));
    query.cast();
    const tokenClause = (query.getFilter().$or as Record<string, unknown>[]).find((c) => "deviceTokens" in c);
    const condition = tokenClause?.deviceTokens;
    expect(condition).toBeInstanceOf(RegExp);
    const regex = condition as RegExp;
    expect(regex.test("fcm-real-device-token")).toBe(true);
    expect(regex.test("web-1234-placeholder")).toBe(false);
    expect(regex.test("")).toBe(false);
  } finally {
    mongoose.set("strictQuery", previous);
  }
});
