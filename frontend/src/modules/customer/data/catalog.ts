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

/**
 * For a given date (ISO string), return only the time slots that are still
 * bookable. On today, we require at least 1 hour of lead time.
 */
export function availableSlotsForDate(dateIso: string | null): string[] {
  if (!dateIso) return TIME_SLOTS;
  const selected = new Date(dateIso);
  const now = new Date();
  const isToday = selected.toDateString() === now.toDateString();
  if (!isToday) return TIME_SLOTS;

  const nowH = now.getHours();
  const nowM = now.getMinutes();
  return TIME_SLOTS.filter((slot) => {
    const [h, m] = slotTo24h(slot);
    // Require at least 60 minutes lead time
    return h * 60 + m > nowH * 60 + nowM + 60;
  });
}

/** Next N selectable dates starting today (only include today if it has upcoming slots). */
export function upcomingDates(count = 7): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    // For today, only include if at least one slot is still open
    if (i === 0 && availableSlotsForDate(d.toISOString()).length === 0) continue;
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
