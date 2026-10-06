import type { Model } from "mongoose";
import { Notification } from "./notification.model";
import { Campaign } from "../admin/campaign.model";
import { TriggeredAlert } from "../area-alert/areaAlert.model";

/**
 * How long notification records are kept before MongoDB deletes them on its
 * own. Covers everything notification-shaped the app stores:
 *  - Notification    — every customer's / cleaner's in-app feed (each push sent
 *                      through notifyUser is also saved here)
 *  - Campaign        — the admin's history of push campaigns sent
 *  - TriggeredAlert  — the log of Smart Area Alert pushes
 * Pushes sent with pushToUser alone (job offers, live updates) are never
 * stored, so there is nothing of theirs to clear.
 *
 * Override with NOTIFICATION_RETENTION_DAYS; defaults to one week.
 */
export const NOTIFICATION_RETENTION_DAYS = (() => {
  const days = Number(process.env.NOTIFICATION_RETENTION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 7;
})();

const RETENTION_SECONDS = Math.round(NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60);
const INDEX_NAME = "createdAt_ttl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLLECTIONS: Model<any>[] = [Notification, Campaign, TriggeredAlert];

/**
 * Puts a TTL index on `createdAt` for each notification collection, so
 * MongoDB's background TTL monitor (runs about once a minute) deletes records
 * older than the retention window. Done explicitly rather than declared on the
 * schemas because Mongoose can create a TTL index but never change one: if the
 * retention period changes, the existing index has to be updated in place with
 * collMod, which this does. The first run also clears the backlog of records
 * that are already older than the window.
 */
export async function ensureNotificationRetention(): Promise<void> {
  for (const model of COLLECTIONS) {
    const collection = model.collection;
    try {
      const indexes = await collection.indexes().catch(() => []);
      const existing = indexes.find((i) => i.name === INDEX_NAME);
      if (!existing) {
        await collection.createIndex({ createdAt: 1 }, { name: INDEX_NAME, expireAfterSeconds: RETENTION_SECONDS });
      } else if (existing.expireAfterSeconds !== RETENTION_SECONDS) {
        const db = model.db.db;
        if (!db) throw new Error("database not connected");
        await db.command({
          collMod: collection.collectionName,
          index: { name: INDEX_NAME, expireAfterSeconds: RETENTION_SECONDS },
        });
      }
    } catch (err) {
      console.error(`notification retention on ${collection.collectionName} failed:`, (err as Error).message);
    }
  }
  console.log(`🧹 Notifications auto-delete after ${NOTIFICATION_RETENTION_DAYS} day(s)`);
}
