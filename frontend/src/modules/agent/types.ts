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
  distanceKm: number | null;
  coordinates?: { lat: number; lng: number } | null;
  price: number;
  payout: number;
  status: JobStatus;
  hasBefore: boolean;
  hasAfter: boolean;
  beforePhotos: string[];
  afterPhotos: string[];
};

/** A live dispatch offer pushed to the agent (Uber-style incoming request). */
export type JobOffer = {
  bookingId: string;
  customerName: string;
  vehicleType: CarType;
  vehicleName: string;
  packageName: string;
  addressLabel: string;
  addressLine: string;
  society: string;
  date: string; // ISO
  slot: string;
  price: number;
  payout: number;
  distanceKm: number | null;
  isSubscriptionWash: boolean;
  expiresAt: string; // ISO
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
  email?: string;
  role: string;
  /** Chosen from the admin-managed Locations list at signup. */
  city?: string;
  area: string;
  rating: number;
  jobsDone: number;
  online: boolean;
  // "unverified" is the state every new signup starts in, between the details
  // step and the KYC upload. Leaving it out of this union is what let a new
  // cleaner fall through every status check straight onto the dashboard.
  agentStatus: "verified" | "pending" | "suspended" | "unverified";
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

/** Where a payout gets sent. `branch`/`address` are resolved server-side from `ifsc`, never typed in. */
export type BankAccount = {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  address: string;
  verifiedAt: string;
};

/** Result of looking up an IFSC code, before it's saved as part of a bank account. */
export type IfscBranch = {
  bank: string;
  ifsc: string;
  branch: string;
  address: string;
  city?: string;
  state?: string;
};

export type PayoutRequestStatus = "pending" | "approved" | "rejected" | "paid";

export type PayoutRequest = {
  id: string;
  amount: number;
  status: PayoutRequestStatus;
  bankSnapshot: { holderName: string; bankName: string; accountNumber: string; ifsc: string; branch: string };
  rejectionReason: string;
  transactionRef: string;
  processedAt: string | null;
  createdAt: string;
};

export type WalletSummary = {
  totalEarned: number;
  reserved: number;
  available: number;
  requests: PayoutRequest[];
};

/**
 * One row in the cleaner's inbox.
 *
 * Same shape the customer app uses — the API is role-agnostic, it is only the
 * screens that differ — but declared here so the agent module doesn't import
 * types across a module boundary it otherwise never crosses.
 */
export type AgentNotification = {
  id: string;
  type: "booking" | "area_alert" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
