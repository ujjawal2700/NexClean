import { useEffect, useRef, useState } from "react";
import { bookingAmountDue } from "@shared/lib/tax";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Clock, Plus, ArrowLeft, UserCheck, Loader2, RefreshCw, Radio, Camera, Star, ChevronRight } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { useBookingsPages, type BookingStatusFilter } from "../api/queries";
import { useCancelBooking } from "../api/mutations";
import { RescheduleModal } from "../components/RescheduleModal";
import { ServicePhotosModal } from "../components/ServicePhotosModal";
import { CancelBookingSheet } from "../components/CancelBookingSheet";
import { bookingManageRules } from "../components/ManageBookingActions";
import { ApiError } from "@shared/lib/api";
import type { Booking, BookingStatus } from "../types";
import { formatDate, formatMoney } from "@shared/lib/format";

/** A small live indicator of where the booking is in the dispatch pipeline. */
function CleanerStatus({ booking }: { booking: Booking }) {
  if (booking.status !== "upcoming") return null;
  if (booking.agentName) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <UserCheck className="size-4" /> {booking.agentName} assigned
      </p>
    );
  }
  const d = booking.dispatchStatus;
  if (d === "scheduled") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-violet-600">
        <Clock className="size-4" /> A cleaner will be auto-assigned before your slot
      </p>
    );
  }
  if (d === "pending_admin") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
        <Clock className="size-4" /> High demand · Priority assignment in progress
      </p>
    );
  }
  // searching / offered (or unknown-but-upcoming) → actively finding someone.
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
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
  const cancelBooking = useCancelBooking();
  const [filter, setFilter] = useState<BookingStatusFilter>("all");
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useBookingsPages(filter);
  const list = data?.pages.flatMap((p) => p.items) ?? [];
  const lastPage = data?.pages[data.pages.length - 1];
  const counts = data?.pages[0]?.counts;

  // Load the next page as the end of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, list.length]);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [viewingPhotos, setViewingPhotos] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState("");

  const confirmCancel = () => {
    if (!cancelling) return;
    setCancelError("");
    cancelBooking.mutate(cancelling.id, {
      onSuccess: () => setCancelling(null),
      onError: (e) =>
        setCancelError(e instanceof ApiError ? e.message : "Couldn't cancel just now — please try again."),
    });
  };


  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-3 flex flex-wrap items-center justify-between gap-4 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
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

      {/* Full-width segmented control; scrolls instead of clipping on very
          narrow phones. */}
      <div className="mb-3 flex w-full gap-1 overflow-x-auto rounded-pill border border-line bg-surface/70 p-1 [scrollbar-width:none] sm:inline-flex sm:w-auto [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "min-h-10 flex-1 shrink-0 cursor-pointer whitespace-nowrap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-4",
              filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
            )}
          >
            {f.label}
            {counts && (
              <span
                aria-hidden
                data-testid={`count-${f.id}`}
                className={cn(
                  "ml-1.5 rounded-pill px-1.5 text-xs",
                  filter === f.id ? "bg-white/20" : "bg-surface-muted",
                )}
              >
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonListCards count={3} />
      ) : isError && list.length === 0 ? (
        <GlassCard className="py-12 text-center">
          <p className="text-muted">Couldn't load your bookings.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </GlassCard>
      ) : list.length === 0 ? (
        <GlassCard className="py-16 text-center">
          <p className="text-muted">No bookings here yet.</p>
          <Button asChild className="mt-4">
            <Link to="/app/book">Book a cleaning</Link>
          </Button>
        </GlassCard>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {list.map((b) => (
            <GlassCard key={b.id} className="space-y-3 p-3.5 sm:p-4">
              {/* Header: car · title · status, spread across the full width. */}
              <div className="flex items-start gap-3">
                <div className="w-14 shrink-0 overflow-hidden rounded-xl sm:w-16">
                  <CarSilhouette type={b.vehicleType} uid={`bk-${b.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold leading-tight text-ink wrap-anywhere">
                    {b.vehicleName}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{b.packageName}</p>
                  <p className="mt-0.5 text-xs text-muted/80" title={b.id}>
                    Booking #{b.id.slice(-6).toUpperCase()}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium capitalize",
                    STATUS_STYLES[b.status],
                  )}
                >
                  {b.status}
                </span>
              </div>

              {/* Details: three equal columns so the card reads evenly. */}
              <dl className="grid grid-cols-3 divide-x divide-line rounded-xl bg-surface-muted/60 py-2 text-center">
                <div className="min-w-0 px-2">
                  <dt className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <CalendarDays className="size-3.5 text-primary" /> Date
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-ink">{formatDate(b.date)}</dd>
                </div>
                <div className="min-w-0 px-2">
                  <dt className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <Clock className="size-3.5 text-primary" /> Time
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-ink">{b.slot}</dd>
                </div>
                <div className="min-w-0 px-2">
                  <dt className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <MapPin className="size-3.5 text-primary" /> Place
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-ink" title={b.addressLabel}>
                    {b.addressLabel}
                  </dd>
                </div>
              </dl>

              <CleanerStatus booking={b} />

              {/* Keep the amount and primary action together. */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <p className="font-display text-lg font-semibold text-ink">
                  <span className="mr-2 font-sans text-xs font-normal text-muted">Total</span>
                  {formatMoney(bookingAmountDue(b))}
                </p>
                <Link to={`/app/bookings/${b.id}`} data-testid={`booking-details-${b.id}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
                  View booking details <ChevronRight className="size-4" />
                </Link>
                {b.status === "completed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {b.review ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-pill bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        data-testid={`rated-${b.id}`}
                        title="Your rating">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" /> {b.review.rating}
                      </span>
                    ) : (
                      b.agentName && (
                        <Button size="sm" asChild data-testid={`rate-${b.id}`}>
                          <Link to={`/app/bookings/${b.id}?rate=1`}>
                            <Star className="size-3.5" /> Rate service
                          </Link>
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingPhotos(b)}
                      data-testid={`view-photos-${b.id}`}
                    >
                      <Camera className="size-3.5" /> Photos
                    </Button>
                  </div>
                )}
                {b.status === "upcoming" && (
                  <Button size="sm" asChild data-testid={`track-${b.id}`}>
                    <Link to={`/app/track/${b.id}`}>
                      <Radio className="size-3.5" /> Track live
                    </Link>
                  </Button>
                )}
              </div>

              {bookingManageRules(b).canCancel && (
                <div className={cn("grid gap-2", bookingManageRules(b).canReschedule ? "grid-cols-2" : "grid-cols-1")}>
                  {bookingManageRules(b).canReschedule && (
                    <Button variant="outline" size="sm" onClick={() => setRescheduling(b)}>
                      <RefreshCw className="size-3.5" /> Reschedule
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
                    disabled={cancelBooking.isPending}
                    onClick={() => {
                      setCancelError("");
                      setCancelling(b);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </GlassCard>
          ))}

          <div ref={sentinel} aria-hidden className="md:col-span-2" />
          {hasNextPage ? (
            <Button
              variant="outline"
              className="w-full md:col-span-2"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              data-testid="load-more-bookings"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </>
              ) : (
                "Load more bookings"
              )}
            </Button>
          ) : (
            lastPage &&
            lastPage.total > (lastPage.limit || 0) && (
              <p className="py-2 text-center text-xs text-muted" data-testid="bookings-end">
                You've reached the end · {lastPage.total} bookings
              </p>
            )
          )}
        </div>
      )}

      {rescheduling && (
        <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)} />
      )}

      {cancelling && (
        <CancelBookingSheet
          title={cancelling.packageName}
          detail={`${formatDate(cancelling.date)} · ${cancelling.slot}`}
          pending={cancelBooking.isPending}
          error={cancelError}
          onConfirm={confirmCancel}
          onClose={() => setCancelling(null)}
        />
      )}

      {viewingPhotos && (
        <ServicePhotosModal booking={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      )}
    </div>
  );
}
