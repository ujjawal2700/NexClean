import type { CarType } from "@shared/components/visual/CarSilhouette";

export type { CarType };

export const VEHICLE_LABEL: Record<CarType, string> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  luxury: "Luxury",
  premium: "Premium",
};

export const VEHICLE_TYPES: CarType[] = ["hatchback", "sedan", "suv", "luxury", "premium"];

export type BookingStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

export type AdminBooking = {
  id: string;
  customerName: string;
  vehicleType: CarType;
  vehicleName: string;
  packageName: string;
  date: string;
  slot: string;
  society: string;
  price: number;
  status: BookingStatus;
  agentName: string | null;
};

export type AgentStatus = "verified" | "pending" | "suspended";

export type AdminAgent = {
  id: string;
  name: string;
  phone: string;
  area: string;
  rating: number;
  jobsDone: number;
  online: boolean;
  status: AgentStatus;
  aadharNumber: string;
  aadharFrontUrl: string;
  aadharBackUrl: string;
};

export type Pricing = {
  base: Record<CarType, number>;
  packages: { id: string; name: string; factor: number }[];
};

export type AlertSettings = {
  enabled: boolean;
  radiusKm: number;
  windowMinutes: number;
  title: string;
  body: string;
};

export type TriggeredAlert = {
  id: string;
  society: string;
  agentName: string;
  sentCount: number;
  createdAt: string;
};

export type Campaign = {
  id: string;
  title: string;
  body: string;
  audience: string;
  sentCount: number;
  createdAt: string;
};

export type AdminPlan = {
  id: string;
  name: string;
  price: number;
  subscribers: number;
};

export type AdminStats = {
  revenue: number;
  activeBookings: number;
  agentsOnline: number;
  agentsTotal: number;
  alertsTriggered: number;
};
