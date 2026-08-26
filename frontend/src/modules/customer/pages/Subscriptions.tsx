import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Calendar,
  Plus,
  X,
  Lock,
  RefreshCw,
  Trash2,
  Car,
  MapPin,
  AlertCircle,
  ArrowLeft,
  Coins,
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
import type { SubscriptionPreview } from "../api/mutations";
import { TIME_SLOTS } from "../data/catalog";
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
const DEFAULT_META: PlanMeta = { tagline: "Subscribe and save on every wash.", perks: ["Doorstep service"] };

function washesLabel(washesPerMonth: number): string {
  return washesPerMonth < 0 ? "Unlimited washes" : `${washesPerMonth} washes / month`;
}

export function Subscriptions() {
  const navigate = useNavigate();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const categoryLabel = useCategoryLabel();
  const createSubOrder = useCreateSubscriptionOrder();
  const verifySub = useVerifySubscription();
  const unsubscribe = useUnsubscribe();
  const previewSub = usePreviewSubscription();
  const { data: wallet } = useWallet();

  const { data: scheduleData, isLoading: scheduleLoading } = useSubscriptionSchedule();
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
  const cycleEnd = scheduleData?.subscriptionEndDate ? new Date(scheduleData.subscriptionEndDate).toLocaleDateString() : "";

  // The distinct vehicle types the customer owns; price previews follow the selected one.
  const ownedTypes = Array.from(new Set((me?.vehicles ?? []).map((v) => v.type)));
  const [selectedType, setSelectedType] = useState<CarType | null>(ownedTypes[0] ?? null);
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

  const payableSub = subQuote ? subQuote.price : checkoutPlan ? priceForPlan(checkoutPlan) : 0;

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
      setCheckoutError(err?.message || "Failed to subscribe. Please try again.");
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

  const handleConfirmSchedule = async () => {
    if (!selectedVehicleId || !selectedAddressId || !selectedDate || !selectedSlot) {
      return setScheduleError("Please select a vehicle, address, date, and slot.");
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
    if (window.confirm("Are you sure you want to cancel this scheduled wash?")) {
      try {
        await cancelWash.mutateAsync(bookingId);
      } catch (err: any) {
        alert(err?.message || "Failed to cancel wash");
      }
    }
  };

  const getWashesCountText = () => {
    if (washesLimit === -1) return `${scheduledBookings.length} washes scheduled`;
    return `${scheduledBookings.length} / ${washesLimit} washes used`;
  };

  // Generate 30 upcoming days starting tomorrow
  const upcoming30Days = () => {
    const dates: Date[] = [];
    const base = new Date();
    // Start tomorrow to avoid slot overlaps for today
    for (let i = 1; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
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
    return <p className="text-muted py-10 text-center">Loading subscription dashboard…</p>;
  }

  // --- RENDER 1: Active Subscription Wash Dashboard ---
  if (activePlan && !showCatalog) {
    const nextBooking = scheduledBookings.find((b) => new Date(b.date).getTime() > Date.now());

    // Generate array of cards to show
    // If washesLimit is 4 or 8, we render exactly that many slots.
    // If washesLimit is -1 (unlimited), we render booked washes + 1 empty slot.
    const slotsCount = washesLimit === -1 ? scheduledBookings.length + 1 : washesLimit;
    const slots = Array.from({ length: slotsCount }).map((_, i) => scheduledBookings[i] ?? null);

    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
              <h1 className="font-display text-2xl text-ink sm:text-3xl">Active Subscription</h1>
            </div>
            <p className="mt-2 text-sm text-muted pl-12">Book and manage your washes for this billing cycle.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCatalog(true)} className="sm:mt-1">
            Upgrade / Cancel Plan
          </Button>
        </div>

        {/* Info Grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Plan Summary */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Current Plan</p>
              <h2 className="mt-2 font-display text-2xl font-bold capitalize text-primary">
                {activePlanDetails?.name || activePlan}
              </h2>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              Cycle ends: <span className="font-semibold text-ink">{cycleEnd || "N/A"}</span>
            </p>
          </GlassCard>

          {/* Card 2: Progress */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cycle Usage</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink">{getWashesCountText()}</h2>
            </div>
            {washesLimit !== -1 && (
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(scheduledBookings.length / washesLimit) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {/* Card 3: Next Scheduled Wash */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Next Wash</p>
              {nextBooking ? (
                <div className="mt-2">
                  <h3 className="font-display text-lg font-semibold text-ink leading-tight">
                    {nextBooking.vehicleName}
                  </h3>
                  <p className="mt-1 text-xs text-muted flex items-center gap-1">
                    <Calendar className="size-3" /> {new Date(nextBooking.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {nextBooking.slot}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No upcoming washes scheduled.</p>
              )}
            </div>
            {!nextBooking && washesLimit !== 0 && (
              <Button size="sm" className="mt-4 w-fit" onClick={handleOpenSchedule}>
                Schedule now
              </Button>
            )}
          </GlassCard>
        </div>

        {/* Schedule Grid Heading */}
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Schedule Board</h2>
          <p className="text-sm text-muted">Select slots or reschedule upcoming cleanings.</p>
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((booking, idx) => {
            if (booking) {
              const locked = isLocked(booking.date);
              return (
                <GlassCard
                  key={booking.id}
                  className="relative flex flex-col justify-between border border-line bg-surface/40 hover:border-line transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Car className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-semibold text-ink leading-tight">
                            {booking.vehicleName}
                          </h3>
                          <p className="text-xs text-muted capitalize">{categoryLabel(booking.vehicleType)}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-pill px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          booking.status === "upcoming"
                            ? "bg-amber-100 text-amber-800"
                            : booking.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800",
                        )}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-ink-soft border-t border-line/50 pt-3">
                      <p className="flex items-center gap-2">
                        <Calendar className="size-4 text-primary shrink-0" />
                        <span>
                          {new Date(booking.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            weekday: "short",
                          })}{" "}
                          · {booking.slot}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary shrink-0" />
                        <span className="truncate" title={booking.addressLine}>
                          {booking.addressLabel} ({booking.addressLine})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-line/40 pt-3">
                    {locked ? (
                      <div className="flex w-full items-center gap-1.5 justify-center text-xs text-muted py-1.5">
                        <Lock className="size-3.5 text-muted/65" />
                        <span>Locked (12h window)</span>
                      </div>
                    ) : booking.status === "upcoming" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleOpenReschedule(booking)}
                          disabled={busy}
                        >
                          <RefreshCw className="size-3.5" /> Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50/15"
                          onClick={() => handleCancelWash(booking.id)}
                          disabled={busy}
                          title="Cancel Wash"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-muted italic w-full text-center py-1.5">Wash {booking.status}</div>
                    )}
                  </div>
                </GlassCard>
              );
            }

            return (
              <button
                key={`empty-${idx}`}
                onClick={handleOpenSchedule}
                disabled={busy}
                className="group flex min-h-48 flex-col items-center justify-center rounded-card border-2 border-dashed border-line hover:border-primary/50 hover:bg-primary/5 transition-all p-6 text-center focus:outline-none"
              >
                <div className="grid size-11 place-items-center rounded-full bg-surface border border-line group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm">
                  <Plus className="size-5" />
                </div>
                <h3 className="mt-3 font-display font-semibold text-ink group-hover:text-primary transition-colors">
                  Schedule Wash #{idx + 1}
                </h3>
                <p className="mt-1 text-xs text-muted">Configure a cleaning slot</p>
              </button>
            );
          })}
        </div>

        {/* MODAL 1: Schedule Wash */}
        {isScheduleOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg overflow-y-auto overflow-x-hidden max-h-[90vh] border border-line shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-display text-xl font-bold text-ink">Schedule Subscription Wash</h3>
                <button onClick={() => setIsScheduleOpen(false)} className="text-muted hover:text-ink">
                  <X className="size-5" />
                </button>
              </div>

              {scheduleError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              {/* Form Body */}
              <div className="space-y-4">
                {/* 1. Vehicle Selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Select Vehicle</label>
                  {(me?.vehicles ?? []).length === 0 ? (
                    <p className="mt-1.5 text-sm text-red-500">
                      No vehicles found. Please add a vehicle in your profile first.
                    </p>
                  ) : (
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    >
                      {(me?.vehicles ?? []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({categoryLabel(v.type)}) · {v.plate}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Address Selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Select Location</label>
                  {(me?.addresses ?? []).length === 0 ? (
                    <p className="mt-1.5 text-sm text-red-500">
                      No locations found. Please add an address in your profile first.
                    </p>
                  ) : (
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    >
                      {(me?.addresses ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} ({a.line})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 3. Date selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Pick Date</label>
                  <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1.5">
                    {upcoming30Days().map((d) => {
                      const iso = d.toISOString();
                      const isSelected = selectedDate && new Date(selectedDate).toDateString() === d.toDateString();
                      return (
                        <button
                          key={iso}
                          onClick={() => setSelectedDate(iso)}
                          className={cn(
                            "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-all focus:outline-none",
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-line bg-surface hover:border-primary/45",
                          )}
                        >
                          <span className="text-[10px] text-muted uppercase">
                            {d.toLocaleDateString("en-IN", { weekday: "short" })}
                          </span>
                          <span className="font-display text-base font-bold text-ink">{d.getDate()}</span>
                          <span className="text-[9px] text-muted">
                            {d.toLocaleDateString("en-IN", { month: "short" })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Slot selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Select Time Slot</label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-xl border py-2 text-xs font-medium transition-all focus:outline-none",
                            isSelected
                              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                              : "border-line bg-surface text-ink-soft hover:border-primary/45",
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Confirm Footer */}
              <div className="flex gap-3 border-t border-line/50 pt-4">
                <Button className="flex-1" onClick={handleConfirmSchedule} disabled={busy}>
                  Schedule Wash
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </Button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* MODAL 2: Reschedule Wash */}
        {isRescheduleOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg overflow-y-auto overflow-x-hidden max-h-[90vh] border border-line shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-display text-xl font-bold text-ink">Reschedule Wash</h3>
                <button onClick={() => setIsRescheduleOpen(false)} className="text-muted hover:text-ink">
                  <X className="size-5" />
                </button>
              </div>

              {scheduleError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              {/* Form Body */}
              <div className="space-y-4">
                {/* Date selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Pick New Date</label>
                  <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1.5">
                    {upcoming30Days().map((d) => {
                      const iso = d.toISOString();
                      const isSelected = selectedDate && new Date(selectedDate).toDateString() === d.toDateString();
                      return (
                        <button
                          key={iso}
                          onClick={() => setSelectedDate(iso)}
                          className={cn(
                            "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-all focus:outline-none",
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-line bg-surface hover:border-primary/45",
                          )}
                        >
                          <span className="text-[10px] text-muted uppercase">
                            {d.toLocaleDateString("en-IN", { weekday: "short" })}
                          </span>
                          <span className="font-display text-base font-bold text-ink">{d.getDate()}</span>
                          <span className="text-[9px] text-muted">
                            {d.toLocaleDateString("en-IN", { month: "short" })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slot selection */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Select Time Slot</label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-xl border py-2 text-xs font-medium transition-all focus:outline-none",
                            isSelected
                              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                              : "border-line bg-surface text-ink-soft hover:border-primary/45",
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Confirm Footer */}
              <div className="flex gap-3 border-t border-line/50 pt-4">
                <Button className="flex-1" onClick={handleConfirmReschedule} disabled={busy}>
                  Confirm Reschedule
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsRescheduleOpen(false)}>
                  Cancel
                </Button>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER 2: Subscriptions Catalog Catalog ---
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <h1 className="font-display text-2xl text-ink sm:text-3xl">Subscription plans</h1>
          </div>
          <p className="mt-2 text-sm text-muted pl-12">Subscribe once, save on every wash. Cancel anytime.</p>
        </div>
        {activePlan && (
          <Button variant="outline" size="sm" onClick={() => setShowCatalog(false)} className="sm:mt-1">
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
                )}
              >
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
              )}
            >
              {meta.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  Popular
                </span>
              )}
              <h2 className={cn("font-display text-2xl font-semibold", meta.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h2>
              <p className={cn("mt-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>{meta.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                {!vehicleType && (
                  <span className={cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>from</span>
                )}
                <span className="font-display text-3xl font-semibold sm:text-4xl">{formatMoney(priceForPlan(plan))}</span>
                <span className={cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>/month</span>
              </div>
              {vehicleType && (
                <p className={cn("mt-1 text-xs", meta.featured ? "text-white/70" : "text-muted")}>
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
                      )}
                    >
                      <Check className={cn("size-3", meta.featured ? "text-white" : "text-primary")} />
                    </span>
                    <span className={meta.featured ? "text-white/95" : "text-ink-soft"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                {active ? (
                  <Button
                    variant={meta.featured ? "glass" : "outline"}
                    className={cn("w-full", meta.featured && "bg-white/20 text-white")}
                    disabled={busy}
                    onClick={() => unsubscribe.mutate()}
                  >
                    Cancel plan
                  </Button>
                ) : (
                  <Button
                    variant={meta.featured ? "glass" : "primary"}
                    className={cn("w-full", meta.featured && "bg-white text-primary hover:bg-white")}
                    disabled={busy}
                    onClick={() => openCheckout(plan)}
                  >
                    {isGuest ? `Log in to choose ${plan.name}` : `Choose ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!plansLoading && plans.length === 0 && (
        <p className="text-muted">No plans available right now — please check back soon.</p>
      )}

      {activePlan && (
        <GlassCard className="mt-6 text-center text-sm text-muted">
          You're on the <span className="font-medium text-ink capitalize">{activePlan}</span> plan.
          Manage or change your plan any time.
        </GlassCard>
      )}

      {/* MODAL: Subscription checkout */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md border border-line shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-xl font-bold text-ink">Confirm subscription</h3>
              <button onClick={() => setCheckoutPlan(null)} className="text-muted hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <div>
              <p className="font-display text-lg font-semibold text-ink">{checkoutPlan.name}</p>
              <p className="text-sm text-muted">
                {washesLabel(checkoutPlan.washesPerMonth)}
                {vehicleType ? ` · ${categoryLabel(vehicleType)}` : ""}
              </p>
            </div>

            {checkoutError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500">
                <AlertCircle className="size-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {walletCoins > 0 && (
              <button
                type="button"
                onClick={toggleSubCoins}
                disabled={previewSub.isPending}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  subUseCoins
                    ? "border-amber-400/50 bg-amber-400/10 ring-2 ring-amber-400/20"
                    : "border-line bg-surface hover:border-amber-400/40",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Coins className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {subUseCoins ? "Coins applied" : `Use your ${walletCoins.toLocaleString("en-IN")} coins`}
                  </p>
                  <p className="text-xs text-muted">
                    {subUseCoins && subQuote && subQuote.coinDiscount > 0
                      ? `Saving ${formatMoney(subQuote.coinDiscount)} with coins`
                      : "Redeem coins for a discount on this plan"}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                    subUseCoins ? "bg-amber-500 justify-end" : "bg-line justify-start",
                  )}
                >
                  <span className="size-5 rounded-full bg-white shadow" />
                </span>
              </button>
            )}

            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Plan price</dt>
                <dd className="font-medium text-ink">{formatMoney(priceForPlan(checkoutPlan))}/mo</dd>
              </div>
              {subQuote && subQuote.coinDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Coins ({subQuote.coinsRedeemed.toLocaleString("en-IN")})</dt>
                  <dd className="font-medium text-amber-600">−{formatMoney(subQuote.coinDiscount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <dt className="text-muted">Due now</dt>
                <dd className="font-display text-xl font-semibold text-ink">{formatMoney(payableSub)}</dd>
              </div>
            </dl>

            <div className="flex gap-3 border-t border-line/50 pt-4">
              <Button className="flex-1" onClick={confirmSubscribe} disabled={busy}>
                {subProcessing ? "Processing…" : `Pay ${formatMoney(payableSub)}`}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setCheckoutPlan(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
