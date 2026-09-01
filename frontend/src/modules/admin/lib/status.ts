import type { BookingStatus, AgentStatus, CustomerStatus, PaymentStatus, SettlementStatus, PayoutRequestStatus } from "../types";

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

/**
 * Payment statuses in the order they should be offered in a filter — roughly
 * the order money moves through them. Typed as PaymentStatus[] so adding a
 * status to the union without listing it here is a compile error, which is what
 * stops a filter from silently drifting out of step with the real values.
 */
export const PAYMENT_STATUS_ORDER: PaymentStatus[] = ["created", "paid", "refunded", "mock"];

export const SETTLEMENT_STATUS_STYLE: Record<SettlementStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  settled: "bg-emerald-500/10 text-emerald-600",
};

export const PAYOUT_REQUEST_STATUS_STYLE: Record<PayoutRequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-primary/10 text-primary",
  paid: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};

export const PAYOUT_REQUEST_STATUS_LABEL: Record<PayoutRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  rejected: "Declined",
};
