import { test, expect } from "@playwright/test";
import type { Server } from "../../backend/node_modules/socket.io";
import type { Db } from "../../backend/node_modules/mongodb";
import { attachMongoSocketAdapter } from "../../backend/src/shared/services/socketMongoAdapter";

for (const failure of ["index permission denied", "change streams unavailable"]) {
  test(`MongoDB adapter initialization fails visibly when ${failure}`, async () => {
    let attached = false;
    let closed = false;
    const collection = {
      createIndex: async () => {
        if (failure.startsWith("index")) throw new Error(failure);
      },
      watch: () => ({
        tryNext: async () => { throw new Error(failure); },
        close: async () => { closed = true; },
      }),
    };
    const db = { collection: () => collection } as unknown as Db;
    const io = { adapter: () => { attached = true; } } as unknown as Server;
    await expect(attachMongoSocketAdapter(io, db)).rejects.toThrow(failure);
    expect(attached).toBe(false);
    if (failure.startsWith("change")) expect(closed).toBe(true);
  });
}
