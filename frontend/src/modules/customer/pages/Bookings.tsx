import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Clock, Plus } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { useBookingsStore } from "../store/bookingsStore";
import type { BookingStatus } from "../types";
import { formatDate, formatMoney } from "../lib/format";

const FILTERS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  upcoming: "bg-primary/10 text-primary",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted/15 text-muted",
};

export function Bookings() {
  const { bookings, cancelBooking } = useBookingsStore();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");

  const list = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">My bookings</h1>
        <Button asChild size="sm">
          <Link to="/app/book">
            <Plus className="size-4" /> New booking
          </Link>
        </Button>
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-pill border border-line bg-surface/70 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <GlassCard className="py-16 text-center">
          <p className="text-muted">No bookings here yet.</p>
          <Button asChild className="mt-4">
            <Link to="/app/book">Book a cleaning</Link>
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {list.map((b) => (
            <GlassCard key={b.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="w-24 shrink-0">
                <CarSilhouette type={b.vehicleType} uid={`bk-${b.id}`} />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold text-ink">{b.vehicleName}</p>
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLES[b.status],
                    )}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-muted">{b.packageName} · #{b.id}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-primary" /> {formatDate(b.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" /> {b.slot}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-primary" /> {b.addressLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p className="font-display text-xl font-semibold text-ink">{formatMoney(b.price)}</p>
                {b.status === "upcoming" && (
                  <Button variant="ghost" size="sm" onClick={() => cancelBooking(b.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
