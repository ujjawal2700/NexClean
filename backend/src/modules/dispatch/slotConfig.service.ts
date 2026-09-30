import { SlotConfig, ISlotConfig } from "./slotConfig.model.js";
import { TIME_SLOTS } from "../../shared/slots.js";

// In-memory cache of live bookable slots for synchronous validation
let cachedSlots: string[] = [...TIME_SLOTS];

/**
 * Converts a slot string like "08:00 AM" or "02:30 PM" into total minutes from midnight (0..1439).
 */
export function slotToMinutes(slot: string): number {
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM") {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
}

/**
 * Normalizes "8:00 am" to standard "08:00 AM".
 */
export function normalizeSlot(slot: string): string {
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return slot.trim();
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  return `${hh}:${mm} ${meridiem}`;
}

/**
 * Retrieves the global slot config from DB, seeding with TIME_SLOTS if not yet created.
 */
export async function getSlotConfig(): Promise<ISlotConfig> {
  let config = await SlotConfig.findById("global");
  if (!config) {
    config = await SlotConfig.create({
      _id: "global",
      slots: [...TIME_SLOTS],
    });
  }
  cachedSlots = [...config.slots];
  return config;
}

/**
 * Updates the bookable slots, sorts them chronologically, deduplicates, and updates the in-memory cache.
 */
export async function updateSlotConfig(slots: string[]): Promise<ISlotConfig> {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error("At least one time slot is required.");
  }
  if (slots.length > 48) {
    throw new Error("Cannot configure more than 48 time slots.");
  }

  // Normalize and validate each slot
  const normalizedSet = new Set<string>();
  for (const s of slots) {
    const mins = slotToMinutes(s);
    if (mins < 0) {
      throw new Error(`Invalid time slot format: "${s}". Must be "HH:MM AM" or "HH:MM PM".`);
    }
    normalizedSet.add(normalizeSlot(s));
  }

  // Sort chronologically
  const sorted = Array.from(normalizedSet).sort((a, b) => slotToMinutes(a) - slotToMinutes(b));

  const updated = await SlotConfig.findByIdAndUpdate(
    "global",
    { slots: sorted },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  cachedSlots = [...updated.slots];
  return updated;
}

/**
 * Synchronous accessor for validators and schedulers to get live slots.
 */
export function getLiveSlots(): string[] {
  return cachedSlots.length > 0 ? cachedSlots : [...TIME_SLOTS];
}

/**
 * Initializes slot cache on server startup.
 */
export async function initSlotCache(): Promise<void> {
  try {
    const config = await SlotConfig.findById("global");
    if (config && Array.isArray(config.slots) && config.slots.length > 0) {
      cachedSlots = [...config.slots];
      console.log(`✓ Loaded ${cachedSlots.length} active booking time slots from database`);
    } else {
      await SlotConfig.findOneAndUpdate(
        { _id: "global" },
        { slots: [...TIME_SLOTS] },
        { upsert: true, setDefaultsOnInsert: true }
      );
      cachedSlots = [...TIME_SLOTS];
      console.log(`✓ Initialized booking time slots with default ${cachedSlots.length} slots`);
    }
  } catch (err) {
    console.error("Failed to load time slot config from database, using defaults:", err);
    cachedSlots = [...TIME_SLOTS];
  }
}
