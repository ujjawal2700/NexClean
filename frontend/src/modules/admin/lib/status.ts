import type { BookingStatus, AgentStatus } from "../types";

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
