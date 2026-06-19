import type { CarType } from "@shared/components/visual/CarSilhouette";

export type { CarType };

export const VEHICLE_LABEL: Record<CarType, string> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  luxury: "Luxury",
  premium: "Premium",
};

/** Lifecycle of a job from the agent's perspective. */
export type JobStatus = "assigned" | "enroute" | "arrived" | "in_progress" | "completed";

export const STATUS_FLOW: JobStatus[] = [
  "assigned",
  "enroute",
  "arrived",
  "in_progress",
  "completed",
];

export const STATUS_LABEL: Record<JobStatus, string> = {
  assigned: "Assigned",
  enroute: "On the way",
  arrived: "Arrived",
  in_progress: "Cleaning",
  completed: "Completed",
};

/** Label for the button that advances to the next status. */
export const NEXT_ACTION: Partial<Record<JobStatus, string>> = {
  assigned: "Start — I'm on my way",
  enroute: "I've arrived",
  arrived: "Start cleaning",
  in_progress: "Mark complete",
};

export type Job = {
  id: string;
  customerName: string;
  vehicleType: CarType;
  vehicleName: string;
  packageName: string;
  date: string; // ISO
  slot: string;
  addressLabel: string;
  addressLine: string;
  society: string;
  distanceKm: number;
  price: number;
  payout: number;
  status: JobStatus;
  hasBefore: boolean;
  hasAfter: boolean;
};

export type AreaAlert = {
  id: string;
  society: string;
  sentCount: number;
  createdAt: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  phone: string;
  role: string;
  area: string;
  rating: number;
  jobsDone: number;
  online: boolean;
  agentStatus: "verified" | "pending" | "suspended";
  aadharNumber?: string;
  aadharFrontUrl?: string;
  aadharBackUrl?: string;
};

export type AgentSummary = {
  jobsToday: number;
  completedToday: number;
  earnedToday: number;
  potentialToday: number;
};
