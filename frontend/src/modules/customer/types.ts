import type { CarType } from "@shared/components/visual/CarSilhouette";

export type { CarType };

export type Vehicle = {
  id: string;
  type: CarType;
  /** display name, e.g. "Hyundai Creta" */
  name: string;
  brand?: string;
  model?: string;
  /** plate number */
  plate: string;
};

/** An admin-managed vehicle category — pricing is always based on this. */
export type VehicleCategory = {
  id: string;
  name: string;
  key: string;
  basePrice: number;
  sortOrder: number;
  active: boolean;
};

/** A car brand (e.g. "Hyundai") — spans many categories via its models. */
export type VehicleBrand = {
  id: string;
  name: string;
};

/** A specific model under a brand, carrying its own category. */
export type VehicleModel = {
  id: string;
  brand: string;
  name: string;
  categoryKey: string;
};

export type ServicePackage = {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  /** multiplier applied to the vehicle base price */
  factor: number;
  /** rough duration in minutes by feel */
  durationLabel: string;
};

export type Address = {
  id: string;
  label: string;
  line: string;
  society: string;
};

export type BookingStatus = "upcoming" | "completed" | "cancelled";

export type Booking = {
  id: string;
  vehicleType: CarType;
  vehicleName: string;
  packageName: string;
  date: string; // ISO date
  slot: string;
  addressLabel: string;
  addressLine: string;
  price: number;
  discountCode?: string | null;
  discountAmount?: number;
  status: BookingStatus;
  createdAt: string;
};

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  sortOrder: number;
};

export type ReferredUser = {
  id: string;
  name: string;
  joinedAt: string;
  status: string;
};

export type ReferralSummary = {
  referralCode: string | null;
  referralEarnings: number;
  rewardAmount: number;
  referredUsers: ReferredUser[];
};


export type PlanId = "basic" | "premium" | "elite";

/** A subscription plan from the catalog API, priced per vehicle type. */
export type CatalogPlan = {
  id: string;
  name: string;
  /** Per-vehicle monthly price. */
  prices: Record<CarType, number>;
  /** Cheapest vehicle price — used for "from ₹X" display. */
  price: number;
  /** Washes included per month; -1 means unlimited. */
  washesPerMonth: number;
  active: boolean;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  vehicles: Vehicle[];
  addresses: Address[];
  activePlan: PlanId | null;
  referralCode?: string | null;
  referralEarnings?: number;
};

export type AppNotification = {
  id: string;
  type: "booking" | "area_alert" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
