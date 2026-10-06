import { useEffect, useRef, useState } from "react";
import { bookingAmountDue, formatMoneyExact } from "@shared/lib/tax";
import { downloadInvoicePdf } from "@shared/lib/invoicePdf";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Car,
  Check,
  Clock,
  Download,
  FileText,
  ImageOff,
  Loader2,
  MapPin,
  Package,
  Radio,
  Sparkles,
  Star,
  User as UserIcon,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { StarDisplay, StarInput, RATING_LABELS } from "@shared/ui/StarRating";
import { ApiError } from "@shared/lib/api";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useBookingDetail, useBookingInvoice, useCategoryLabel } from "../api/queries";
import { useSubmitReview } from "../api/mutations";
import { ColorChip } from "../components/VehicleColorPicker";
import { suggestReview } from "../data/reviewSuggestions";
import type { BookingDetail as BookingDetailData } from "../types";

const MAX_REVIEW = 500;

const STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-primary/10 text-primary",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-red-500/10 text-red-600",
};

function photosOf(b: BookingDetailData, kind: "before" | "after"): string[] {
  const list = kind === "before" ? b.beforePhotos : b.afterPhotos;
  const single = kind === "before" ? b.beforePhotoUrl : b.afterPhotoUrl;
  return list && list.length > 0 ? list : single ? [single] : [];
}

/**
 * Everything about one booking for the customer: the service, the cleaner,
 * before/after photos, and — once it's completed — rating the cleaner.
 * Nested under /app/bookings, so the tab bar is hidden here.
 */
export function BookingDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: booking, isLoading, isError } = useBookingDetail(id);
  const categoryLabel = useCategoryLabel();

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/bookings"));
  const header = (
    <div className="sticky top-0 z-20 -mx-4 mb-5 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
      <button
        onClick={goBack}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
        aria-label="Back">
        <ArrowLeft className="size-4" />
      </button>
      <h1 className="font-display text-2xl text-ink sm:text-3xl">Booking details</h1>
      {booking && (
        <span
          className={cn(
            "ml-auto rounded-pill px-2.5 py-1 text-xs font-medium capitalize",
            STATUS_STYLE[booking.status] ?? STATUS_STYLE.upcoming,
          )}>
          {booking.status}
        </span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {header}
        <p className="flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" /> Loading booking…
        </p>
      </div>
    );
  }
  if (isError || !booking) {
    return (
      <div>
        {header}
        <GlassCard className="text-center">
          <p className="font-display text-lg font-semibold text-ink">We couldn't find this booking</p>
          <Button className="mt-4" onClick={() => navigate("/app/bookings", { replace: true })}>
            See all bookings
          </Button>
        </GlassCard>
      </div>
    );
  }

  const preselect = Number(params.get("rating"));
  const canRate = booking.status === "completed" && !booking.review && !!booking.agent;

  return (
    <div className="space-y-5 pb-6">
      {header}

      {canRate && (
        <RateServiceCard
          booking={booking}
          initialStars={preselect >= 1 && preselect <= 5 ? preselect : 0}
          autoFocus={params.has("rate") || params.has("rating")}
        />
      )}
      {booking.review && <YourReviewCard booking={booking} />}

      <GlassCard>
        <p className="font-display text-lg font-semibold text-ink">Service</p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Detail icon={Package} label="Package" value={booking.packageName} />
          <Detail
            icon={CalendarDays}
            label="Date & time"
            value={`${formatDate(booking.date)} · ${booking.slot}`}
          />
          <Detail
            icon={Car}
            label="Vehicle"
            value={
              <span className="flex flex-wrap items-center gap-x-1.5">
                {booking.vehicleName} · {categoryLabel(booking.vehicleType)}
                {booking.vehiclePlate && <> · {booking.vehiclePlate}</>}
                {(booking.vehicleColor || booking.vehicleColorHex) && (
                  <>
                    {" · "}
                    <ColorChip color={booking.vehicleColor} colorHex={booking.vehicleColorHex} />
                  </>
                )}
              </span>
            }
          />
          <Detail icon={MapPin} label="Address" value={`${booking.addressLabel} — ${booking.addressLine}`} />
          <Detail
            icon={UserIcon}
            label="Specialist"
            value={
              booking.agent ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  {booking.agent.name}
                  {booking.agent.ratingCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {booking.agent.rating.toFixed(1)} ({booking.agent.ratingCount})
                    </span>
                  )}
                </span>
              ) : (
                booking.agentName || "Not assigned yet"
              )
            }
          />
          <Detail icon={Clock} label="Booking ID" value={`#${booking.id.slice(-6).toUpperCase()}`} />
        </dl>

        {booking.status === "upcoming" && (
          <div className="mt-5 border-t border-line pt-4">
            <Button asChild>
              <Link to={`/app/track/${booking.id}`}>
                <Radio className="size-4" /> Track live
              </Link>
            </Button>
          </div>
        )}
      </GlassCard>

      <PriceBreakdownCard booking={booking} />
      <InvoiceCard booking={booking} />

      <PhotosCard booking={booking} />
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 font-medium text-ink wrap-anywhere">{value}</dd>
      </div>
    </div>
  );
}

function RateServiceCard({
  booking,
  initialStars,
  autoFocus,
}: {
  booking: BookingDetailData;
  initialStars: number;
  autoFocus: boolean;
}) {
  const submit = useSubmitReview(booking.id);
  const [stars, setStars] = useState(initialStars);
  const [comment, setComment] = useState("");
  const [attempt, setAttempt] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const agentName = booking.agent?.name ?? booking.agentName ?? "your specialist";

  useEffect(() => {
    if (autoFocus) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [autoFocus]);

  const suggest = () => {
    setComment(
      suggestReview(stars, { agentName, packageName: booking.packageName, vehicleName: booking.vehicleName }, attempt),
    );
    setAttempt((a) => a + 1);
  };

  const send = () => submit.mutate({ rating: stars, comment: comment.trim() || undefined });

  return (
    <GlassCard ref={cardRef} className="scroll-mt-24 border-primary/30" data-testid="rate-service-card">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-500">
          <Star className="size-5 fill-amber-400" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Rate {agentName}</p>
          <p className="text-sm text-muted">How was your {booking.packageName}? Your rating helps us keep quality high.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-1">
        <StarInput value={stars} onChange={setStars} disabled={submit.isPending} />
        <p className="h-5 text-sm font-medium text-ink-soft" aria-live="polite">
          {stars ? RATING_LABELS[stars] : "Tap a star to rate"}
        </p>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="review-comment" className="text-sm font-medium text-ink">
            Your review <span className="font-normal text-muted">(optional)</span>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={suggest}
            disabled={!stars || submit.isPending}
            title={stars ? "Fill in a review based on your stars" : "Pick your stars first"}>
            <Wand2 className="size-3.5" /> {attempt > 0 ? "Another suggestion" : "Suggest review"}
          </Button>
        </div>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={MAX_REVIEW}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={stars ? "Write your own, or tap “Suggest review”." : "Pick your stars, then write a review or let us suggest one."}
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {comment.length}/{MAX_REVIEW}
        </p>
      </div>

      {submit.isError && (
        <p className="mt-2 rounded-xl bg-red-50/70 px-3 py-2 text-sm text-red-600">
          {submit.error instanceof ApiError ? submit.error.message : "Couldn't send your review. Please try again."}
        </p>
      )}

      <Button className="mt-3 min-h-12 w-full" onClick={send} disabled={!stars || submit.isPending}>
        {submit.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Check className="size-4" /> Submit review
          </>
        )}
      </Button>
    </GlassCard>
  );
}

function YourReviewCard({ booking }: { booking: BookingDetailData }) {
  const review = booking.review!;
  return (
    <GlassCard className="border-emerald-500/25" data-testid="your-review-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <Sparkles className="size-5 text-amber-500" /> Your review
        </p>
        <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <StarDisplay value={review.rating} size="size-5" />
        <span className="text-sm font-medium text-ink-soft">{RATING_LABELS[review.rating]}</span>
      </div>
      {review.comment ? (
        <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">“{review.comment}”</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No written review.</p>
      )}
      <p className="mt-3 text-xs text-muted">Thanks for rating {review.agentName || "your specialist"}!</p>
    </GlassCard>
  );
}

function PhotosCard({ booking }: { booking: BookingDetailData }) {
  const [tab, setTab] = useState<"before" | "after">("before");
  const [open, setOpen] = useState<string | null>(null);
  const before = photosOf(booking, "before");
  const after = photosOf(booking, "after");
  const shown = tab === "before" ? before : after;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <GlassCard data-testid="booking-photos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <Camera className="size-5 text-primary" /> Before &amp; after
        </p>
        <div className="flex rounded-pill border border-line bg-surface-muted/60 p-1" role="tablist">
          {(["before", "after"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "cursor-pointer rounded-pill px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-primary text-white" : "text-ink-soft hover:text-primary",
              )}>
              {t} ({t === "before" ? before.length : after.length})
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 grid place-items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          <ImageOff className="size-6" />
          {booking.status === "completed"
            ? `No ${tab} photos were uploaded for this service.`
            : `Your specialist adds ${tab} photos during the service.`}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {shown.map((url, i) => (
            <button
              key={`${tab}-${i}`}
              type="button"
              onClick={() => setOpen(url)}
              className="cursor-zoom-in overflow-hidden rounded-2xl border border-line"
              aria-label={`Open ${tab} photo ${i + 1}`}>
              <img src={url} alt={`${tab} photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          onClick={() => setOpen(null)}>
          <button
            className="absolute right-4 top-4 grid size-10 cursor-pointer place-items-center rounded-full bg-white/15 text-white"
            aria-label="Close photo"
            onClick={() => setOpen(null)}>
            <X className="size-5" />
          </button>
          <img src={open} alt="" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </GlassCard>
  );
}

/** Every rupee of the booking: service value, discounts, GST and what's owed. */
function PriceBreakdownCard({ booking: b }: { booking: BookingDetailData }) {
  const taxable = b.taxableAmount ?? b.price;
  const discount = b.discountAmount ?? 0;
  const coins = b.coinDiscount ?? 0;
  const gross = taxable + discount + coins;
  const intra = (b.taxSupplyType ?? "intra") === "intra";
  const reclaimed = b.taxableAmount != null ? Math.max(0, b.price - b.taxableAmount) : 0;
  const rows: { label: string; value: number; tone?: "good" | "strong" }[] = [
    { label: "Service value", value: gross },
    ...(discount > 0 ? [{ label: `Discount${b.discountCode ? ` (${b.discountCode})` : ""}`, value: -discount, tone: "good" as const }] : []),
    ...(coins > 0 ? [{ label: `Coins redeemed (${b.coinsRedeemed ?? 0})`, value: -coins, tone: "good" as const }] : []),
    { label: "Taxable value", value: taxable, tone: "strong" },
    ...((b.taxAmount ?? 0) > 0
      ? intra
        ? [
            { label: `CGST @ ${(b.taxRate ?? 0) / 2}%`, value: b.cgstAmount ?? 0 },
            { label: `SGST @ ${(b.taxRate ?? 0) / 2}%`, value: b.sgstAmount ?? 0 },
          ]
        : [{ label: `IGST @ ${b.taxRate}%`, value: b.igstAmount ?? 0 }]
      : []),
    ...((b.taxRoundOff ?? 0) !== 0 ? [{ label: "Round off", value: b.taxRoundOff ?? 0 }] : []),
    ...(reclaimed > 0 ? [{ label: "Off-peak discount reclaimed", value: reclaimed }] : []),
    ...((b.peakUpgradeFeeCharged ?? 0) > 0 ? [{ label: "Peak-slot upgrade fee", value: b.peakUpgradeFeeCharged ?? 0 }] : []),
  ];
  return (
    <GlassCard data-testid="price-breakdown">
      <p className="font-display text-lg font-semibold text-ink">Price breakdown</p>
      {b.isSubscriptionWash ? (
        <p className="mt-3 text-sm text-muted">This wash is included in your subscription — nothing to pay.</p>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className={cn("flex justify-between gap-3", r.tone === "strong" && "border-t border-line pt-2 font-medium")}>
              <dt className={r.tone === "strong" ? "text-ink" : "text-muted"}>{r.label}</dt>
              <dd className={cn("tabular-nums", r.tone === "good" ? "text-emerald-600" : "text-ink")}>{formatMoneyExact(r.value)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-medium text-ink">Total</dt>
            <dd className="font-display text-2xl font-semibold text-ink" data-testid="booking-total">
              {formatMoney(bookingAmountDue(b))}
            </dd>
          </div>
          {(b.taxAmount ?? 0) === 0 && b.taxableAmount != null && (
            <p className="text-xs text-muted">No GST was applied to this booking.</p>
          )}
        </dl>
      )}
    </GlassCard>
  );
}

function InvoiceCard({ booking }: { booking: BookingDetailData }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const { refetch } = useBookingInvoice(booking.id, false);

  const download = async () => {
    setError("");
    setDownloading(true);
    try {
      const { data } = await refetch();
      if (!data) throw new Error("no invoice");
      await downloadInvoicePdf(data.invoice, data.template);
    } catch {
      setError("Couldn't prepare the invoice. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <GlassCard data-testid="invoice-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">Invoice</p>
            <p className="text-sm text-muted">Tax invoice for this booking</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/bookings/${booking.id}/invoice`} data-testid="view-invoice">
              <FileText className="size-4" /> View
            </Link>
          </Button>
          <Button size="sm" onClick={download} disabled={downloading} data-testid="download-invoice">
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </GlassCard>
  );
}
