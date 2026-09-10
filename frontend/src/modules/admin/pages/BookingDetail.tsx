import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  Navigation2,
  Camera,
  ImageOff,
  Loader2,
  AlertTriangle,
  Wallet,
  CalendarClock,
  Repeat,
  X,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatDate, formatMoney, formatTime, shortId } from "@shared/lib/format";
import { formatDistance } from "@shared/lib/maps";
import { LiveTrackingMap, type RouteInfo } from "@shared/components/map/LiveTrackingMap";
import { useLiveTracking, FIX_STALE_SECONDS } from "@shared/hooks/useLiveTracking";
import { useBookingDetail, useCategoryLabel } from "../api/admin.api";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLE } from "../lib/status";
import type { AdminBookingDetail } from "../types";

const JOB_LABEL: Record<AdminBookingDetail["jobStatus"], string> = {
  assigned: "Assigned",
  enroute: "On the way",
  arrived: "Arrived",
  in_progress: "Cleaning",
  completed: "Completed",
};

/** Wall-clock stamp, or an em dash when the moment was never recorded. */
function stamp(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

function durationLabel(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * One booking, in full.
 *
 * The same screen serves two quite different jobs, which is deliberate: while a
 * cleaner is in the field it is a live operations view built around the map,
 * and once the job closes it becomes the record you open to settle a dispute —
 * proof photos, the money broken down to the line, and who was paid what.
 * Splitting those into two pages would mean the booking an admin is watching
 * and the booking they later audit live at different URLs.
 */
export function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const categoryLabel = useCategoryLabel();

  // Poll only while something can actually change.
  const { data: booking, isLoading, error } = useBookingDetail(id ?? "", true);
  const live = !!booking?.isLive;

  // The position itself arrives over the socket; everything around it is REST.
  const { fix, staleSeconds, connected } = useLiveTracking(id, live);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const agentPos = useMemo(() => (fix ? { lat: fix.lat, lng: fix.lng } : null), [fix]);
  const travelling = booking?.jobStatus === "assigned" || booking?.jobStatus === "enroute";
  const etaMinutes = travelling ? (route?.etaMinutes ?? null) : null;
  const distanceM = travelling ? (route?.distanceM ?? null) : null;
  const stale = staleSeconds != null && staleSeconds > FIX_STALE_SECONDS;

  if (isLoading && !booking) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="grid h-64 place-items-center px-6 text-center">
        <div>
          <AlertTriangle className="mx-auto size-7 text-amber-500" />
          <p className="mt-2 font-medium text-ink">Couldn't load this booking</p>
          <p className="mt-1 text-sm text-muted">
            {error instanceof Error ? error.message : "It may have been deleted."}
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/bookings")}>
            Back to bookings
          </Button>
        </div>
      </div>
    );
  }

  const beforePhotos =
    booking.beforePhotos && booking.beforePhotos.length > 0
      ? booking.beforePhotos
      : booking.beforePhotoUrl
        ? [booking.beforePhotoUrl]
        : [];
  const afterPhotos =
    booking.afterPhotos && booking.afterPhotos.length > 0
      ? booking.afterPhotos
      : booking.afterPhotoUrl
        ? [booking.afterPhotoUrl]
        : [];

  return (
    <div className="space-y-5">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/admin/bookings")}
            aria-label="Back to bookings"
            className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl text-ink" data-testid="booking-detail-title">
                {booking.vehicleName}
              </h1>
              <span
                className={cn(
                  "rounded-pill px-2.5 py-0.5 text-xs font-semibold",
                  BOOKING_STATUS_STYLE[booking.status],
                )}
                data-testid="booking-detail-status"
              >
                {BOOKING_STATUS_LABEL[booking.status]}
              </span>
              {booking.isSubscriptionWash && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600">
                  <Repeat className="size-3" /> Subscription
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {booking.packageName} · {categoryLabel(booking.vehicleType)} ·{" "}
              <span title={booking.id}>#{shortId(booking.id)}</span>
            </p>
          </div>
        </div>

        {live && (
          <span
            className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600"
            data-testid="booking-live-badge"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live · {JOB_LABEL[booking.jobStatus]}
          </span>
        )}
      </div>

      {/* ── live map, only while a cleaner is actually out ──────────────── */}
      {live && (
        <GlassCard className="overflow-hidden !p-0" data-testid="booking-live-map">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div>
              <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-ink">
                <Radio className="size-4 text-primary" /> Live tracking
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {booking.agent?.name ?? "The cleaner"} ·{" "}
                {travelling
                  ? distanceM != null
                    ? `${formatDistance(distanceM)} from the customer`
                    : "en route"
                  : `on site — ${JOB_LABEL[booking.jobStatus].toLowerCase()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  connected ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/5 text-muted",
                )}
              >
                <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-muted")} />
                {connected ? "Connected" : "Connecting…"}
              </span>
              {travelling && etaMinutes != null && (
                <div className="rounded-xl bg-ink px-3 py-1.5 text-center text-white">
                  <p className="font-display text-lg font-semibold leading-none tabular-nums">
                    {etaMinutes}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider opacity-70">min</p>
                </div>
              )}
            </div>
          </div>

          <LiveTrackingMap
            destination={booking.serviceLocation}
            agent={agentPos}
            heading={fix?.heading ?? null}
            showRoute={!!agentPos && travelling}
            onRoute={setRoute}
            badge={
              agentPos
                ? travelling && etaMinutes != null
                  ? { title: "ETA", subtitle: `${etaMinutes} min` }
                  : { title: "Status", subtitle: JOB_LABEL[booking.jobStatus] }
                : null
            }
            className="h-[40dvh] min-h-[260px] w-full"
          />

          {!agentPos && (
            <p className="flex items-center gap-2 border-t border-line bg-surface-muted px-5 py-2.5 text-sm text-muted">
              <AlertTriangle className="size-4 shrink-0" />
              {booking.agent?.name ?? "The cleaner"} hasn't sent a location yet — their app may be
              closed or location permission is off.
            </p>
          )}
          {stale && agentPos && (
            <p className="flex items-center gap-2 border-t border-line bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              Last fix {staleSeconds}s ago — this position may be out of date.
            </p>
          )}
        </GlassCard>
      )}

      {/* ── people ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PersonCard
          title="Customer"
          name={booking.customer.name}
          phone={booking.customer.phone}
          email={booking.customer.email}
          href={booking.customer.id ? `/admin/customers/${booking.customer.id}` : null}
          testId="booking-customer"
        />
        {booking.agent ? (
          <PersonCard
            title="Cleaner"
            name={booking.agent.name}
            phone={booking.agent.phone}
            email={booking.agent.email}
            href={booking.agent.id ? `/admin/agents/${booking.agent.id}` : null}
            testId="booking-agent"
          />
        ) : (
          <GlassCard className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
              <User className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cleaner</p>
              <p className="font-medium text-ink" data-testid="booking-agent">
                Not assigned yet
              </p>
              <p className="text-xs text-muted">Dispatch status: {booking.dispatchStatus}</p>
            </div>
          </GlassCard>
        )}
      </div>

      {/* ── service + timeline ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle icon={MapPin}>Service</SectionTitle>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Package" value={booking.packageName} />
            <Row label="Vehicle" value={`${booking.vehicleName} · ${categoryLabel(booking.vehicleType)}`} />
            <Row label="Scheduled" value={`${formatDate(booking.date)} · ${booking.slot}`} />
            <Row label="Address" value={`${booking.addressLabel} — ${booking.addressLine}`} />
            <Row label="Society" value={booking.society || "—"} />
            <Row
              label="Map pin"
              value={
                booking.serviceLocation
                  ? `${booking.serviceLocation.lat.toFixed(5)}, ${booking.serviceLocation.lng.toFixed(5)}`
                  : "Not captured"
              }
            />
          </dl>

          {/* Where the service actually happened. Shown for finished jobs too —
              the live block above already covers the in-flight case. */}
          {booking.serviceLocation && !live && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line">
              <LiveTrackingMap
                destination={booking.serviceLocation}
                agent={null}
                showRoute={false}
                className="h-48 w-full"
              />
            </div>
          )}
          {booking.serviceLocation && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${booking.serviceLocation.lat},${booking.serviceLocation.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Navigation2 className="size-3.5" /> Open in Google Maps
            </a>
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle icon={Clock}>Timeline</SectionTitle>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Booked" value={stamp(booking.createdAt)} />
            <Row label="Cleaner assigned" value={stamp(booking.assignedAt)} />
            <Row label="Wash started" value={stamp(booking.startedAt)} testId="booking-started" />
            <Row label="Wash completed" value={stamp(booking.completedAt)} testId="booking-completed" />
            <div className="flex items-start justify-between gap-4 border-t border-line pt-2.5">
              <dt className="text-muted">Service duration</dt>
              <dd
                className="text-right font-display text-lg font-semibold text-ink"
                data-testid="booking-duration"
              >
                {durationLabel(booking.durationMinutes)}
                {booking.jobStatus === "in_progress" && (
                  <span className="ml-1.5 text-xs font-normal text-primary">(in progress)</span>
                )}
              </dd>
            </div>
          </dl>

          {(booking.rescheduleCount > 0 || booking.customerRescheduleCount > 0) && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted/60 px-3 py-2 text-xs text-ink-soft">
              <CalendarClock className="mt-px size-3.5 shrink-0 text-primary" />
              <span>
                Moved {booking.customerRescheduleCount}× by the customer
                {booking.rescheduleCount > 0 && `, ${booking.rescheduleCount}× by the system`}
                {booking.autoRescheduled && " (auto-rescheduled after a missed slot)"}.
              </span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── proof photos ───────────────────────────────────────────────── */}
      <GlassCard className="space-y-6">
        <div>
          <SectionTitle icon={Camera}>Proof of service</SectionTitle>
          <p className="mt-1 text-sm text-muted">
            Captured by the cleaner on site (up to 8 before and 8 after photos). Evidence for any dispute or audit.
          </p>
        </div>

        <div className="space-y-6">
          {/* Before Photos Gallery */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-ink">Before Wash Photos</h3>
              <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {beforePhotos.length} / 8 photos
              </span>
            </div>
            {beforePhotos.length === 0 ? (
              <div
                className="grid h-36 place-items-center rounded-2xl border border-dashed border-line bg-surface-muted/50 text-center"
                data-testid="booking-before-photo"
              >
                <div>
                  <ImageOff className="mx-auto size-5 text-muted" />
                  <p className="mt-1.5 text-xs font-medium text-ink">No before photos uploaded</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {beforePhotos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox({ url, label: `Before Photo #${i + 1}` })}
                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface cursor-pointer"
                    data-testid={i === 0 ? "booking-before-photo" : undefined}
                  >
                    <img
                      src={url}
                      alt={`Before ${i + 1}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 rounded-pill bg-ink/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Before #{i + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* After Photos Gallery */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-ink">After Wash Photos</h3>
              <span className="rounded-pill bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                {afterPhotos.length} / 8 photos
              </span>
            </div>
            {afterPhotos.length === 0 ? (
              <div
                className="grid h-36 place-items-center rounded-2xl border border-dashed border-line bg-surface-muted/50 text-center"
                data-testid="booking-after-photo"
              >
                <div>
                  <ImageOff className="mx-auto size-5 text-muted" />
                  <p className="mt-1.5 text-xs font-medium text-ink">No after photos uploaded</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {afterPhotos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox({ url, label: `After Photo #${i + 1}` })}
                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface cursor-pointer"
                    data-testid={i === 0 ? "booking-after-photo" : undefined}
                  >
                    <img
                      src={url}
                      alt={`After ${i + 1}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 rounded-pill bg-emerald-700/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      After #{i + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ── money ──────────────────────────────────────────────────────── */}
      <GlassCard>
        <SectionTitle icon={Wallet}>Payment</SectionTitle>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label="Service price" value={formatMoney(booking.price)} />
          {booking.discountAmount > 0 && (
            <Row
              label={`Discount${booking.discountCode ? ` (${booking.discountCode})` : ""}`}
              value={`−${formatMoney(booking.discountAmount)}`}
            />
          )}
          {booking.coinDiscount > 0 && (
            <Row
              label={`Coins redeemed (${booking.coinsRedeemed.toLocaleString("en-IN")})`}
              value={`−${formatMoney(booking.coinDiscount)}`}
            />
          )}
          {booking.offPeakLocked && (
            <Row
              label="Off-peak subsidy"
              value={`${formatMoney(booking.offPeakDiscountAmount)} — reclaimed if moved to a peak slot`}
            />
          )}
          {booking.peakUpgradeFeeCharged > 0 && (
            <Row label="Peak upgrade fee" value={formatMoney(booking.peakUpgradeFeeCharged)} />
          )}
          {booking.upgradeWaivedAmount > 0 && (
            <Row label="Upgrade fee waived" value={formatMoney(booking.upgradeWaivedAmount)} />
          )}

          <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
            <dt className="font-medium text-ink">Total amount</dt>
            <dd
              className="font-display text-2xl font-semibold text-ink"
              data-testid="booking-total"
            >
              {formatMoney(booking.totalAmount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">
              Cleaner's share
              {!booking.agentShareSettled && booking.agentShare != null && (
                <span className="ml-1.5 rounded-pill bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                  provisional
                </span>
              )}
            </dt>
            <dd className="text-right font-display text-lg font-semibold text-ink" data-testid="booking-agent-share">
              {booking.agentShare != null ? formatMoney(booking.agentShare) : "—"}
            </dd>
          </div>

          {booking.agentShare != null && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Platform keeps</dt>
              <dd className="text-right font-medium text-ink-soft">
                {formatMoney(booking.totalAmount - booking.agentShare)}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          {booking.agentShareSettled ? (
            <>
              <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-500" />
              Settled — frozen at the payout rule in force when the job completed, so later rule
              changes don't rewrite it.
            </>
          ) : (
            <>
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-500" />
              Quoted from today's payout rule. The figure is frozen once the job completes.
            </>
          )}
        </p>
      </GlassCard>

      {lightbox && (
        <PhotoLightbox {...lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function SectionTitle({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
      <Icon className="size-4 text-primary" />
      {children}
    </p>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="max-w-[62%] text-right font-medium text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function PersonCard({
  title,
  name,
  phone,
  email,
  href,
  testId,
}: {
  title: string;
  name: string;
  phone: string | null;
  email: string | null;
  href: string | null;
  testId?: string;
}) {
  return (
    <GlassCard className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-semibold text-primary">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{title}</p>
        {href ? (
          <Link to={href} className="font-medium text-ink hover:text-primary" data-testid={testId}>
            {name}
          </Link>
        ) : (
          <p className="font-medium text-ink" data-testid={testId}>
            {name}
          </p>
        )}
        <div className="mt-1.5 space-y-1 text-xs">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
              <Phone className="size-3.5" /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-muted hover:text-primary">
              <Mail className="size-3.5" /> {email}
            </a>
          )}
          {!phone && !email && <p className="text-muted">No contact on file</p>}
        </div>
      </div>
    </GlassCard>
  );
}

function PhotoLightbox({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink/70 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} photo`}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 grid size-10 place-items-center rounded-xl bg-surface text-ink-soft hover:text-ink"
      >
        <X className="size-5" />
      </button>
      <img
        src={url}
        alt={`${label} the wash`}
        className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
