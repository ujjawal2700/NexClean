import type { BookingStatus, AgentStatus, CustomerStatus, PaymentStatus, SettlementStatus } from "../types";

export const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  upcoming: "bg-primary/10 text-primary",
  in_progress: "bg-amber-500/10 text-amber-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted/15 text-muted",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const AGENT_STATUS_STYLE: Record<AgentStatus, string> = {
  verified: "bg-emerald-500/10 text-emerald-600",
  pending: "bg-amber-500/10 text-amber-600",
  suspended: "bg-red-500/10 text-red-600",
};

export const CUSTOMER_STATUS_STYLE: Record<CustomerStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  suspended: "bg-red-500/10 text-red-600",
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  created: "bg-muted/15 text-muted",
  mock: "bg-muted/15 text-muted",
  paid: "bg-emerald-500/10 text-emerald-600",
  refunded: "bg-red-500/10 text-red-600",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  created: "Created",
  mock: "Mock",
  paid: "Paid",
  refunded: "Refunded",
};

export const SETTLEMENT_STATUS_STYLE: Record<SettlementStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  settled: "bg-emerald-500/10 text-emerald-600",
};
