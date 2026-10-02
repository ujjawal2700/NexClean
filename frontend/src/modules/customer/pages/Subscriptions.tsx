import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Calendar,
  Plus,
  Lock,
  RefreshCw,
  Trash2,
  Car,
  MapPin,
  ArrowLeft,
  Coins,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import {
  useMe,
  usePlans,
  useCategoryLabel,
  useSubscriptionSchedule,
  useWallet,
  useTimeSlots,
} from "../api/queries";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import {
  useCreateSubscriptionOrder,
  useVerifySubscription,
  useUnsubscribe,
  usePreviewSubscription,
  useScheduleSubscriptionWash,
  useRescheduleSubscriptionWash,
  useCancelBooking,
} from "../api/mutations";
import { useIsGuest } from "../store/sessionStore";
import {
  ScheduleSheet,
  SheetSection,
  OptionList,
  DateStrip,
  SlotGrid,
  describeSchedule,
} from "../components/ScheduleSheet";
import type { SubscriptionPreview } from "../api/mutations";
import type { CarType, CatalogPlan, Booking } from "../types";

type PlanMeta = { tagline: string; perks: string[]; featured?: boolean };
const PLAN_META: Record<string, PlanMeta> = {
  basic: {
    tagline: "For the weekend driver.",
    perks: ["Exterior + interior", "Doorstep service", "Free rescheduling"],
  },
  premium: {
    tagline: "Our most popular plan.",
    perks: ["Priority scheduling", "Premium products", "10% off add-ons"],
    featured: true,
  },
  elite: {
    tagline: "Nothing but the best.",
    perks: ["Same-day guaranteed", "Top specialists", "Concierge support"],
  },
};
const DEFAULT_META: PlanMeta = {
  tagline: "Subscribe and save on every wash.",
  perks: ["Doorstep service"],
};

function washesLabel(washesPerMonth: number): string {
  return washesPerMonth < 0
    ? "Unlimited washes"
    : `${washesPerMonth} washes / month`;
}

export function Subscriptions() {
  const navigate = useNavigate();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const categoryLabel = useCategoryLabel();
  const timeSlots = useTimeSlots();
  const createSubOrder = useCreateSubscriptionOrder();
  const verifySub = useVerifySubscription();
  const unsubscribe = useUnsubscribe();
  const previewSub = usePreviewSubscription();
  const { data: wallet } = useWallet();

  const { data: scheduleData, isLoading: scheduleLoading } =
    useSubscriptionSchedule();
  const scheduleWash = useScheduleSubscriptionWash();
  const rescheduleWash = useRescheduleSubscriptionWash();
  const cancelWash = useCancelBooking();

  const [subProcessing, setSubProcessing] = useState(false);

  const busy =
    subProcessing ||
    createSubOrder.isPending ||
    verifySub.isPending ||
    unsubscribe.isPending ||
    scheduleWash.isPending ||
    rescheduleWash.isPending ||
    cancelWash.isPending;

  const activePlan = me?.activePlan ?? null;
  const [showCatalog, setShowCatalog] = useState(false);

  // Modal States
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [targetBooking, setTargetBooking] = useState<Booking | null>(null);
  const [scheduleError, setScheduleError] = useState("");

  const activePlanDetails = plans.find((p) => p.id === activePlan);
  const washesLimit = activePlanDetails?.washesPerMonth ?? 0;
  const scheduledBookings = scheduleData?.bookings ?? [];
  const cycleEnd = scheduleData?.subscriptionEndDate
    ? new Date(scheduleData.subscriptionEndDate).toLocaleDateString()
    : "";
  const expired = !!scheduleData?.expired;

  // The distinct vehicle types the customer owns; price previews follow the selected one.
  const ownedTypes = Array.from(
    new Set((me?.vehicles ?? []).map((v) => v.type)),
  );
  const [selectedType, setSelectedType] = useState<CarType | null>(
    ownedTypes[0] ?? null,
  );
  const vehicleType = selectedType ?? ownedTypes[0] ?? null;

  const priceForPlan = (plan: CatalogPlan) =>
    vehicleType ? plan.prices[vehicleType] : plan.price;

  // Subscription checkout (with optional coin redemption)
  const walletCoins = wallet?.coins ?? 0;
  const [checkoutPlan, setCheckoutPlan] = useState<CatalogPlan | null>(null);
  const [subUseCoins, setSubUseCoins] = useState(false);
  const [subQuote, setSubQuote] = useState<SubscriptionPreview | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const openCheckout = (plan: CatalogPlan) => {
    // Guests can read the catalog but not buy: send them to the login and bring
    // them back to plans once they're in.
    if (isGuest) {
      navigate("/app/login", { state: { from: "/app/plans" } });
      return;
    }
    setCheckoutPlan(plan);
    setSubUseCoins(false);
    setSubQuote(null);
    setCheckoutError("");
  };

  const payableSub = subQuote
    ? subQuote.price
    : checkoutPlan
      ? priceForPlan(checkoutPlan)
      : 0;

  const toggleSubCoins = async () => {
    if (!checkoutPlan) return;
    const next = !subUseCoins;
    setSubUseCoins(next);
    if (!next) {
      setSubQuote(null);
      return;
    }
    try {
      const q = await previewSub.mutateAsync({
        planId: checkoutPlan.id,
        vehicleType: vehicleType ?? undefined,
        coinsToRedeem: walletCoins,
      });
      setSubQuote(q);
    } catch {
      setSubUseCoins(false);
    }
  };

  const confirmSubscribe = async () => {
    if (!checkoutPlan) return;
    setCheckoutError("");
    setSubProcessing(true);

    const checkoutVars = {
      planId: checkoutPlan.id,
      vehicleType: vehicleType ?? undefined,
      coinsToRedeem: subUseCoins ? walletCoins : undefined,
    };

    const finish = () => {
      setCheckoutPlan(null);
      setShowCatalog(false);
      setSubProcessing(false);
    };

    try {
      // The server decides the route: `mock: true` means no gateway is
      // configured, so the plan activates directly and is settled in cash.
      // Adding real keys switches this to checkout without any code change.
      const order = await createSubOrder.mutateAsync(checkoutVars);

      if (order.mock) {
        await verifySub.mutateAsync(checkoutVars);
        finish();
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Couldn't load the payment gateway");

      openRazorpay({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.orderId,
        name: "NexClean",
        description: `${checkoutPlan.name} subscription`,
        prefill: { name: me?.name, contact: me?.phone },
        theme: { color: "#4F7CFF" },
        handler: async (r) => {
          try {
            await verifySub.mutateAsync({ ...checkoutVars, ...r });
            finish();
          } catch (e: any) {
            setCheckoutError(e?.message || "Payment verification failed");
            setSubProcessing(false);
          }
        },
        // Dismissing the sheet must release the button, not strand the customer
        // behind a spinner they cannot clear.
        modal: { ondismiss: () => setSubProcessing(false) },
      });
    } catch (err: any) {
      setCheckoutError(
        err?.message || "Failed to subscribe. Please try again.",
      );
      setSubProcessing(false);
    }
  };

  const handleOpenSchedule = () => {
    setSelectedVehicleId(me?.vehicles[0]?.id || "");
    setSelectedAddressId(me?.addresses[0]?.id || "");
    setSelectedDate("");
    setSelectedSlot("");
    setScheduleError("");
    setIsScheduleOpen(true);
  };

  const closeSchedule = useCallback(() => setIsScheduleOpen(false), []);
  const closeReschedule = useCallback(() => setIsRescheduleOpen(false), []);

  const handleConfirmSchedule = async () => {
    if (
      !selectedVehicleId ||
      !selectedAddressId ||
      !selectedDate ||
      !selectedSlot
    ) {
      return setScheduleError(
        "Please select a vehicle, address, date, and slot.",
      );
    }
    setScheduleError("");
    try {
      await scheduleWash.mutateAsync({
        vehicleId: selectedVehicleId,
        addressId: selectedAddressId,
        date: selectedDate,
        slot: selectedSlot,
      });
      setIsScheduleOpen(false);
    } catch (err: any) {
      setScheduleError(err?.message || "Failed to schedule wash");
    }
  };

  const handleOpenReschedule = (booking: Booking) => {
    setTargetBooking(booking);
    setSelectedDate(booking.date);
    setSelectedSlot(booking.slot);
    setScheduleError("");
    setIsRescheduleOpen(true);
  };

  const handleConfirmReschedule = async () => {
    if (!targetBooking || !selectedDate || !selectedSlot) {
      return setScheduleError("Please select a date and slot.");
    }
    setScheduleError("");
    try {
      await rescheduleWash.mutateAsync({
        bookingId: targetBooking.id,
        date: selectedDate,
        slot: selectedSlot,
      });
      setIsRescheduleOpen(false);
    } catch (err: any) {
      setScheduleError(err?.message || "Failed to reschedule wash");
    }
  };

  const handleCancelWash = async (bookingId: string) => {
    if (
      window.confirm("Are you sure you want to cancel this scheduled wash?")
    ) {
      try {
        await cancelWash.mutateAsync(bookingId);
      } catch (err: any) {
        alert(err?.message || "Failed to cancel wash");
      }
    }
  };

  const getWashesCountText = () => {
    if (washesLimit === -1)
      return `${scheduledBookings.length} washes scheduled`;
    return `${scheduledBookings.length} / ${washesLimit} washes used`;
  };

  // Generate 30 upcoming days starting tomorrow
  // Days a wash can go on: tomorrow through the end of the billing cycle. A
  // wash dated after the cycle ends isn't part of this plan — the server
  // refuses it, and it would never show on this board.
  const cycleDates = () => {
    const dates: Date[] = [];
    const base = new Date();
    const end = scheduleData?.subscriptionEndDate ? new Date(scheduleData.subscriptionEndDate) : null;
    // Start tomorrow to avoid slot overlaps for today
    for (let i = 1; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (end && d > end) break;
      dates.push(d);
    }
    return dates;
  };

  // Check 12-hour rescheduling/cancellation window
  const isLocked = (dateStr: string) => {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    return diffMs < 12 * 60 * 60 * 1000;
  };

  // Main Loading
  if (plansLoading || (activePlan && scheduleLoading)) {
    return (
      <p className="text-muted py-10 text-center">
        Loading subscription dashboard…
      </p>
    );
  }

  // --- RENDER 1: Active Subscription Wash Dashboard ---
  if (activePlan && !showCatalog) {
    const nextBooking = scheduledBookings.find(
      (b) => new Date(b.date).getTime() > Date.now(),
    );

    // The board used to draw one big card per wash in the plan — an 8-wash
    // plan was 8 tall cards to scroll past just to reach "Schedule". Now
    // scheduled washes are compact rows and the rest is one "schedule next" row.
    const used = scheduledBookings.length;
    const unlimited = washesLimit === -1;
    const remaining = unlimited ? Infinity : Math.max(0, washesLimit - used);
    const canSchedule = !expired && remaining > 0;

    return (
      <div className="space-y-8">
        <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-4 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
                aria-label="Back">
                <ArrowLeft className="size-4" />
              </button>
              <h1 className="font-display text-2xl text-ink sm:text-3xl">
                Active Subscription
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted pl-12">
              Book and manage your washes for this billing cycle.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCatalog(true)}
            className="sm:mt-1">
            Upgrade / Cancel Plan
          </Button>
        </div>

        {expired && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              <span className="font-semibold">Your plan ended on {cycleEnd}.</span>{" "}
              Renew it to schedule more washes. Washes already booked still go ahead.
            </p>
            <Button size="sm" className="shrink-0" onClick={() => setShowCatalog(true)}>
              Renew plan
            </Button>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Plan Summary */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Current Plan
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold capitalize text-primary">
                {activePlanDetails?.name || activePlan}
              </h2>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              Cycle ends:{" "}
              <span className="font-semibold text-ink">
                {cycleEnd || "N/A"}
              </span>
            </p>
          </GlassCard>

          {/* Card 2: Progress */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Cycle Usage
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                {getWashesCountText()}
              </h2>
            </div>
            {washesLimit !== -1 && (
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${(scheduledBookings.length / washesLimit) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {/* Card 3: Next Scheduled Wash */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Next Wash
              </p>
              {nextBooking ? (
                <div className="mt-2">
                  <h3 className="font-display text-lg font-semibold text-ink leading-tight">
                    {nextBooking.vehicleName}
                  </h3>
                  <p className="mt-1 text-xs text-muted flex items-center gap-1">
                    <Calendar className="size-3" />{" "}
                    {new Date(nextBooking.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {nextBooking.slot}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  No upcoming washes scheduled.
                </p>
              )}
            </div>
            {!nextBooking && washesLimit !== 0 && !expired && (
              <Button
                size="sm"
                className="mt-4 w-fit"
                onClick={handleOpenSchedule}>
                Schedule now
              </Button>
            )}
          </GlassCard>
        </div>

        {/* Schedule board */}
        <section className="space-y-4" data-testid="schedule-board">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-ink">Your washes</h2>
              <p className="text-sm text-muted">
                {unlimited
                  ? `${used} scheduled · unlimited this cycle`
                  : `${used} of ${washesLimit} scheduled this cycle`}
              </p>
            </div>
            {canSchedule && (
              <Button size="sm" onClick={handleOpenSchedule} disabled={busy} className="shrink-0">
                <Plus className="size-4" /> Schedule a wash
              </Button>
            )}
          </div>

          {!unlimited && washesLimit > 0 && (
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: washesLimit }).map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 min-w-0 flex-1 rounded-full", i < used ? "bg-primary" : "bg-line")}
                />
              ))}
            </div>
          )}

          {used === 0 ? (
            <button
              type="button"
              onClick={handleOpenSchedule}
              disabled={!canSchedule || busy}
              className="flex w-full cursor-pointer items-center gap-4 rounded-card border-2 border-dashed border-line p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-default disabled:opacity-60">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Plus className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold text-ink">Schedule your first wash</span>
                <span className="block text-xs text-muted">
                  {expired ? "Renew your plan to schedule" : "Pick the car, place and time — takes a few seconds"}
                </span>
              </span>
            </button>
          ) : (
            <ul className="grid gap-2.5 md:grid-cols-2">
              {scheduledBookings.map((booking, i) => {
                const locked = isLocked(booking.date);
                const d = new Date(booking.date);
                return (
                  <li
                    key={booking.id}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                    data-testid="wash-row">
                    <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-primary/10 py-1.5 text-primary">
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {d.toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      <span className="font-display text-lg font-semibold leading-tight">{d.getDate()}</span>
                      <span className="text-[10px] leading-none">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-ink">{booking.vehicleName}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize",
                            booking.status === "upcoming"
                              ? "bg-amber-500/10 text-amber-700"
                              : booking.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-red-500/10 text-red-600",
                          )}>
                          {booking.status}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        #{i + 1} · {booking.slot} · {booking.addressLabel}
                      </p>
                    </div>
                    {booking.status === "upcoming" &&
                      (locked ? (
                        <span
                          className="flex shrink-0 items-center gap-1 text-[11px] text-muted"
                          title="Washes can't be changed within 12 hours of the slot">
                          <Lock className="size-3.5" /> Locked
                        </span>
                      ) : (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenReschedule(booking)}
                            disabled={busy}
                            aria-label={`Reschedule wash ${i + 1}`}
                            className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-soft transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50">
                            <RefreshCw className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelWash(booking.id)}
                            disabled={busy}
                            aria-label={`Cancel wash ${i + 1}`}
                            className="grid size-9 cursor-pointer place-items-center rounded-xl text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          )}

          {used > 0 && canSchedule && (
            <button
              type="button"
              onClick={handleOpenSchedule}
              disabled={busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3 text-sm font-medium text-ink-soft transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-60">
              <Plus className="size-4" />
              Schedule wash #{used + 1}
              {!unlimited && <span className="text-muted">· {remaining} left</span>}
            </button>
          )}
        </section>

        {/* MODAL 1: Schedule Wash */}
        {isScheduleOpen && (
          <ScheduleSheet
            title="Schedule a wash"
            subtitle="Pick the car, place and time for this subscription wash."
            error={scheduleError}
            onClose={closeSchedule}
            footer={
              <ScheduleFooter
                summary={describeSchedule(selectedDate, selectedSlot)}
                confirmLabel="Schedule wash"
                ready={!!(selectedVehicleId && selectedAddressId && selectedDate && selectedSlot)}
                busy={busy}
                pending={scheduleWash.isPending}
                onConfirm={handleConfirmSchedule}
                onCancel={closeSchedule}
              />
            }
          >
            <SheetSection step={1} title="Vehicle">
              <OptionList
                items={me?.vehicles ?? []}
                value={selectedVehicleId}
                onChange={setSelectedVehicleId}
                icon={Car}
                render={(v) => ({
                  title: v.name,
                  detail: [categoryLabel(v.type), v.plate].filter(Boolean).join(" · "),
                })}
                addLabel="Add a vehicle"
                emptyText="You need a saved vehicle to schedule a wash."
                addTo="/app/profile/vehicles"
              />
            </SheetSection>

            <SheetSection step={2} title="Location">
              <OptionList
                items={me?.addresses ?? []}
                value={selectedAddressId}
                onChange={setSelectedAddressId}
                icon={MapPin}
                render={(a) => ({ title: a.label, detail: a.line })}
                addLabel="Add an address"
                emptyText="Tell us where the car will be parked."
                addTo="/app/profile/addresses"
              />
            </SheetSection>

            <SheetSection step={3} title="Date">
              <DateStrip dates={cycleDates()} value={selectedDate} onChange={setSelectedDate} />
            </SheetSection>

            <SheetSection step={4} title="Time slot">
              <SlotGrid slots={timeSlots} value={selectedSlot} onChange={setSelectedSlot} />
            </SheetSection>
          </ScheduleSheet>
        )}

        {/* MODAL 2: Reschedule Wash */}
        {isRescheduleOpen && (
          <ScheduleSheet
            title="Reschedule wash"
            subtitle={
              targetBooking
                ? `Currently ${describeSchedule(targetBooking.date, targetBooking.slot)}`
                : undefined
            }
            error={scheduleError}
            onClose={closeReschedule}
            footer={
              <ScheduleFooter
                summary={describeSchedule(selectedDate, selectedSlot)}
                confirmLabel="Confirm new time"
                ready={!!(selectedDate && selectedSlot)}
                busy={busy}
                pending={rescheduleWash.isPending}
                onConfirm={handleConfirmReschedule}
                onCancel={closeReschedule}
              />
            }
          >
            <SheetSection step={1} title="New date">
              <DateStrip dates={cycleDates()} value={selectedDate} onChange={setSelectedDate} />
            </SheetSection>
            <SheetSection step={2} title="Time slot">
              <SlotGrid slots={timeSlots} value={selectedSlot} onChange={setSelectedSlot} />
            </SheetSection>
          </ScheduleSheet>
        )}
      </div>
    );
  }

  // --- RENDER 2: Subscriptions Catalog Catalog ---
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-col gap-4 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
              aria-label="Back">
              <ArrowLeft className="size-4" />
            </button>
            <h1 className="font-display text-2xl text-ink sm:text-3xl">
              Subscription plans
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted pl-12">
            Subscribe once, save on every wash. Cancel anytime.
          </p>
        </div>
        {activePlan && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCatalog(false)}
            className="sm:mt-1">
            Back to Dashboard
          </Button>
        )}
      </div>

      {/* Vehicle selector — pricing varies by vehicle type. */}
      {ownedTypes.length > 0 ? (
        ownedTypes.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Pricing for</span>
            {ownedTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
                  t === vehicleType
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-surface/70 text-ink-soft hover:border-primary/40",
                )}>
                {categoryLabel(t)}
              </button>
            ))}
          </div>
        )
      ) : (
        <p className="mb-6 text-sm text-muted">
          {isGuest
            ? "Log in and add a vehicle to see its exact price — showing the lowest tier for now."
            : "Add a vehicle in your profile to see its exact price — showing the lowest tier for now."}
        </p>
      )}

      {plansLoading && <p className="text-muted">Loading plans…</p>}

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const meta = PLAN_META[plan.id] ?? DEFAULT_META;
          const active = activePlan === plan.id;
          const features = [washesLabel(plan.washesPerMonth), ...meta.perks];
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-card border p-7 transition-transform",
                meta.featured
                  ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-3"
                  : "border-line bg-surface/70 shadow-[var(--shadow-soft)]",
              )}>
              {meta.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  Popular
                </span>
              )}
              <h2
                className={cn(
                  "font-display text-2xl font-semibold",
                  meta.featured ? "text-white" : "text-ink",
                )}>
                {plan.name}
              </h2>
              <p
                className={cn(
                  "mt-1 text-sm",
                  meta.featured ? "text-white/80" : "text-muted",
                )}>
                {meta.tagline}
              </p>
              <div className="mt-5 flex items-end gap-1">
                {!vehicleType && (
                  <span
                    className={cn(
                      "pb-1 text-sm",
                      meta.featured ? "text-white/80" : "text-muted",
                    )}>
                    from
                  </span>
                )}
                <span className="font-display text-3xl font-semibold sm:text-4xl">
                  {formatMoney(priceForPlan(plan))}
                </span>
                <span
                  className={cn(
                    "pb-1 text-sm",
                    meta.featured ? "text-white/80" : "text-muted",
                  )}>
                  /month
                </span>
              </div>
              {vehicleType && (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    meta.featured ? "text-white/70" : "text-muted",
                  )}>
                  for your {categoryLabel(vehicleType)}
                </p>
              )}

              <ul className="mt-6 space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        meta.featured ? "bg-white/20" : "bg-primary/10",
                      )}>
                      <Check
                        className={cn(
                          "size-3",
                          meta.featured ? "text-white" : "text-primary",
                        )}
                      />
                    </span>
                    <span
                      className={
                        meta.featured ? "text-white/95" : "text-ink-soft"
                      }>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                {active && !expired ? (
                  <Button
                    variant={meta.featured ? "glass" : "outline"}
                    className={cn(
                      "w-full",
                      meta.featured && "bg-white/20 text-white",
                    )}
                    disabled={busy}
                    onClick={() => unsubscribe.mutate()}>
                    Cancel plan
                  </Button>
                ) : (
                  <Button
                    variant={meta.featured ? "glass" : "primary"}
                    className={cn(
                      "w-full",
                      meta.featured && "bg-white text-primary hover:bg-white",
                    )}
                    disabled={busy}
                    onClick={() => openCheckout(plan)}>
                    {isGuest
                      ? `Log in to choose ${plan.name}`
                      : active
                        ? `Renew ${plan.name}`
                        : `Choose ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!plansLoading && plans.length === 0 && (
        <p className="text-muted">
          No plans available right now — please check back soon.
        </p>
      )}

      {activePlan && (
        <GlassCard className="mt-6 text-center text-sm text-muted">
          You're on the{" "}
          <span className="font-medium text-ink capitalize">{activePlan}</span>{" "}
          plan. Manage or change your plan any time.
        </GlassCard>
      )}

      {/* Subscription checkout: bottom sheet on phones, dialog on larger screens. */}
      {checkoutPlan &&
        (() => {
          const meta = PLAN_META[checkoutPlan.id] ?? DEFAULT_META;
          const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const coinSaving = subQuote?.coinDiscount ?? 0;
          return (
            <ScheduleSheet
              title="Confirm your plan"
              subtitle="Review what you're getting before you pay."
              error={checkoutError}
              onClose={() => !busy && setCheckoutPlan(null)}
              footer={
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted">Due now</span>
                    <span className="font-display text-2xl font-semibold text-ink" data-testid="checkout-total">
                      {formatMoney(payableSub)}
                    </span>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="min-h-12 sm:flex-1"
                      onClick={() => setCheckoutPlan(null)}
                      disabled={busy}>
                      Not now
                    </Button>
                    <Button className="min-h-12 sm:flex-[1.6]" onClick={confirmSubscribe} disabled={busy}>
                      {subProcessing ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Processing…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-4" /> Pay {formatMoney(payableSub)}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              }>
              {/* The plan */}
              <div
                className={cn(
                  "rounded-3xl p-5",
                  meta.featured
                    ? "bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)]"
                    : "border border-line bg-surface-muted/50",
                )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold uppercase tracking-wider", meta.featured ? "text-white/75" : "text-muted")}>
                      {meta.tagline}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold">{checkoutPlan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-semibold">{formatMoney(priceForPlan(checkoutPlan))}</p>
                    <p className={cn("text-xs", meta.featured ? "text-white/75" : "text-muted")}>per month</p>
                  </div>
                </div>
                <ul className="mt-4 grid gap-2 text-sm">
                  {[washesLabel(checkoutPlan.washesPerMonth), ...meta.perks].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full",
                          meta.featured ? "bg-white/20" : "bg-primary/10 text-primary",
                        )}>
                        <Check className="size-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className={cn("mt-4 border-t pt-3 text-xs", meta.featured ? "border-white/20 text-white/80" : "border-line text-muted")}>
                  {vehicleType ? `For your ${categoryLabel(vehicleType)} · ` : ""}Valid for 30 days, until {validUntil}
                </p>
              </div>

              {/* Coins */}
              {walletCoins > 0 && (
                <button
                  type="button"
                  onClick={toggleSubCoins}
                  disabled={previewSub.isPending || busy}
                  aria-pressed={subUseCoins}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                    subUseCoins
                      ? "border-amber-400/50 bg-amber-400/10 ring-2 ring-amber-400/20"
                      : "border-line bg-surface hover:border-amber-400/40",
                  )}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                    {previewSub.isPending ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {subUseCoins ? "Coins applied" : `Use your ${walletCoins.toLocaleString("en-IN")} coins`}
                    </p>
                    <p className="text-xs text-muted">
                      {subUseCoins && coinSaving > 0
                        ? `Saving ${formatMoney(coinSaving)} on this plan`
                        : "Pay part of the plan with your coins"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      subUseCoins ? "justify-end bg-amber-500" : "justify-start bg-line",
                    )}>
                    <span className="size-5 rounded-full bg-white shadow" />
                  </span>
                </button>
              )}

              {/* Breakdown — only when coins change the price; otherwise "Due now" says it all. */}
              {coinSaving > 0 && (
              <dl className="space-y-2 rounded-2xl border border-line p-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Plan price</dt>
                  <dd className="font-medium text-ink">{formatMoney(priceForPlan(checkoutPlan))}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Coins ({subQuote!.coinsRedeemed.toLocaleString("en-IN")})</dt>
                  <dd className="font-medium text-amber-600">−{formatMoney(coinSaving)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2">
                  <dt className="font-medium text-ink">Total</dt>
                  <dd className="font-display text-lg font-semibold text-ink">{formatMoney(payableSub)}</dd>
                </div>
              </dl>
              )}
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                Secure payment. Schedule your washes right after paying.
              </p>
            </ScheduleSheet>
          );
        })()}
    </div>
  );
}

/** Sticky footer for the schedule sheets: running summary + actions. */
function ScheduleFooter({
  summary,
  confirmLabel,
  ready,
  busy,
  pending,
  onConfirm,
  onCancel,
}: {
  summary: string | null;
  confirmLabel: string;
  ready: boolean;
  busy: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <Calendar className="size-4 shrink-0 text-primary" />
        {summary ? (
          <span className="min-w-0 truncate font-medium text-ink">{summary}</span>
        ) : (
          <span className="text-muted">Choose a date and time</span>
        )}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" className="min-h-12 sm:flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="min-h-12 sm:flex-[1.6]" onClick={onConfirm} disabled={!ready || busy}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
