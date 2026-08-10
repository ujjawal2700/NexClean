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
};

export type AdminAgentDetail = AdminAgent & {
  joinedAt: string;
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
  cityId: string;
  cityName: string;
  active: boolean;
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
  society: string;
  agentName: string | null;
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
  usageHistory: SpecialCouponUsageRecord[];
  createdAt: string;
};

export type ReferralConfig = {
  referrerReward: number;
  refereeReward: number;
  coinsPerRupee: number;
  maxRedeemPercent: number;
  active: boolean;
};

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  sortOrder: number;
  active: boolean;
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


