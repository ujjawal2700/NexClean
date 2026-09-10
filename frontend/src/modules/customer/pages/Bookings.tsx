import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Clock, Plus, ArrowLeft, UserCheck, Loader2, RefreshCw, Radio, Camera } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { useBookings } from "../api/queries";
import { useCancelBooking } from "../api/mutations";
import { RescheduleModal } from "../components/RescheduleModal";
import { ServicePhotosModal } from "../components/ServicePhotosModal";
import type { Booking, BookingStatus } from "../types";
import { formatDate, formatMoney } from "@shared/lib/format";

/** A small live indicator of where the booking is in the dispatch pipeline. */
function CleanerStatus({ booking }: { booking: Booking }) {
  if (booking.status !== "upcoming") return null;
  if (booking.agentName) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <UserCheck className="size-4" /> {booking.agentName} assigned
      </p>
    );
  }
  const d = booking.dispatchStatus;
  if (d === "scheduled") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-violet-600">
        <Clock className="size-4" /> A cleaner will be auto-assigned before your slot
      </p>
    );
  }
  if (d === "pending_admin") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 font-medium">
        <Clock className="size-4" /> High demand · Priority assignment in progress
      </p>
    );
  }
  // searching / offered (or unknown-but-upcoming) → actively finding someone.
  return (
    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
      <Loader2 className="size-4 animate-spin" /> Searching nearby cleaners...
    </p>
  );
}

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
  const navigate = useNavigate();
  const { data: bookings = [], isLoading } = useBookings();
  const cancelBooking = useCancelBooking();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [viewingPhotos, setViewingPhotos] = useState<Booking | null>(null);

  const list = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">My bookings</h1>
        </div>
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

      {isLoading ? (
        <SkeletonListCards count={3} />
      ) : list.length === 0 ? (
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
                <CleanerStatus booking={b} />
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p className="font-display text-xl font-semibold text-ink">{formatMoney(b.price)}</p>
                {b.status === "completed" && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingPhotos(b)}
                      data-testid={`view-photos-${b.id}`}
                    >
                      <Camera className="size-3.5" /> Service Photos
                    </Button>
                  </div>
                )}
                {b.status === "upcoming" && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button size="sm" asChild data-testid={`track-${b.id}`}>
                      <Link to={`/app/track/${b.id}`}>
                        <Radio className="size-3.5" /> Track live
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRescheduling(b)}>
                      <RefreshCw className="size-3.5" /> Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancelBooking.isPending}
                      onClick={() => cancelBooking.mutate(b.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {rescheduling && (
        <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)} />
      )}

      {viewingPhotos && (
        <ServicePhotosModal booking={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      )}
    </div>
  );
}
