import type { ServicePackage, Address, Vehicle } from "../types";
export declare const PACKAGES: ServicePackage[];
/** Final price for a package given the vehicle category's base price, rounded to the nearest ₹10. */
export declare function priceFor(basePrice: number, pkg: ServicePackage): number;
export declare const TIME_SLOTS: string[];
/** Next N selectable dates starting today. */
export declare function upcomingDates(count?: number): Date[];
/** Seed data so a fresh customer account already feels populated. */
export declare const SEED_VEHICLES: Vehicle[];
export declare const SEED_ADDRESSES: Address[];
