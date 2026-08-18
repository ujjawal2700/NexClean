import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { ApiError } from "@shared/lib/api";
import { formatMoney } from "@shared/lib/format";
import { availableSlotsForDate, upcomingDates } from "../data/catalog";
import { isOffPeakSlot, windowsForDate } from "../data/offPeakHours";
import { useOffPeakHours } from "../api/queries";
import {
  usePreviewReschedule,
  useRescheduleBooking,
  useRescheduleOrder,
  type RescheduleQuote,
} from "../api/mutations";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import type { Booking } from "../types";

/**
 * Move an existing booking.
 *
 * The screen's job is to say the number before asking for consent: picking a
 * peak slot on a discounted booking swaps the confirm button for a breakdown of
 * what is owed and how to settle it. Picking a quiet slot says nothing about
 * money at all, because nothing is owed.
 */
export function RescheduleModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data: offPeakConfig } = useOffPeakHours();
  const preview = usePreviewReschedule();
  const reschedule = useRescheduleBooking();
  const rescheduleOrder = useRescheduleOrder();

  const dates = useMemo(() => upcomingDates(7), []);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [quote, setQuote] = useState<RescheduleQuote | null>(null);
  const [error, setError] = useState("");
  const [payingOnline, setPayingOnline] = useState(false);

  const slots = availableSlotsForDate(date);
  const offPeakWindows = windowsForDate(offPeakConfig, date);

  // Re-quote whenever the chosen slot changes. The server is authoritative about
  // what a move costs, so the button must never be enabled against a stale price.
  useEffect(() => {
    setQuote(null);
    setError("");
    if (!date || !slot) return;

    let cancelled = false;
    preview.mutate(
      { id: booking.id, date, slot },
      {
        onSuccess: (result) => !cancelled && setQuote(result),
        onError: (e) =>
          !cancelled &&
          setError(e instanceof ApiError ? e.message : "Couldn't price that change. Try another slot."),
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slot, booking.id]);

  const confirm = (paymentMethod?: "cash") => {
    if (!date || !slot) return;
    setError("");
    reschedule.mutate(
      { id: booking.id, date, slot, paymentMethod },
      {
        onSuccess: onClose,
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : "Couldn't move the booking. Please try again."),
      },
    );
  };

  /**
   * Pay the upcharge at the gateway, then commit.
   *
   * The order is opened first and the booking only moves once the signature
   * comes back — an abandoned checkout must leave the slot exactly where it was,
   * which is the whole reason the server refuses an unpaid upgrade.
   */
  const payOnlineThenMove = async () => {
    if (!date || !slot) return;
    setError("");
    setPayingOnline(true);
    try {
      const order = await rescheduleOrder.mutateAsync({ id: booking.id, date, slot });

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Couldn't load the payment gateway");

      openRazorpay({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.orderId,
        name: "NexClean",
        description: `Move to ${slot}`,
        theme: { color: "#4F7CFF" },
        handler: (proof) => {
          reschedule.mutate(
            { id: booking.id, date, slot, paymentMethod: "online", ...proof },
            {
              onSuccess: onClose,
              onError: (e) =>
                setError(
                  e instanceof ApiError
                    ? e.message
                    : "Payment went through but the change didn't apply — contact support.",
                ),
              onSettled: () => setPayingOnline(false),
            },
          );
        },
        // Closing the sheet without paying must release the buttons rather than
        // leave the customer stuck behind a spinner.
        modal: { ondismiss: () => setPayingOnline(false) },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start the payment. Please try again.");
      setPayingOnline(false);
    }
  };

  const busy = preview.isPending || reschedule.isPending || payingOnline;
  const ready = !!date && !!slot && !!quote;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-5 shadow-xl sm:rounded-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Move this booking</h3>
            <p className="mt-0.5 text-sm text-muted">
              {booking.packageName} · {booking.vehicleName}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-5 text-sm font-medium text-muted">Pick a new date</p>
        <div className="mt-2 flex gap-2.5 overflow-x-auto pb-2">
          {dates.map((d) => {
            const iso = d.toISOString();
            const selected = date && new Date(date).toDateString() === d.toDateString();
            return (
              <button
                key={iso}
                onClick={() => {
                  setDate(iso);
                  setSlot(null);
                }}
                className={cn(
                  "flex w-[4.25rem] shrink-0 flex-col items-center rounded-2xl border py-3 transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-line bg-surface hover:border-primary/40",
                )}
              >
                <span className="text-[11px] font-medium text-muted">
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="font-display text-lg font-semibold text-ink">{d.getDate()}</span>
                <span className="text-[11px] text-muted">
                  {d.toLocaleDateString("en-IN", { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted">Pick a time</p>
          {offPeakWindows.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Cheaper {offPeakWindows.map((w) => `${w.start}–${w.end}`).join(", ")}
            </span>
          )}
        </div>

        {date && slots.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-amber-300/40 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No slots left that day — pick another date.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-4">
            {slots.map((s) => {
              const selected = slot === s;
              const offPeak = isOffPeakSlot(offPeakConfig, date, s);
              return (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  disabled={!date}
                  className={cn(
                    "relative rounded-xl border px-2 py-2.5 text-sm font-medium transition-all disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                      : offPeak
                        ? "border-emerald-400/50 bg-emerald-50/40 text-ink-soft hover:border-primary/40"
                        : "border-line bg-surface text-ink-soft hover:border-primary/40",
                  )}
                  title={offPeak ? `${s} — off-peak slot, discounts apply` : undefined}
                  data-off-peak={offPeak ? "true" : undefined}
                >
                  {s}
                  {offPeak && (
                    <span
                      aria-hidden="true"
                      className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-300/50 bg-red-50/70 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview.isPending && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Checking that slot…
          </p>
        )}

        {/* Say the number before asking for consent. */}
        {quote?.requiresPayment && (
          <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Clock className="size-4 text-amber-600" /> That's a peak slot
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Discount to pay back</dt>
                <dd className="text-ink">{formatMoney(quote.reclaim)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Change fee</dt>
                <dd className="text-ink">{formatMoney(quote.fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-amber-300/50 pt-1.5 font-medium">
                <dt className="text-ink">Extra to pay</dt>
                <dd className="text-ink">{formatMoney(quote.totalDue)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Moving to one of the cheaper slots above costs nothing.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {quote?.requiresPayment ? (
            <>
              <Button onClick={() => confirm("cash")} disabled={busy || !ready} className="flex-1">
                {reschedule.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Moving…
                  </>
                ) : (
                  <>Pay {formatMoney(quote.totalDue)}</>
                )}
              </Button>
              {/* Only offered when a gateway is actually configured — otherwise
                  the only honest option is paying the cleaner. */}
              {quote.onlinePaymentAvailable && (
                <Button
                  variant="outline"
                  onClick={payOnlineThenMove}
                  disabled={busy || !ready}
                  className="flex-1"
                >
                  Pay now online
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => confirm()} disabled={busy || !ready} className="flex-1">
              {reschedule.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Moving…
                </>
              ) : (
                "Confirm new time"
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={reschedule.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
