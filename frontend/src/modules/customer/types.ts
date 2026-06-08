import type { CarType } from "@shared/components/visual/CarSilhouette";

export type { CarType };

export type Vehicle = {
  id: string;
  type: CarType;
  /** display name, e.g. "Hyundai Creta" */
  name: string;
  /** plate number */
  plate: string;
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
  status: BookingStatus;
  createdAt: string;
};

export type PlanId = "basic" | "premium" | "elite";
