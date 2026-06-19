import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useBookings, useCancelBooking } from "../api/admin.api";
import { VEHICLE_LABEL, type BookingStatus } from "../types";
import { BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL } from "../lib/status";

const FILTERS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function Bookings() {
  const { data: bookings = [] } = useBookings();
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
        <p className="mt-1 text-muted">{bookings.length} total · manage and resolve.</p>
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
        <table className="w-full min-w-[760px] text-sm">
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
            {list.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{b.vehicleName}</p>
                  <p className="text-xs text-muted">{VEHICLE_LABEL[b.vehicleType]} · #{b.id}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{b.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)} · {b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">{b.society}</td>
                <td className="px-2 py-3 text-ink-soft">{b.agentName ?? "—"}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", BOOKING_STATUS_STYLE[b.status])}>
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
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
            {list.length === 0 && (
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
