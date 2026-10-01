import { SlotConfig } from "./slotConfig.model";
import {
  TIME_SLOTS,
  MAX_SLOTS,
  getLiveSlots,
  setLiveSlots,
  slotToMinutes,
  normalizeSlot,
} from "../../shared/slots";

/**
 * How often each instance re-reads the slot list. The validators need the list
 * synchronously, so it lives in an in-memory cache; the instance that handles a
 * save updates its own cache at once, and every other PM2 worker picks the
 * change up within this window.
 */
const REFRESH_MS = 30 * 1000;

let refreshHandle: NodeJS.Timeout | null = null;

/** Normalizes, validates, de-duplicates and sorts an admin-supplied list. */
export function cleanSlots(slots: string[]): string[] {
  if (slots.length === 0) throw new Error("At least one time slot is required.");
  const unique = new Set<string>();
  for (const s of slots) {
    if (slotToMinutes(s) < 0) {
      throw new Error(`"${s}" is not a valid time. Use the format 08:00 AM.`);
    }
    unique.add(normalizeSlot(s));
  }
  if (unique.size > MAX_SLOTS) throw new Error(`You can configure at most ${MAX_SLOTS} time slots.`);
  return [...unique].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
}

/** Re-reads the list from the database. Keeps the current cache if the read fails. */
export async function refreshSlotCache(): Promise<void> {
  const doc = await SlotConfig.findById("global").select("slots").lean();
  setLiveSlots(doc?.slots?.length ? doc.slots : TIME_SLOTS);
}

export function startSlotCacheRefresh(): void {
  if (refreshHandle) return;
  refreshHandle = setInterval(() => {
    refreshSlotCache().catch((err) => console.error("slot refresh failed:", (err as Error).message));
  }, REFRESH_MS);
  refreshHandle.unref();
}

export function stopSlotCacheRefresh(): void {
  if (refreshHandle) clearInterval(refreshHandle);
  refreshHandle = null;
}

export async function getSlotConfig(): Promise<{ slots: string[]; defaults: string[]; maxSlots: number }> {
  await refreshSlotCache();
  return { slots: [...getLiveSlots()], defaults: [...TIME_SLOTS], maxSlots: MAX_SLOTS };
}

/**
 * Replaces the bookable slots. Existing bookings keep whatever slot they were
 * made with — removing a slot only stops new bookings and reschedules into it.
 */
export async function updateSlotConfig(slots: string[]) {
  const cleaned = cleanSlots(slots);
  await SlotConfig.findByIdAndUpdate("global", { $set: { slots: cleaned } }, { upsert: true });
  setLiveSlots(cleaned);
  return getSlotConfig();
}
