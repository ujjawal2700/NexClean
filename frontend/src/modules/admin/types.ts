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
  assignedAgentId: string | null;
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

export type AdminPlan = {
  id: string;
  name: string;
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

export type AdminCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
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

export type AdminReports = {
  revenueTrend: RevenueDay[];
  revenueByVehicle: VehicleRevenue[];
  topSocieties: SocietyCount[];
  agentPerformance: AgentPerformance[];
  customerRetention: CustomerRetention;
};
