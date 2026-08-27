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
  imageUrl?: string;
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
  /** GeoJSON [lng, lat], present when captured from Google Places. */
  coordinates?: [number, number];
  placeId?: string;
};

export type BookingStatus = "upcoming" | "completed" | "cancelled";

export type DispatchStatus =
  | "scheduled"
  | "searching"
  | "offered"
  | "assigned"
  | "pending_admin"
  | "cancelled";

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
  coinsRedeemed?: number;
  coinDiscount?: number;
  status: BookingStatus;
  dispatchStatus?: DispatchStatus;
  agentName?: string | null;
  isSubscriptionWash?: boolean;
  beforePhotos?: string[];
  afterPhotos?: string[];
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  createdAt: string;
};

export type BannerType = "promotional" | "discount" | "off-peak-hours" | "announcement";

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  type: BannerType;
  sortOrder: number;
};

/** 0 = Sunday, matching JS Date#getDay. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type OffPeakWindow = {
  day: WeekdayIndex;
  /** 24-hour "HH:MM" in the config's timezone. */
  start: string;
  end: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export type OffPeakHoursConfig = {
  timezone: string;
  active: boolean;
  windows: OffPeakWindow[];
};

export type ReferredUser = {
  id: string;
  name: string;
  joinedAt: string;
  status: string;
};

export type ReferralSummary = {
  referralCode: string | null;
  coins: number;
  coinsPerRupee: number;
  rewardAmount: number;
  refereeReward: number;
  programActive: boolean;
  referredUsers: ReferredUser[];
};

export type WalletTransaction = {
  id: string;
  type: "referral_welcome" | "referral_reward" | "redeem";
  coins: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
};

export type Wallet = {
  coins: number;
  coinsPerRupee: number;
  rupeeValue: number;
  transactions: WalletTransaction[];
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
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  referralCode?: string | null;
  coins?: number;
  createdAt?: string;
};

export type AppNotification = {
  id: string;
  type: "booking" | "area_alert" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  // Deep-link hint the backend attaches to booking-flow events (assignment,
  // status updates, reminders) — see resolveNotificationPath.
  data?: Record<string, string>;
};

export type SubscriptionScheduleResponse = {
  activePlan: CatalogPlan | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  bookings: Booking[];
};

export type SupportTicket = {
  id: string;
  user: string | User;
  status: "open" | "closed";
  assignedAgent?: string | User | null;
  subject: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  ticket: string;
  sender: string;
  senderType: "customer" | "staff";
  text: string;
  createdAt: string;
};

export type SupportConfig = {
  manualSupportStatus: "auto" | "online" | "offline";
  isOnline: boolean;
};
