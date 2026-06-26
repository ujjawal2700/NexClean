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
];

/** Next N selectable dates starting today. */
export function upcomingDates(count = 7): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
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
