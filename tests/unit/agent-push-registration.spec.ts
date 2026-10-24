import { test, expect } from "@playwright/test";
import { User } from "../../backend/src/modules/user/user.model";
import { registerToken } from "../../backend/src/modules/notification/notification.service";

test("a registration authenticated before logout cannot restore a revoked agent token", async () => {
  const original = { findById: User.findById, updateMany: User.updateMany, updateOne: User.updateOne };
  let currentVersion = 4;
  let savedTokens: string[] = [];
  try {
    User.findById = (() => ({ select: async () => ({ role: "agent", status: "active", tokenVersion: 4, agentDeviceId: "old-phone" }) })) as any;
    // Logout/switch wins while the registration request is still in flight.
    User.updateMany = (async () => { currentVersion++; return { matchedCount: 0 }; }) as any;
    User.updateOne = (async (filter: any, update: any) => {
      expect(filter.agentDeviceId).toBe("old-phone");
      const matchedCount = filter.tokenVersion === currentVersion ? 1 : 0;
      if (matchedCount) savedTokens = update.$set.deviceTokens;
      return { matchedCount };
    }) as any;
    await expect(registerToken("agent", "old-phone-fcm-token", "old-phone", 4)).rejects.toMatchObject({ statusCode: 401 });
    expect(savedTokens).toEqual([]);
  } finally {
    Object.assign(User, original);
  }
});

test("an agent fallback cannot overwrite a native token, even if its request arrives later", async () => {
  const original = { findById: User.findById, updateMany: User.updateMany, updateOne: User.updateOne };
  const writes: unknown[] = [];
  try {
    User.findById = (() => ({ select: async () => ({ role: "agent", status: "active", tokenVersion: 4, agentDeviceId: "phone" }) })) as any;
    User.updateMany = (async (...args: unknown[]) => { writes.push(args); return { matchedCount: 1 }; }) as any;
    User.updateOne = (async (...args: unknown[]) => { writes.push(args); return { matchedCount: 1 }; }) as any;
    await registerToken("agent", "native-real-fcm-token", "phone", 4);
    expect(writes).toHaveLength(2);
    writes.length = 0;
    await expect(registerToken("agent", "web-placeholder-token", "phone", 4)).rejects.toMatchObject({ statusCode: 400 });
    expect(writes).toHaveLength(0);
  } finally { Object.assign(User, original); }
});
