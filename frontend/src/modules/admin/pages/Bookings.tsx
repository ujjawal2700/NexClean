import { useState } from "react";
import { Search, X, Wand2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import {
  useBookings,
  useCancelBooking,
  useAgents,
  useAssignBooking,
  useAutoAssignBooking,
  useSetBookingStatus,
} from "../api/admin.api";
import { VEHICLE_LABEL, type BookingStatus, type AdminBooking } from "../types";
import { BOOKING_STATUS_STYLE } from "../lib/status";

const FILTERS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_OPTIONS: { id: BookingStatus; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function AgentCell({ booking }: { booking: AdminBooking }) {
  const { data: agents = [] } = useAgents();
  const assign = useAssignBooking();
  const autoAssign = useAutoAssignBooking();
  const verifiedAgents = agents.filter((a) => a.status === "verified");

  if (booking.status === "cancelled" || booking.status === "completed") {
    return <span className="text-ink-soft">{booking.agentName ?? "—"}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={booking.assignedAgentId ?? ""}
        onChange={(e) => e.target.value && assign.mutate({ id: booking.id, agentId: e.target.value })}
        disabled={assign.isPending}
        className="h-9 rounded-xl border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-primary/50"
      >
        <option value="">{booking.agentName ?? "Unassigned"}</option>
        {verifiedAgents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        title="Auto-assign nearest available agent"
        disabled={autoAssign.isPending}
        onClick={() => autoAssign.mutate(booking.id)}
        className="grid size-8 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        <Wand2 className="size-3.5" />
      </button>
    </div>
  );
}

function StatusCell({ booking }: { booking: AdminBooking }) {
  const setStatus = useSetBookingStatus();
  return (
    <select
      value={booking.status}
      onChange={(e) => setStatus.mutate({ id: booking.id, status: e.target.value as BookingStatus })}
      disabled={setStatus.isPending}
      className={cn(
        "h-8 rounded-pill border-none px-2.5 text-xs font-medium outline-none",
        BOOKING_STATUS_STYLE[booking.status],
      )}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const cancelBooking = useCancelBooking();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");

  const list = bookings.filter((b) => {
    const matchesStatus = filter === "all" || b.status === filter;
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      b.customerName.toLowerCase().includes(q) ||
      b.vehicleName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.society.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Bookings</h1>
        <p className="mt-1 text-muted">{bookings.length} total · assign agents and control status.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search bookings…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Booking</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">When</th>
              <th className="px-2 py-2 font-medium">Society</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows rows={6} cols={8} />}
            {!isLoading && list.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{b.vehicleName}</p>
                  <p className="text-xs text-muted">{VEHICLE_LABEL[b.vehicleType]} · #{b.id}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{b.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)} · {b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">{b.society}</td>
                <td className="px-2 py-3">
                  <AgentCell booking={b} />
                </td>
                <td className="px-2 py-3">
                  <StatusCell booking={b} />
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(b.price)}</td>
                <td className="px-2 py-3 text-right">
                  {b.status === "upcoming" || b.status === "in_progress" ? (
                    <Button variant="ghost" size="sm" disabled={cancelBooking.isPending} onClick={() => cancelBooking.mutate(b.id)}>
                      <X className="size-4" /> Cancel
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-12 text-center text-muted">
                  No bookings match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
