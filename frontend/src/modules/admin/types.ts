import type { CarType } from "@shared/components/visual/CarSilhouette";

export type { CarType };

/** An admin-managed vehicle category (replaces the old fixed hatchback/sedan/... list). */
export type VehicleCategory = {
  id: string;
  name: string;
  key: string;
  imageUrl?: string;
  basePrice: number;
  sortOrder: number;
  active: boolean;
};

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
  dispatchStatus?: DispatchStatus;
  agentName: string | null;
  assignedAgentId: string | null;
  /** Booked into a quiet slot with an off-peak coupon — moving it to a peak slot costs money. */
  offPeakLocked: boolean;
  /** The subsidy that would be reclaimed on such a move, in rupees. */
  offPeakDiscountAmount: number;
};

/** One booking, in full — what the admin booking detail page renders. */
export type AdminBookingDetail = {
  id: string;
  status: BookingStatus;
  rawStatus: "upcoming" | "completed" | "cancelled";
  jobStatus: "assigned" | "enroute" | "arrived" | "in_progress" | "completed";
  dispatchStatus: DispatchStatus;
  /** A cleaner is in the field right now — show the live map rather than the record. */
  isLive: boolean;
  customer: { id: string | null; name: string; phone: string | null; email: string | null };
  agent: { id: string | null; name: string; phone: string | null; email: string | null } | null;
  vehicleType: string;
  vehicleName: string;
  packageName: string;
  isSubscriptionWash: boolean;
  date: string;
  slot: string;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  addressLabel: string;
  addressLine: string;
  society: string;
  serviceLocation: { lat: number; lng: number } | null;
  price: number;
  discountCode: string | null;
  discountAmount: number;
  coinsRedeemed: number;
  coinDiscount: number;
  offPeakLocked: boolean;
  offPeakDiscountAmount: number;
  peakUpgradeFeeCharged: number;
  upgradeWaivedAmount: number;
  totalAmount: number;
  /** null when no cleaner is assigned yet. Provisional until agentShareSettled. */
  agentShare: number | null;
  /** True once the job completed and the payout was frozen. */
  agentShareSettled: boolean;
  beforePhotos: string[];
  afterPhotos: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  rescheduleCount: number;
  customerRescheduleCount: number;
  autoRescheduled: boolean;
};

export type DispatchStatus =
  | "scheduled"
  | "searching"
  | "offered"
  | "assigned"
  | "in_progress"
  | "pending_admin"
  | "cancelled";

/** A booking currently moving through (or stuck in) the real-time dispatch pipeline. */
export type DispatchQueueItem = {
  id: string;
  customerName: string;
  vehicleName: string;
  packageName: string;
  date: string;
  slot: string;
  society: string;
  addressLine: string;
  price: number;
  dispatchStatus: DispatchStatus;
  agentName: string | null;
  isSubscriptionWash: boolean;
  hasLocation: boolean;
  dispatchAttempts: number;
  offerExpiresAt: string | null;
  currentOfferAgentName: string | null;
};

/** A cleaner the admin can assign to a booking, ranked by distance when known. */
export type AssignableAgent = {
  id: string;
  name: string;
  area: string;
  distanceKm: number | null;
  online: boolean;
};

export type AgentStatus = "verified" | "pending" | "suspended";

export type AdminAgent = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  area: string;
  rating: number;
  jobsDone: number;
  online: boolean;
  status: AgentStatus;
  aadharNumber: string;
  aadharFrontUrl: string;
  aadharBackUrl: string;
  joinedAt: string;
};

export type AdminAgentDetail = AdminAgent & {
  totalBookings: number;
  completedJobs: number;
  cancelledJobs: number;
  totalEarnings: number;
};

export type AgentActivity = {
  bookings: AdminBooking[];
};

export type PricingPackage = {
  id: string;
  name: string;
  factor: number;
  durationMinutes: number | null;
  active: boolean;
};

export type Pricing = {
  base: Record<CarType, number>;
  packages: PricingPackage[];
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
  pushDelivered: number;
  inAppOnly: number;
  createdAt: string;
};

export type AudienceSizes = Record<string, number>;

/** Campaign audiences grouped by the app they reach ("Customers", "Agents"). */
export type AudienceGroup = { label: string; audiences: string[] };

export type PlanPrices = Record<CarType, number>;

export type AdminPlan = {
  id: string;
  name: string;
  /** Per-vehicle monthly price. */
  prices: PlanPrices;
  /** Cheapest vehicle price — used for "from ₹X" display and MRR estimates. */
  price: number;
  washesPerMonth: number;
  active: boolean;
  subscribers: number;
};

export type ServiceCity = {
  id: string;
  name: string;
  active: boolean;
};

export type VehicleBrand = {
  id: string;
  name: string;
  active: boolean;
};

export type VehicleModel = {
  id: string;
  brand: string;
  name: string;
  categoryKey: string;
  active: boolean;
};

export type ServiceZone = {
  id: string;
  name: string;
  // Optional: a zone is a standalone geofence, not a City's child. Only set
  // when an admin has linked it into the customer/agent signup society picker.
  cityId?: string | null;
  cityName?: string;
  active: boolean;
  color?: string;
  coordinates?: [number, number][];
  boundary?: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  // Agents currently, live, physically inside this zone right now — computed
  // fresh each request, not a static assignment count.
  agentCount?: number;
};

export type AdminStats = {
  revenue: number;
  activeBookings: number;
  activeServices: number;
  totalUsers: number;
  agentsOnline: number;
  agentsTotal: number;
  alertsTriggered: number;
};

export type CustomerStatus = "active" | "suspended";

export type AdminCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: CustomerStatus;
  activePlan: string | null;
  vehicleCount: number;
  addressCount: number;
  joinedAt: string;
  totalBookings: number;
  totalSpend: number;
};

export type CustomerVehicle = { id: string; type: CarType; name: string; plate: string };
export type CustomerAddress = { id: string; label: string; line: string; society: string };

export type AdminCustomerDetail = AdminCustomer & {
  vehicles: CustomerVehicle[];
  addresses: CustomerAddress[];
  referralCode: string | null;
  coins: number;
  referredBy: {
    name: string;
    phone: string;
    code: string;
  } | null;
  referredUsers: {
    id: string;
    name: string;
    phone: string;
    joinedAt: string;
    status: string;
  }[];
};


export type CustomerActivity = {
  bookings: AdminBooking[];
  payments: AdminPayment[];
};

export type PaymentStatus = "created" | "paid" | "mock" | "refunded";
export type SettlementStatus = "pending" | "settled";

export type AdminPayment = {
  id: string;
  customerId: string;
  customerName: string;
  bookingId: string | null;
  /** The linked booking's current status, or null when there's no booking / it wasn't populated. */
  bookingStatus: BookingStatus | null;
  society: string;
  agentName: string | null;
  /** The assigned cleaner's id, or null while the booking is unassigned. */
  agentId: string | null;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  refundAmount: number;
  refundedAt: string | null;
  refundReason: string;
  agentPayout: number;
  settlementStatus: SettlementStatus;
  settledAt: string | null;
  createdAt: string;
};

export type PayoutRequestStatus = "pending" | "approved" | "rejected" | "paid";

export type PayoutBankSnapshot = {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
};

export type AdminPayoutRequest = {
  id: string;
  agent: { id: string; name: string; phone: string } | null;
  amount: number;
  status: PayoutRequestStatus;
  bankSnapshot: PayoutBankSnapshot;
  rejectionReason: string;
  transactionRef: string;
  processedAt: string | null;
  createdAt: string;
};

export type PaymentStats = {
  totalCollected: number;
  totalRefunded: number;
  pendingSettlement: number;
  settledAmount: number;
};

export type RevenueDay = { date: string; revenue: number; bookings: number };

export type VehicleRevenue = { vehicleType: CarType; revenue: number; count: number };

export type SocietyCount = { society: string; count: number };

export type AgentPerformance = {
  id: string;
  name: string;
  rating: number;
  revenue: number;
  jobsCompleted: number;
  jobsCancelled: number;
  completionRate: number;
};

export type CustomerRetention = {
  totalCustomers: number;
  customersWithBooking: number;
  repeatCustomers: number;
  repeatRate: number;
  newThisMonth: number;
  newLastMonth: number;
};

export type DiscountType = "percent" | "flat";

export type DiscountCode = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  validTill: string | null;
  active: boolean;
  /** Only redeemable on bookings whose slot falls in a configured off-peak (discounted) window. */
  offPeakOnly: boolean;
  createdAt: string;
};

export type SpecialCouponStatus = "active" | "used" | "inactive";

export type SpecialCouponUsageRecord = {
  booking: string;
  usedBy: string;
  usedAt: string;
  discountAmount: number;
};

export type SpecialCoupon = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrderValue: number;
  maxDiscount: number | null;
  validFrom: string | null;
  validTill: string | null;
  status: SpecialCouponStatus;
  assignedCustomer: { id: string; name: string; phone: string; email?: string } | null;
  batchId: string;
  offPeakOnly: boolean;
  usageHistory: SpecialCouponUsageRecord[];
  createdAt: string;
};

/** What a cleaner earns per completed job. See the Agent Payouts admin page. */
export type PayoutConfig = {
  mode: "percent" | "flat";
  percent: number;
  flatAmount: number;
  minPayout: number;
  /** 0 means uncapped. */
  maxPayout: number;
};

export type ReferralConfig = {
  referrerReward: number;
  refereeReward: number;
  coinsPerRupee: number;
  maxRedeemPercent: number;
  active: boolean;
};

export const BANNER_TYPES = ["promotional", "discount", "off-peak-hours", "announcement"] as const;
export type BannerType = (typeof BANNER_TYPES)[number];

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  type: BannerType;
  sortOrder: number;
  active: boolean;
};

/** 0 = Sunday, matching JS Date#getDay. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type OffPeakWindow = {
  day: WeekdayIndex;
  /** 24-hour "HH:MM" in the config's timezone. */
  start: string;
  end: string;
  label: string;
  /** Server-derived minutes since midnight, so the client never re-parses "HH:MM". */
  startMinutes: number;
  endMinutes: number;
};

/** One weekday × slot cell of the demand grid behind a suggestion. */
export type DemandCell = {
  day: WeekdayIndex;
  slot: string;
  count: number;
  offPeak: boolean;
};

export type DemandDaySummary = {
  day: WeekdayIndex;
  label: string;
  total: number;
  median: number;
  /** False when the weekday has too little history to classify honestly. */
  enoughData: boolean;
};

/** A proposal drawn from booking history — never applied until the admin saves. */
export type OffPeakSuggestion = {
  lookbackWeeks: number;
  sensitivity: number;
  minSamplesPerDay: number;
  totalBookings: number;
  /** Bookings left out because they were themselves won by an off-peak discount. */
  excludedDiscounted: number;
  days: DemandDaySummary[];
  grid: DemandCell[];
  windows: { day: WeekdayIndex; start: string; end: string; label: string }[];
};

export type OffPeakHoursConfig = {
  /** IANA zone every window is interpreted in, e.g. "Asia/Kolkata". */
  timezone: string;
  active: boolean;
  /** Flat charge for moving a subsidised booking into a peak slot. */
  peakUpgradeFee: number;
  windows: OffPeakWindow[];
};

export type AdminReports = {
  revenueTrend: RevenueDay[];
  revenueByVehicle: VehicleRevenue[];
  topSocieties: SocietyCount[];
  agentPerformance: AgentPerformance[];
  customerRetention: CustomerRetention;
};

/** A potential customer from a city where NexClean doesn't yet operate. */
export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  location: string;
  notified: boolean;
  status: "new" | "contacted" | "converted";
  createdAt: string;
};


export type AdminReferralLog = {
  id: string;
  referrerName: string;
  referrerPhone: string;
  referrerCode: string;
  refereeName: string;
  refereePhone: string;
  status: string;
  joinedAt: string;
};

export type AdminRole = {
  id: string;
  name: string;
  permissions: string[];
  createdAt?: string;
};

export type AdminStaff = {
  id: string;
  name: string;
  email: string;
  role?: string;
  adminRoleId: string | AdminRole | null;
  createdAt?: string;
};


