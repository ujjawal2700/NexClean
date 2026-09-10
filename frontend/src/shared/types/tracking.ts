/** Shapes shared by the customer, agent and admin tracking surfaces. */

export type JobStatus = "assigned" | "enroute" | "arrived" | "in_progress" | "completed";

export type DispatchStatus =
  | "scheduled"
  | "searching"
  | "offered"
  | "assigned"
  | "pending_admin"
  | "cancelled";

export type LiveFix = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
};

export type TrackedAgent = {
  id: string;
  name: string;
  phone: string | null;
  rating: number;
  jobsDone: number;
};

/** Everything a tracking screen needs to paint itself without a live socket. */
export type TrackingSnapshot = {
  bookingId: string;
  status: "upcoming" | "completed" | "cancelled";
  dispatchStatus: DispatchStatus;
  jobStatus: JobStatus;
  /** Whether a cleaner is currently in the field for this booking. */
  trackable: boolean;
  packageName: string;
  vehicleName: string;
  vehicleType: string;
  price: number;
  date: string;
  slot: string;
  addressLabel: string;
  addressLine: string;
  society: string;
  createdAt: string;
  assignedAt: string | null;
  offerExpiresAt: string | null;
  dispatchAttempts: number;
  searchRadiusM: number;
  destination: { lat: number; lng: number } | null;
  customerName: string;
  customerPhone: string | null;
  agent: TrackedAgent | null;
  agentLocation: LiveFix | null;
  distanceM: number | null;
  etaMinutes: number | null;
  beforePhotos?: string[];
  afterPhotos?: string[];
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

/** One agent's current position, independent of any specific booking. */
export type AgentLocationSnapshot = {
  agentId: string;
  name: string;
  online: boolean;
  agentLocation: LiveFix | null;
};

/** One in-flight job on the admin fleet map. */
export type FleetJob = {
  bookingId: string;
  agentId: string;
  agentName: string;
  customerName: string;
  jobStatus: JobStatus;
  packageName: string;
  addressLabel: string;
  destination: { lat: number; lng: number } | null;
  agentLocation: LiveFix | null;
  distanceM: number | null;
  etaMinutes: number | null;
};

/** Socket payload broadcast on every accepted GPS fix. */
export type AgentLocationEvent = LiveFix & {
  bookingId?: string;
  agentId: string;
  bookingIds?: string[];
};

/** Socket payload broadcast whenever a booking changes phase. */
export type BookingProgressEvent = {
  bookingId: string;
  jobStatus: JobStatus;
  dispatchStatus: DispatchStatus;
  status: "upcoming" | "completed" | "cancelled";
  agentName: string | null;
  at: string;
};

/** Socket payload broadcast while dispatch is still hunting for a cleaner. */
export type DispatchProgressEvent = {
  bookingId: string;
  dispatchStatus: DispatchStatus;
  dispatchAttempts: number;
  searchRadiusM: number;
  at: string;
};
