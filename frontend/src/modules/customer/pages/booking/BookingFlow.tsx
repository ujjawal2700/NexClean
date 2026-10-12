import { useEffect, useMemo, useRef, useState } from "react";
import { bookingAmountDue, computeTax, formatMoneyExact, type TaxBreakdown } from "@shared/lib/tax";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  MapPin,
  Plus,
  CheckCircle2,
  Loader2,
  Tag,
  X,
  Coins,
  Radio,
  Crosshair,
  IndianRupee,
  History,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import {
  BrandModelSelect,
  type VehicleSelection,
} from "../../components/BrandModelSelect";
import { VehicleColorPicker, ColorChip } from "../../components/VehicleColorPicker";
import { ApiError } from "@shared/lib/api";
import {
  useMe,
  useVehicleCategories,
  useCategoryLabel,
  useWallet,
  useOffPeakHours,
  useTimeSlots,
  useSlotLeadMinutes,
  useTaxSettings,
  usePaymentMode,
  vehicleCategoriesKey,
} from "../../api/queries";
import { isOffPeakSlot, windowsForDate } from "../../data/offPeakHours";
import {
  useVerifyPayment,
  useCreateOrder,
  usePreviewDiscount,
} from "../../api/mutations";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import type { PreviewAmountResponse } from "../../api/mutations";
import { ServicePinPicker } from "@shared/components/map/ServicePinPicker";
import { AddAddressModal } from "@shared/components/address/AddAddressModal";
import type { LatLng } from "@shared/lib/maps";
import {
  PACKAGES,
  availableSlotsForDate,
  upcomingDates,
  priceFor,
} from "../../data/catalog";
import type {
  CarType,
  Booking,
  Vehicle,
  Address,
  VehicleCategory,
} from "../../types";
import { formatMoney } from "@shared/lib/format";
import { Stepper, STEP_LABELS } from "./Stepper";
import { functionalStorageAllowed } from "@shared/lib/cookieConsent";

type Draft = {
  vehicleType: CarType | null;
  vehicleName: string;
  /** Number plate and colour, so the cleaner can find the car. */
  vehiclePlate: string;
  vehicleColor: string;
  vehicleColorHex: string;
  packageId: string | null;
  date: string | null;
  slot: string | null;
  addressId: string | null;
  /**
   * The exact spot the cleaner drives to, dropped on a map by the customer.
   *
   * Separate from the address's own coordinates on purpose: a saved address
   * geocodes to a building or a gate, while the car is in a particular bay of
   * a particular basement. This is the point the live tracking map, the ETA and
   * the nearest-cleaner search all run on, so it is worth asking for.
   */
  pin: LatLng | null;
};

const EMPTY: Draft = {
  vehicleType: null,
  vehicleName: "",
  vehiclePlate: "",
  vehicleColor: "",
  vehicleColorHex: "",
  packageId: null,
  date: null,
  slot: null,
  addressId: null,
  pin: null,
};

/**
 * An unfinished booking, kept until the customer pays or chooses to start
 * over. localStorage (not sessionStorage) so it survives closing the tab; the
 * owner's id so a shared phone never offers one customer another's booking.
 */
const DRAFT_STORAGE_KEY = "nexclean-booking-draft";

type SavedBooking = { step: number; draft: Draft; userId: string | null };

function clearSavedBooking() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    // Drafts used to live in sessionStorage; drop any leftover copy.
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * A saved booking worth offering back, or null. A date or slot that has passed
 * since it was saved is dropped, and the customer is sent back to Schedule to
 * pick a new one rather than landing on a checkout they can't pay for.
 */
function readSavedBooking(): SavedBooking | null {
  if (!functionalStorageAllowed()) return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedBooking>;
    if (typeof parsed.step !== "number" || !parsed.draft) return null;
    const draft: Draft = { ...EMPTY, ...parsed.draft };
    // Nothing chosen yet — nothing to continue.
    if (!draft.vehicleType) return null;

    let step = Math.min(Math.max(0, Math.floor(parsed.step)), STEP_LABELS.length - 1);
    if (draft.date) {
      const day = new Date(draft.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const datePassed = Number.isNaN(day.getTime()) || dayStart < today;
      const slotGone = !!draft.slot && !availableSlotsForDate(draft.date).includes(draft.slot);
      if (datePassed || slotGone) {
        draft.date = datePassed ? null : draft.date;
        draft.slot = null;
        step = Math.min(step, 2);
      }
    }
    return { step, draft, userId: parsed.userId ?? null };
  } catch {
    return null;
  }
}

export function BookingFlow() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: categories = [] } = useVehicleCategories();
  const categoryLabel = useCategoryLabel();
  const vehicles = me?.vehicles ?? [];
  const addresses = me?.addresses ?? [];
  const verifyPayment = useVerifyPayment();
  const createOrder = useCreateOrder();
  const previewDiscount = usePreviewDiscount();
  const { data: wallet } = useWallet();

  // A booking left unfinished earlier. Held here, not applied, until the
  // customer chooses to continue it or start over.
  const [saved, setSaved] = useState<SavedBooking | null>(readSavedBooking);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [payError, setPayError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [priceChanged, setPriceChanged] = useState<number | null>(null);

  // Someone else's draft on this device (they logged out, another customer
  // logged in): never offer it.
  const savedIsOthers = !!saved?.userId && !!me && saved.userId !== me.id;
  useEffect(() => {
    if (savedIsOthers) {
      clearSavedBooking();
      setSaved(null);
    }
  }, [savedIsOthers]);
  // Wait for the profile before asking, so the check above has run.
  const resumeOffer = saved && me && !savedIsOthers ? saved : null;

  const continueSaved = () => {
    if (!saved) return;
    // The saved address may have been deleted since; send them back to pick
    // one instead of resuming onto a Pay button that silently does nothing.
    const addressGone = !!saved.draft.addressId && !addresses.some((a) => a.id === saved.draft.addressId);
    setDraft(addressGone ? { ...saved.draft, addressId: null, pin: null } : saved.draft);
    setStep(addressGone ? Math.min(saved.step, 3) : saved.step);
    setSaved(null);
  };
  const startNew = () => {
    clearSavedBooking();
    setSaved(null);
  };

  // Save progress on every change until checkout. Paused while the resume
  // question is open, or this would overwrite the saved booking with the
  // empty form underneath before the customer has answered.
  useEffect(() => {
    if (saved || confirmed || !functionalStorageAllowed()) return;
    if (!draft.vehicleType) {
      clearSavedBooking();
      return;
    }
    try {
      const payload: SavedBooking = { step, draft, userId: me?.id ?? null };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage full or blocked — booking still works, it just won't be kept */
    }
  }, [step, draft, saved, confirmed, me?.id]);

  // Paid and confirmed: the booking exists now, nothing left to resume.
  useEffect(() => {
    if (confirmed) clearSavedBooking();
  }, [confirmed]);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] =
    useState<PreviewAmountResponse | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const basePriceFor = (key: string) =>
    categories.find((c) => c.key === key)?.basePrice ?? 0;
  const pkg = useMemo(
    () => PACKAGES.find((p) => p.id === draft.packageId) ?? null,
    [draft.packageId],
  );
  const total =
    draft.vehicleType && pkg
      ? priceFor(basePriceFor(draft.vehicleType), pkg)
      : 0;
  // GST is added on top of the discounted price (bookkeeping settings). The
  // server's quote wins when there is one; otherwise mirror its maths here.
  const taxSettings = useTaxSettings();
  const afterDiscount = appliedDiscount ? appliedDiscount.price : total;
  const taxQuote = appliedDiscount?.tax ?? computeTax(afterDiscount, taxSettings);
  const taxLabel = appliedDiscount?.tax?.label ?? taxSettings?.label ?? "GST";
  const payable = total ? taxQuote.payableAmount : 0;
  const address = addresses.find((a) => a.id === draft.addressId) ?? null;
  const walletCoins = wallet?.coins ?? 0;

  /** Re-price with the server, factoring in the applied code and any coins redeemed. */
  const refreshQuote = async (code: string | undefined, coins: number, force = false) => {
    if (!draft.vehicleType || !pkg) return;
    if (!force && !code && coins <= 0) {
      setAppliedDiscount(null);
      return;
    }
    const result = await previewDiscount.mutateAsync({
      vehicleType: draft.vehicleType,
      packageId: pkg.id,
      discountCode: code,
      coinsToRedeem: coins > 0 ? coins : undefined,
      // Sent so an off-peak-only code is judged against the slot the customer
      // actually picked, exactly as booking creation will judge it.
      date: draft.date ?? undefined,
      slot: draft.slot ?? undefined,
    });
    setAppliedDiscount(result);
    return result;
  };

  const applyDiscount = async () => {
    if (!draft.vehicleType || !pkg || !discountInput.trim()) return;
    setDiscountError("");
    try {
      await refreshQuote(discountInput.trim(), coinsToRedeem);
    } catch (e) {
      setDiscountError(
        e instanceof ApiError ? e.message : "Invalid discount code",
      );
    }
  };

  const clearDiscount = async () => {
    setDiscountInput("");
    setDiscountError("");
    try {
      await refreshQuote(undefined, coinsToRedeem);
    } catch {
      /* leave prior quote in place */
    }
  };

  const toggleCoins = async () => {
    const next = coinsToRedeem > 0 ? 0 : walletCoins;
    const code = appliedDiscount?.discountCode
      ? discountInput.trim()
      : undefined;
    try {
      await refreshQuote(code, next);
      setCoinsToRedeem(next);
    } catch {
      /* ignore */
    }
  };

  /**
   * An off-peak-only code is tied to the slot it was applied on, so going back
   * and picking a different time can invalidate a code that is already showing
   * as applied. Re-validate whenever the schedule changes: without this the
   * stale discount survives to `pay()`, where the server rejects it and the
   * customer meets a payment error instead of a clear "doesn't apply" message
   * on the screen where they can still act on it.
   */
  const validatedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${draft.date ?? ""}|${draft.slot ?? ""}`;
    if (validatedFor.current === key) return;
    validatedFor.current = key;

    if (!appliedDiscount?.discountCode || !draft.date || !draft.slot) return;

    let cancelled = false;
    void (async () => {
      try {
        await refreshQuote(discountInput.trim(), coinsToRedeem);
      } catch (e) {
        if (cancelled) return;
        setDiscountError(
          e instanceof ApiError
            ? e.message
            : "That code doesn't apply to the time slot you picked",
        );
        setDiscountInput("");
        // Drop only the code — any coins the customer redeemed should survive.
        try {
          await refreshQuote(undefined, coinsToRedeem);
        } catch {
          if (!cancelled) setAppliedDiscount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on the schedule alone: re-running on discount/coin
    // changes would re-quote on every keystroke and fight refreshQuote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date, draft.slot]);

  const canContinue = [
    !!draft.vehicleType,
    !!draft.packageId,
    !!draft.date && !!draft.slot,
    !!draft.addressId,
    true,
  ][step];

  const pay = async () => {
    if (!draft.vehicleType || !pkg || !draft.date || !draft.slot || !address)
      return;
    setPayError("");
    setProcessing(true);

    const bookingInput = {
      vehicleType: draft.vehicleType,
      vehicleName: draft.vehicleName || categoryLabel(draft.vehicleType),
      vehiclePlate: draft.vehiclePlate.trim() || undefined,
      vehicleColor: draft.vehicleColor.trim() || undefined,
      vehicleColorHex: draft.vehicleColorHex || undefined,
      packageId: pkg.id,
      date: draft.date,
      slot: draft.slot,
      addressLabel: address.label,
      addressLine: address.line,
      discountCode: appliedDiscount?.discountCode
        ? discountInput.trim()
        : undefined,
      coinsToRedeem: coinsToRedeem > 0 ? coinsToRedeem : undefined,
      // The dropped pin wins over the address's geocode — it is the more
      // precise of the two, and the one the customer will watch the cleaner
      // approach. GeoJSON stores [lng, lat]; the API expects lat/lng.
      lat: draft.pin?.lat ?? address.coordinates?.[1],
      lng: draft.pin?.lng ?? address.coordinates?.[0],
    };

    try {
      /**
       * Ask the server to open an order first, and let its answer choose the
       * route. `mock: true` means no gateway is configured, so the booking is
       * confirmed directly and the customer pays the cleaner in cash.
       *
       * This branch used to be commented out with the direct confirm hardcoded
       * above it — which quietly made the app unable to accept online payment at
       * all. Worse, it was a trap rather than a limitation: the moment real
       * Razorpay keys were added, /payments/verify starts demanding a signature
       * and the hardcoded call would have failed every booking with "Missing
       * payment confirmation fields". Letting the server decide means adding
       * keys switches the flow on instead of breaking it.
       */
      const order = await createOrder.mutateAsync({
        booking: bookingInput,
        expectedAmount: payable,
      });

      if (order.mock) {
        const booking = await verifyPayment.mutateAsync({
          booking: bookingInput,
          razorpay_order_id: order.orderId,
        });
        setConfirmed(booking);
        setProcessing(false);
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
        description: `${pkg.name} · ${bookingInput.vehicleName}`,
        prefill: { name: me?.name, contact: me?.phone },
        theme: { color: "#4F7CFF" },
        handler: async (r) => {
          try {
            const booking = await verifyPayment.mutateAsync({
              booking: bookingInput,
              ...r,
            });
            setConfirmed(booking);
          } catch (e) {
            setPayError(
              e instanceof ApiError ? e.message : "Payment verification failed",
            );
          } finally {
            setProcessing(false);
          }
        },
        // Closing the sheet without paying must release the button, not leave
        // the customer staring at a spinner they cannot clear.
        modal: { ondismiss: () => setProcessing(false) },
      });
    } catch (e) {
      const details = e instanceof ApiError ? e.details as { code?: string; currentAmount?: number } | undefined : undefined;
      if (e instanceof ApiError && e.status === 409 && details?.code === "PRICE_CHANGED") {
        setPriceChanged(typeof details.currentAmount === "number" ? details.currentAmount : payable);
        setProcessing(false);
        return;
      }
      setPayError(
        e instanceof ApiError ? e.message : "Payment failed. Please try again.",
      );
      setProcessing(false);
    }
  };

  const acceptUpdatedPrice = async () => {
    setProcessing(true);
    try {
      // Refresh both the catalog base price and the server-computed final
      // quote. The latter keeps discounts and redeemed coins authoritative.
      await qc.invalidateQueries({ queryKey: vehicleCategoriesKey });
      await refreshQuote(
        appliedDiscount?.discountCode ? discountInput.trim() : undefined,
        coinsToRedeem,
        true,
      );
      setPriceChanged(null);
      setPayError("");
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Couldn't refresh the new price. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (confirmed) return <Confirmation booking={confirmed} />;

  return (
    <div className="mx-auto max-w-4xl overflow-x-clip">
      <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="flex shrink-0 items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer"
          aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">
          Book a cleaning
        </h1>
      </div>

      <Stepper current={step} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* step body */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}>
              {step === 0 && (
                <VehicleStep
                  draft={draft}
                  set={set}
                  vehicles={vehicles}
                  categoryLabel={categoryLabel}
                />
              )}
              {step === 1 && (
                <PackageStep draft={draft} set={set} categories={categories} />
              )}
              {step === 2 && <ScheduleStep draft={draft} set={set} />}
              {step === 3 && (
                <AddressStep draft={draft} set={set} addresses={addresses} />
              )}
              {step === 4 && (
                <PaymentSummary
                  draft={draft}
                  categoryLabel={categoryLabel}
                  subtotal={total}
                  total={payable}
                  tax={taxQuote}
                  taxLabel={taxLabel}
                  discountInput={discountInput}
                  setDiscountInput={setDiscountInput}
                  appliedDiscount={appliedDiscount}
                  discountError={discountError}
                  applyDiscount={applyDiscount}
                  clearDiscount={clearDiscount}
                  applying={previewDiscount.isPending}
                  walletCoins={walletCoins}
                  coinsUsed={coinsToRedeem}
                  coinDiscount={appliedDiscount?.coinDiscount ?? 0}
                  toggleCoins={toggleCoins}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* nav */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="shrink-0">
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={pay}
                disabled={processing}
                className="min-w-36 sm:min-w-44">
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Pay {formatMoney(payable)}</>
                )}
              </Button>
            )}
          </div>
          {payError && (
            <p className="mt-3 text-right text-sm text-red-500">{payError}</p>
          )}
        </div>

        {/* live summary */}
        <OrderSummary
          draft={draft}
          total={payable}
          tax={taxQuote}
          taxLabel={taxLabel}
          discount={appliedDiscount}
          step={step}
          address={address?.label}
        />
      </div>

      {resumeOffer && (
        <ResumeBookingDialog
          saved={resumeOffer}
          vehicleLabel={
            resumeOffer.draft.vehicleName ||
            (resumeOffer.draft.vehicleType ? categoryLabel(resumeOffer.draft.vehicleType) : "")
          }
          onContinue={continueSaved}
          onStartNew={startNew}
        />
      )}

      {priceChanged !== null && (
        <PriceChangedDialog
          amount={priceChanged}
          loading={processing}
          onConfirm={acceptUpdatedPrice}
        />
      )}
    </div>
  );
}

function ResumeBookingDialog({
  saved,
  vehicleLabel,
  onContinue,
  onStartNew,
}: {
  saved: SavedBooking;
  vehicleLabel: string;
  onContinue: () => void;
  onStartNew: () => void;
}) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    continueRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const next = document.activeElement === continueRef.current ? newRef.current : continueRef.current;
      next?.focus();
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const { draft, step } = saved;
  const pkg = PACKAGES.find((p) => p.id === draft.packageId);
  const when = draft.date
    ? `${new Date(draft.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}${
        draft.slot ? ` · ${draft.slot}` : ""
      }`
    : null;
  const rows = [
    { label: "Vehicle", value: vehicleLabel },
    { label: "Package", value: pkg?.name },
    { label: "Schedule", value: when },
  ].filter((r): r is { label: string; value: string } => !!r.value);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="resume-booking-title"
        aria-describedby="resume-booking-description"
        className="w-full max-w-md rounded-[28px] border border-line bg-surface p-6 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <History className="size-7" />
        </div>
        <h2 id="resume-booking-title" className="font-display text-2xl font-semibold text-ink">
          Continue where you left off?
        </h2>
        <p id="resume-booking-description" className="mt-2 text-sm leading-6 text-muted">
          You have an unfinished booking. Pick up at the{" "}
          <span className="font-semibold text-ink">{STEP_LABELS[step]}</span> step, or start a new one.
        </p>

        {rows.length > 0 && (
          <dl className="mt-4 space-y-2 rounded-2xl border border-line bg-surface-muted/50 p-4 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4">
                <dt className="shrink-0 text-muted">{r.label}</dt>
                <dd className="min-w-0 text-right font-medium text-ink wrap-anywhere">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <Button ref={continueRef} onClick={onContinue} className="min-h-12 w-full justify-center text-base">
            Continue booking
            <ArrowRight className="size-4" />
          </Button>
          <Button
            ref={newRef}
            variant="outline"
            onClick={onStartNew}
            className="min-h-12 w-full justify-center text-base"
          >
            Start a new booking
          </Button>
        </div>
      </section>
    </div>
  );
}

function PriceChangedDialog({
  amount,
  loading,
  onConfirm,
}: {
  amount: number;
  loading: boolean;
  onConfirm: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="price-changed-title"
        aria-describedby="price-changed-description"
        className="w-full max-w-md rounded-[28px] border border-line bg-surface p-6 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <IndianRupee className="size-7" />
        </div>
        <h2 id="price-changed-title" className="font-display text-2xl font-semibold text-ink">
          The price has been updated
        </h2>
        <p id="price-changed-description" className="mt-2 text-sm leading-6 text-muted">
          The service price changed while you were checking out. No payment was taken. Your updated total is
          <span className="font-semibold text-ink"> {formatMoney(amount)}</span>.
        </p>
        <Button
          ref={buttonRef}
          onClick={onConfirm}
          disabled={loading}
          className="mt-6 min-h-12 w-full justify-center text-base"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          OK, update my total
        </Button>
      </section>
    </div>
  );
}

/* ------------------------------- Steps ---------------------------------- */

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

function VehicleStep({
  draft,
  set,
  vehicles,
  categoryLabel,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  vehicles: Vehicle[];
  categoryLabel: (key: string) => string;
}) {
  const { data: categories = [] } = useVehicleCategories();
  const usingSavedVehicle = vehicles.some(
    (v) => v.name === draft.vehicleName && v.type === draft.vehicleType,
  );

  const onResolved = (selection: VehicleSelection | null) => {
    if (selection)
      set({
        vehicleType: selection.categoryKey,
        vehicleName: `${selection.brand} ${selection.model}`,
      });
  };

  return (
    <div>
      <StepHeading
        title="Which vehicle?"
        subtitle="Choose from your garage or search your brand & model."
      />

      {vehicles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => {
            const selected =
              draft.vehicleName === v.name && draft.vehicleType === v.type;
            return (
              <button
                key={v.id}
                onClick={() =>
                  set({
                    vehicleType: v.type,
                    vehicleName: v.name,
                    vehiclePlate: v.plate && v.plate !== "—" ? v.plate : "",
                    vehicleColor: v.color ?? "",
                    vehicleColorHex: v.colorHex ?? "",
                  })
                }
                className={cn(
                  "flex items-center gap-3 rounded-card border p-4 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-line bg-surface hover:border-primary/40",
                )}>
                <div className="w-20 shrink-0">
                  <CarSilhouette
                    type={v.type}
                    imageUrl={
                      categories.find((c) => c.key === v.type)?.imageUrl
                    }
                    uid={`pick-${v.id}`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">
                    {v.name}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                    {categoryLabel(v.type)}
                    {v.plate && v.plate !== "—" && <> · {v.plate}</>}
                    {(v.color || v.colorHex) && (
                      <>
                        {" · "}
                        <ColorChip color={v.color} colorHex={v.colorHex} />
                      </>
                    )}
                  </p>
                </div>
                {selected && <Check className="ml-auto size-5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-2 mt-4 text-sm font-medium text-muted">
        Or search your brand &amp; model
      </p>
      <div className="grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2">
        <BrandModelSelect onResolved={onResolved} />
      </div>

      {!usingSavedVehicle && draft.vehicleType && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Check className="size-4 text-primary" /> {draft.vehicleName} ·{" "}
          {categoryLabel(draft.vehicleType)}
        </p>
      )}

      {/* Plate and colour help the cleaner find the right car on arrival. */}
      {draft.vehicleType && (
        <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface-muted/40 p-4">
          <div>
            <p className="font-display font-semibold text-ink">Vehicle details</p>
            <p className="text-sm text-muted">Helps your specialist spot the right car.</p>
          </div>
          <Input
            name="vehiclePlate"
            label="Vehicle number"
            placeholder="GJ 01 AB 1234"
            maxLength={20}
            value={draft.vehiclePlate}
            onChange={(e) => set({ vehiclePlate: e.target.value.toUpperCase() })}
          />
          <VehicleColorPicker
            idPrefix="booking"
            value={{ color: draft.vehicleColor, colorHex: draft.vehicleColorHex }}
            onChange={(c) => set({ vehicleColor: c.color, vehicleColorHex: c.colorHex })}
          />
        </div>
      )}
    </div>
  );
}

function PackageStep({
  draft,
  set,
  categories,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  categories: VehicleCategory[];
}) {
  const basePriceFor = (key: string) =>
    categories.find((c) => c.key === key)?.basePrice ?? 0;
  return (
    <div>
      <StepHeading
        title="Choose a package"
        subtitle="Pricing shown for your selected vehicle."
      />
      <div className="space-y-3">
        {PACKAGES.map((p) => {
          const selected = draft.packageId === p.id;
          const price = draft.vehicleType
            ? priceFor(basePriceFor(draft.vehicleType), p)
            : null;
          return (
            <button
              key={p.id}
              onClick={() => set({ packageId: p.id })}
              className={cn(
                "flex w-full items-start gap-4 rounded-card border p-5 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-line bg-surface hover:border-primary/40",
              )}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg font-semibold text-ink">
                    {p.name}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3.5" /> {p.durationLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{p.tagline}</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <Check className="size-3 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                {price !== null && (
                  <p className="font-display text-xl font-semibold text-ink">
                    {formatMoney(price)}
                  </p>
                )}
                <span
                  className={cn(
                    "mt-2 inline-grid size-6 place-items-center rounded-full",
                    selected ? "bg-primary text-white" : "border border-line",
                  )}>
                  {selected && <Check className="size-3.5" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleStep({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}) {
  const allSlots = useTimeSlots();
  const leadMinutes = useSlotLeadMinutes();
  const dates = upcomingDates(7, allSlots, leadMinutes);
  const slots = availableSlotsForDate(draft.date, allSlots, leadMinutes);
  const { data: offPeakConfig } = useOffPeakHours();
  const offPeakWindows = windowsForDate(offPeakConfig, draft.date);

  // When a date is selected, if the currently chosen slot is no longer valid, clear it.
  const selectDate = (iso: string) => {
    const available = availableSlotsForDate(iso, allSlots, leadMinutes);
    const slotStillValid = draft.slot && available.includes(draft.slot);
    set({ date: iso, slot: slotStillValid ? draft.slot : null });
  };

  return (
    <div>
      <StepHeading
        title="Pick a date & time"
        subtitle="When should the specialist arrive?"
      />

      {/* Date picker — horizontal scroll ONLY within this row, never the page */}
      <div className="-mx-0 w-full">
        <div
          className="flex gap-2.5 overflow-x-auto pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}>
          {dates.map((d) => {
            const iso = d.toISOString();
            const selected =
              draft.date &&
              new Date(draft.date).toDateString() === d.toDateString();
            return (
              <button
                key={iso}
                onClick={() => selectDate(iso)}
                className={cn(
                  "flex w-[4.25rem] shrink-0 flex-col items-center rounded-2xl border py-3 transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-line bg-surface hover:border-primary/40",
                )}>
                <span className="text-[11px] font-medium text-muted">
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="font-display text-lg font-semibold text-ink">
                  {d.getDate()}
                </span>
                <span className="text-[11px] text-muted">
                  {d.toLocaleDateString("en-IN", { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">Time slot</p>
        {offPeakWindows.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Cheaper{" "}
            {offPeakWindows.map((w) => `${w.start}–${w.end}`).join(", ")}
          </span>
        )}
      </div>
      {draft.date && slots.length === 0 ? (
        <p className="rounded-2xl border border-amber-300/40 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
          No more slots available today — please pick a future date.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-4">
          {slots.map((slot) => {
            const selected = draft.slot === slot;
            // A hint only — the server decides whether an off-peak coupon applies.
            const offPeak = isOffPeakSlot(offPeakConfig, draft.date, slot);
            return (
              <button
                key={slot}
                onClick={() => set({ slot })}
                className={cn(
                  "relative rounded-xl border px-2 py-2.5 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                    : offPeak
                      ? "border-emerald-400/50 bg-emerald-50/40 text-ink-soft hover:border-primary/40"
                      : "border-line bg-surface text-ink-soft hover:border-primary/40",
                )}
                // Off-peak status rides on `title` and `data-off-peak`, never on
                // an aria-label: the dot is inside the button, so labelling it
                // would append to the button's accessible name and the control
                // would stop being addressable as plainly "11:00 AM". The
                // legend above the grid carries the meaning in text.
                title={
                  offPeak
                    ? `${slot} — off-peak slot, discounts apply`
                    : undefined
                }
                data-off-peak={offPeak ? "true" : undefined}>
                {slot}
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
      {offPeakWindows.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Slots marked with a green dot are our quieter hours — discount codes
          apply to these.
        </p>
      )}
    </div>
  );
}

function AddressStep({
  draft,
  set,
  addresses,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  addresses: Address[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedAddress =
    addresses.find((a) => a.id === draft.addressId) ?? null;
  const addressCenter: LatLng | null = selectedAddress?.coordinates
    ? {
        lat: selectedAddress.coordinates[1],
        lng: selectedAddress.coordinates[0],
      }
    : null;

  // A pin belongs to the address it was dropped on. Switching addresses has to
  // discard it, otherwise the booking silently carries the previous address's
  // coordinates and the cleaner is routed to the wrong place entirely.
  const [pinnedFor, setPinnedFor] = useState<string | null>(draft.addressId);
  useEffect(() => {
    if (draft.addressId === pinnedFor) return;
    setPinnedFor(draft.addressId);
    set({ pin: null });
    // `set` is recreated every render by the parent; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.addressId, pinnedFor]);

  return (
    <div>
      <StepHeading
        title="Where should we come?"
        subtitle="Select a saved address or add a new one."
      />

      {addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((a) => {
            const selected = draft.addressId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => set({ addressId: a.id })}
                className={cn(
                  "flex w-full items-center gap-4 rounded-card border p-4 text-left transition-all cursor-pointer",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-line bg-surface hover:border-primary/40",
                )}
                data-testid={`select-address-${a.id}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-ink">
                      {a.label}
                    </p>
                    {a.coordinates && a.coordinates.length === 2 && (
                      <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        📍 Pinned
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted">{a.line}</p>
                </div>
                {selected && <Check className="ml-auto size-5 text-primary" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center rounded-2xl border border-dashed border-line bg-surface-muted/40 p-6">
          <MapPin className="mx-auto size-8 text-muted" />
          <p className="mt-2 font-display font-semibold text-ink">
            No addresses added yet
          </p>
          <p className="text-xs text-muted mt-0.5">
            Add your address with exact map coordinates to continue.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setShowAddModal(true)}
            data-testid="add-first-address-btn">
            <Plus className="size-4" /> Add your address
          </Button>
        </div>
      )}

      {selectedAddress && (
        <div className="mt-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Crosshair className="size-4 text-primary" />
            <div>
              <p className="font-display text-sm font-semibold text-ink">
                Drop your exact pin
              </p>
              <p className="text-xs text-muted">
                Move the map so the pin sits on your car. Your cleaner navigates
                to this exact spot.
              </p>
            </div>
          </div>
          <ServicePinPicker
            value={draft.pin}
            fallbackCenter={addressCenter}
            onChange={(coords) => set({ pin: coords })}
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
          data-testid="add-new-address-btn">
          <Plus className="size-4" /> Add a new address
        </Button>
        <Link
          to="/app/profile/addresses?add=true"
          className="text-xs text-muted hover:text-primary transition-colors">
          Manage all saved addresses
        </Link>
      </div>

      {showAddModal && (
        <AddAddressModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newAddr) => {
            set({ addressId: newAddr.id });
          }}
        />
      )}
    </div>
  );
}

function PaymentSummary({
  draft,
  categoryLabel,
  subtotal,
  total,
  discountInput,
  setDiscountInput,
  appliedDiscount,
  discountError,
  applyDiscount,
  clearDiscount,
  applying,
  walletCoins,
  coinsUsed,
  coinDiscount,
  toggleCoins,
  tax,
  taxLabel,
}: {
  draft: Draft;
  categoryLabel: (key: string) => string;
  subtotal: number;
  total: number;
  tax: TaxBreakdown;
  taxLabel: string;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  appliedDiscount: PreviewAmountResponse | null;
  discountError: string;
  applyDiscount: () => void;
  clearDiscount: () => void;
  applying: boolean;
  walletCoins: number;
  coinsUsed: number;
  coinDiscount: number;
  toggleCoins: () => void;
}) {
  // Cached query — reading it here avoids threading the flag through props.
  const { data: paymentMode } = usePaymentMode();
  const payOnline = paymentMode?.online ?? false;
  // No payment-method picker: NexClean is pay-to-cleaner, so the money is
  // always collected in cash on completion. Offering UPI/Card/Wallet implied a
  // choice that doesn't exist and that nothing downstream acted on.
  return (
    <div>
      <StepHeading
        title="Payment"
        subtitle="Review your total and confirm the booking."
      />

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
          <Tag className="size-4 text-muted" /> Have a discount code?
        </p>
        {/* A quote exists whenever coins are on, too — only a quote carrying a
            code means a code is applied. Keying on the quote alone replaced the
            input with "null applied · You saved ₹0" as soon as coins were used,
            so a code could no longer be entered alongside them. */}
        {appliedDiscount?.discountCode ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">
                {appliedDiscount.discountCode} applied
              </p>
              <p className="text-xs text-muted">
                You saved {formatMoney(appliedDiscount.discountAmount)}
              </p>
            </div>
            <button
              onClick={clearDiscount}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-500"
              aria-label="Remove discount code">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <Input
              name="discountCode"
              placeholder="Enter discount code"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyDiscount()}
              className="flex-1"
              error={discountError}
            />
            <Button
              variant="outline"
              onClick={applyDiscount}
              disabled={!discountInput.trim() || applying}>
              {applying ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
      </div>

      {walletCoins > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={toggleCoins}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
              coinsUsed > 0
                ? "border-amber-400/50 bg-amber-400/10 ring-2 ring-amber-400/20"
                : "border-line bg-surface hover:border-amber-400/40",
            )}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Coins className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {coinsUsed > 0
                  ? "Coins applied"
                  : `Use your ${walletCoins.toLocaleString("en-IN")} coins`}
              </p>
              <p className="text-xs text-muted">
                {coinsUsed > 0 && coinDiscount > 0
                  ? `Saving ${formatMoney(coinDiscount)} with coins`
                  : "Redeem coins for a discount on this booking"}
              </p>
            </div>
            <span
              className={cn(
                "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                coinsUsed > 0
                  ? "bg-amber-500 justify-end"
                  : "bg-line justify-start",
              )}>
              <span className="size-5 rounded-full bg-white shadow" />
            </span>
          </button>
        </div>
      )}

      {/* The order summary alongside is desktop-only, so without this the
          payment step showed no total at all on a phone. */}
      <div className="mt-4 rounded-2xl border border-line bg-surface-muted/50 p-4">
        <dl className="space-y-2 text-sm">
          {(!!appliedDiscount?.discountAmount || coinDiscount > 0 || tax.taxAmount > 0) && (
            <div className="flex items-center justify-between">
              <dt className="text-muted">Service total</dt>
              <dd className="text-ink">{formatMoney(subtotal)}</dd>
            </div>
          )}
          {!!appliedDiscount?.discountAmount && (
            <div className="flex items-center justify-between">
              <dt className="text-muted">
                Discount ({appliedDiscount.discountCode})
              </dt>
              <dd className="text-emerald-600">
                −{formatMoney(appliedDiscount.discountAmount)}
              </dd>
            </div>
          )}
          {coinDiscount > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted">
                Coins ({coinsUsed.toLocaleString("en-IN")})
              </dt>
              <dd className="text-emerald-600">−{formatMoney(coinDiscount)}</dd>
            </div>
          )}
          {tax.taxAmount > 0 && (
            <div className="flex items-center justify-between" data-testid="checkout-tax">
              <dt className="text-muted">
                {taxLabel} ({tax.taxRate}%)
              </dt>
              <dd className="text-ink">+{formatMoneyExact(tax.taxAmount)}</dd>
            </div>
          )}
          {tax.roundOff !== 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted">Round off</dt>
              <dd className="text-ink">{formatMoneyExact(tax.roundOff)}</dd>
            </div>
          )}
          <div
            className={cn(
              "flex items-center justify-between",
              (!!appliedDiscount?.discountAmount || coinDiscount > 0 || tax.taxAmount > 0) &&
                "border-t border-line pt-2.5",
            )}>
            <dt className="font-medium text-ink">Amount to pay</dt>
            <dd className="font-display text-lg font-semibold text-ink" data-testid="checkout-total-amount">
              {formatMoney(total)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {payOnline
            ? "Paid securely now — your cleaner collects nothing on the day."
            : "Payable in cash to your cleaner after the service is finished — nothing is charged now."}
        </p>
      </div>
      {draft.vehicleType && (
        <p className="mt-4 text-xs text-muted">
          Securing your slot for {categoryLabel(draft.vehicleType)} ·{" "}
          {draft.slot}
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Summary ---------------------------------- */

function OrderSummary({
  draft,
  total,
  tax,
  taxLabel,
  discount,
  step,
  address,
}: {
  draft: Draft;
  total: number;
  tax: TaxBreakdown;
  taxLabel: string;
  discount: PreviewAmountResponse | null;
  step: number;
  address?: string;
}) {
  const pkg = PACKAGES.find((p) => p.id === draft.packageId);
  const rows = [
    {
      label: "Vehicle",
      value:
        [draft.vehicleName, draft.vehiclePlate.trim(), draft.vehicleColor.trim()].filter(Boolean).join(" · ") ||
        "—",
    },
    { label: "Package", value: pkg?.name ?? "—" },
    {
      label: "When",
      value:
        draft.date && draft.slot
          ? `${new Date(draft.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${draft.slot}`
          : "—",
    },
    { label: "Address", value: address ?? "—" },
  ];

  return (
    <GlassCard className="hidden h-fit p-4 lg:block lg:sticky lg:top-24">
      <p className="font-display text-lg font-semibold text-ink">Summary</p>
      <p className="mt-1 text-xs text-muted">
        Step {step + 1} of {STEP_LABELS.length}
      </p>
      <dl className="mt-5 space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">{r.label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-ink">
              {r.value}
            </dd>
          </div>
        ))}
        {discount?.discountCode && discount.discountAmount > 0 && (
          <div className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">Discount ({discount.discountCode})</dt>
            <dd className="max-w-[60%] text-right font-medium text-emerald-600">
              −{formatMoney(discount.discountAmount)}
            </dd>
          </div>
        )}
        {discount && discount.coinDiscount > 0 && (
          <div className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">
              Coins ({discount.coinsRedeemed.toLocaleString("en-IN")})
            </dt>
            <dd className="max-w-[60%] text-right font-medium text-amber-600">
              −{formatMoney(discount.coinDiscount)}
            </dd>
          </div>
        )}
        {tax.taxAmount > 0 && (
          <div className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">
              {taxLabel} ({tax.taxRate}%)
            </dt>
            <dd className="max-w-[60%] text-right font-medium text-ink">+{formatMoneyExact(tax.taxAmount)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Total</span>
        <span className="font-display text-2xl font-semibold text-ink">
          {total ? formatMoney(total) : "—"}
        </span>
      </div>
    </GlassCard>
  );
}

/* --------------------------- Confirmation ------------------------------- */

function Confirmation({ booking }: { booking: Booking }) {
  const navigate = useNavigate();

  /**
   * Hand off to live tracking on its own.
   *
   * Dispatch starts the instant the booking is created, so the interesting
   * thing — cleaners being offered the job — is already happening while this
   * receipt is on screen. Three seconds is long enough to register that the
   * booking worked and short enough that the customer arrives at the search
   * while it is still searching. The button below does the same thing
   * immediately, so this is a convenience, not the only way through.
   */
  useEffect(() => {
    const timer = setTimeout(() => navigate(`/app/track/${booking.id}`), 3000);
    return () => clearTimeout(timer);
  }, [booking.id, navigate]);

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]">
        <CheckCircle2 className="size-10" />
      </motion.div>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Booking confirmed!
      </h1>
      <p className="mt-2 text-muted">
        We're finding you the nearest available cleaner — taking you to live
        tracking…
      </p>
      <p className="mt-1 text-xs text-muted">
        Booking ID <span className="font-medium text-ink">{booking.id}</span>
      </p>

      <GlassCard className="mt-5 p-4 text-left">
        <dl className="space-y-3 text-sm">
          <Row label="Vehicle" value={booking.vehicleName} />
          <Row label="Package" value={booking.packageName} />
          <Row
            label="When"
            value={`${new Date(booking.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${booking.slot}`}
          />
          <Row
            label="Address"
            value={`${booking.addressLabel} — ${booking.addressLine}`}
          />
          {!!booking.discountAmount && (
            <Row
              label={`Discount${booking.discountCode ? ` (${booking.discountCode})` : ""}`}
              value={`−${formatMoney(booking.discountAmount)}`}
            />
          )}
          {!!booking.coinDiscount && (
            <Row
              label={`Coins (${(booking.coinsRedeemed ?? 0).toLocaleString("en-IN")})`}
              value={`−${formatMoney(booking.coinDiscount)}`}
            />
          )}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-muted">Paid</span>
            <span className="font-display text-xl font-semibold text-ink">
              {formatMoney(bookingAmountDue(booking))}
            </span>
          </div>
        </dl>
      </GlassCard>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to={`/app/track/${booking.id}`}>
            <Radio className="size-4" /> Track my cleaner
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/bookings">View my bookings</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-ink">
        {value}
      </span>
    </div>
  );
}
