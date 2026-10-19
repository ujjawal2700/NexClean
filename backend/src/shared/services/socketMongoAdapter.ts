import type { Server } from "socket.io";
import type { Db } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";

/** Reuse the application's Atlas connection; no separate service or credentials. */
export async function attachMongoSocketAdapter(io: Server, db: Db): Promise<void> {
  const collection = db.collection("socket_io_events");
  // TTL works on Atlas tiers that do not support capped collections. Retain
  // event documents for a minute; MongoDB removes them asynchronously.
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 });

  // Check change-stream support and permissions before claiming readiness.
  // A standalone local mongod cannot relay events using this adapter.
  const probe = collection.watch([], { maxAwaitTimeMS: 100 });
  try {
    await probe.tryNext();
  } finally {
    await probe.close();
  }

  io.adapter(createAdapter(collection, {
    addCreatedAtField: true,
    changeStreamOptions: { maxAwaitTimeMS: 1000 },
  }));
}
