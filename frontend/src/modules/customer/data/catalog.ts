import type { ServicePackage, Address, Vehicle } from "../types";

export const PACKAGES: ServicePackage[] = [
  {
    id: "express",
    name: "Express Wash",
    tagline: "A quick, spotless refresh.",
    features: ["Exterior foam wash", "Wheel & tyre clean", "Glass & mirrors", "Hand dry"],
    factor: 1,
    durationLabel: "~45 min",
  },
  {
    id: "premium",
    name: "Premium Detail",
    tagline: "Inside and out, like new.",
    features: ["Everything in Express", "Interior vacuum", "Dashboard polish", "Seat wipe-down"],
    factor: 1.6,
    durationLabel: "~75 min",
  },
  {
    id: "ultimate",
    name: "Ultimate Detail",
    tagline: "Showroom-grade perfection.",
    features: ["Everything in Premium", "Wax & paint protect", "Deep interior detail", "Tyre dressing"],
    factor: 2.3,
    durationLabel: "~120 min",
  },
];

/** Final price for a package given the vehicle category's base price, rounded to the nearest ₹10. */
export function priceFor(basePrice: number, pkg: ServicePackage): number {
  return Math.round((basePrice * pkg.factor) / 10) * 10;
}

/**
 * Offline fallback only. The live list is admin-managed (Admin → Time Slots)
 * and comes from useTimeSlots(); pass it to the helpers below.
 */
export const TIME_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

/** Parse a slot string like "05:00 PM" into [hour, minute] in 24h format. */
function slotTo24h(slot: string): [number, number] {
  const [timePart, meridiem] = slot.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  const hour = meridiem === "PM" && h !== 12 ? h + 12 : meridiem === "AM" && h === 12 ? 0 : h;
  return [hour, m];
}

/** Offline fallback for the admin-set booking notice (minutes). */
export const DEFAULT_LEAD_MINUTES = 60;

/**
 * For a given date (ISO string), return only the time slots that are still
 * bookable. On today, a slot must start at least `leadMinutes` from now — the
 * notice the admin sets on the Time Slots page (useSlotLeadMinutes()).
 */
export function availableSlotsForDate(
  dateIso: string | null,
  slots: string[] = TIME_SLOTS,
  leadMinutes: number = DEFAULT_LEAD_MINUTES,
): string[] {
  if (!dateIso) return slots;
  const selected = new Date(dateIso);
  const now = new Date();
  const isToday = selected.toDateString() === now.toDateString();
  if (!isToday) return slots;

  const nowH = now.getHours();
  const nowM = now.getMinutes();
  return slots.filter((slot) => {
    const [h, m] = slotTo24h(slot);
    return h * 60 + m >= nowH * 60 + nowM + leadMinutes;
  });
}

/** Next N selectable dates starting today (only include today if it has upcoming slots). */
export function upcomingDates(
  count = 7,
  slots: string[] = TIME_SLOTS,
  leadMinutes: number = DEFAULT_LEAD_MINUTES,
): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    // For today, only include if at least one slot is still open
    if (i === 0 && availableSlotsForDate(d.toISOString(), slots, leadMinutes).length === 0) continue;
    out.push(d);
  }
  // Always return `count` total days (fill from the end if today was skipped)
  if (out.length < count) {
    const last = out[out.length - 1] ?? base;
    const extra = new Date(last);
    extra.setDate(last.getDate() + 1);
    out.push(extra);
  }
  return out;
}

/** Seed data so a fresh customer account already feels populated. */
export const SEED_VEHICLES: Vehicle[] = [
  { id: "v1", type: "suv", name: "Hyundai Creta", plate: "GJ 01 AB 1234" },
  { id: "v2", type: "hatchback", name: "Maruti Swift", plate: "GJ 05 CD 5678" },
];

export const SEED_ADDRESSES: Address[] = [
  { id: "a1", label: "Home", line: "B-402, Green Valley Society", society: "Green Valley Society" },
  { id: "a2", label: "Office", line: "Tower 3, Tech Park, Sector 21", society: "Tech Park" },
];
