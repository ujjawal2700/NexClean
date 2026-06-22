/**
 * Server-side source of truth for pricing & plans.
 * Mirrors the frontend catalog; the booking service computes prices from here
 * so clients can never tamper with the amount charged.
 */
export const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "luxury", "premium"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const BASE_PRICE: Record<VehicleType, number> = {
  hatchback: 299,
  sedan: 399,
  suv: 499,
  luxury: 699,
  premium: 899,
};

export type ServicePackage = {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  factor: number;
  durationLabel: string;
};

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

/** Per-vehicle monthly price for a plan. -1 washesPerMonth = unlimited. */
export type PlanPrices = Record<VehicleType, number>;

export const PLANS = [
  {
    id: "basic",
    name: "Basic",
    washesPerMonth: 4,
    prices: { hatchback: 999, sedan: 1199, suv: 1399, luxury: 1799, premium: 2199 },
  },
  {
    id: "premium",
    name: "Premium",
    washesPerMonth: 8,
    prices: { hatchback: 1799, sedan: 2099, suv: 2499, luxury: 2999, premium: 3499 },
  },
  {
    id: "elite",
    name: "Elite",
    washesPerMonth: -1,
    prices: { hatchback: 2999, sedan: 3499, suv: 3999, luxury: 4999, premium: 5999 },
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export function getPackage(id: string): ServicePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

export function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(value);
}

/** Final price for a vehicle + package, rounded to the nearest ₹10. */
export function priceFor(vehicle: VehicleType, pkg: ServicePackage): number {
  return Math.round((BASE_PRICE[vehicle] * pkg.factor) / 10) * 10;
}
