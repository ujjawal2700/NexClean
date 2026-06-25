import { useMemo, useState } from "react";
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
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { BrandModelSelect } from "../../components/BrandModelSelect";
import { ApiError } from "@shared/lib/api";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import { useMe } from "../../api/queries";
import { useCreateOrder, useVerifyPayment, usePreviewDiscount } from "../../api/mutations";
import type { PreviewAmountResponse } from "../../api/mutations";
import {
  PACKAGES,
  VEHICLE_TYPES,
  VEHICLE_LABEL,
  TIME_SLOTS,
  upcomingDates,
  priceFor,
} from "../../data/catalog";
import type { CarType, Booking, Vehicle, Address } from "../../types";
import { formatMoney } from "@shared/lib/format";
import { Stepper, STEP_LABELS } from "./Stepper";

type Draft = {
  vehicleType: CarType | null;
  vehicleName: string;
  packageId: string | null;
  date: string | null;
  slot: string | null;
  addressId: string | null;
};

const EMPTY: Draft = {
  vehicleType: null,
  vehicleName: "",
  packageId: null,
  date: null,
  slot: null,
  addressId: null,
};

export function BookingFlow() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const vehicles = me?.vehicles ?? [];
  const addresses = me?.addresses ?? [];
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();
  const previewDiscount = usePreviewDiscount();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [payError, setPayError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<PreviewAmountResponse | null>(null);
  const [discountError, setDiscountError] = useState("");

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const pkg = useMemo(() => PACKAGES.find((p) => p.id === draft.packageId) ?? null, [draft.packageId]);
  const total = draft.vehicleType && pkg ? priceFor(draft.vehicleType, pkg) : 0;
  const payable = appliedDiscount ? appliedDiscount.price : total;
  const address = addresses.find((a) => a.id === draft.addressId) ?? null;

  const applyDiscount = async () => {
    if (!draft.vehicleType || !pkg || !discountInput.trim()) return;
    setDiscountError("");
    try {
      const result = await previewDiscount.mutateAsync({
        vehicleType: draft.vehicleType,
        packageId: pkg.id,
        discountCode: discountInput.trim(),
      });
      setAppliedDiscount(result);
    } catch (e) {
      setAppliedDiscount(null);
      setDiscountError(e instanceof ApiError ? e.message : "Invalid discount code");
    }
  };

  const clearDiscount = () => {
    setDiscountInput("");
    setAppliedDiscount(null);
    setDiscountError("");
  };

  const canContinue = [
    !!draft.vehicleType,
    !!draft.packageId,
    !!draft.date && !!draft.slot,
    !!draft.addressId,
    true,
  ][step];

  const pay = async () => {
    if (!draft.vehicleType || !pkg || !draft.date || !draft.slot || !address) return;
    setPayError("");
    setProcessing(true);

    const bookingInput = {
      vehicleType: draft.vehicleType,
      vehicleName: draft.vehicleName || VEHICLE_LABEL[draft.vehicleType],
      packageId: pkg.id,
      date: draft.date,
      slot: draft.slot,
      addressLabel: address.label,
      addressLine: address.line,
      discountCode: appliedDiscount ? discountInput.trim() : undefined,
    };

    try {
      const order = await createOrder.mutateAsync(bookingInput);

      // Mock mode (no Razorpay keys): confirm + book without the checkout modal.
      if (order.mock) {
        const booking = await verifyPayment.mutateAsync({ booking: bookingInput });
        setConfirmed(booking);
        setProcessing(false);
        return;
      }

      // Live mode: open Razorpay Checkout, then verify the signature server-side.
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
            const booking = await verifyPayment.mutateAsync({ booking: bookingInput, ...r });
            setConfirmed(booking);
          } catch (e) {
            setPayError(e instanceof ApiError ? e.message : "Payment verification failed");
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
      });
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Payment failed. Please try again.");
      setProcessing(false);
    }
  };

  if (confirmed) return <Confirmation booking={confirmed} />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app")}>
          <ArrowLeft className="size-4" /> Cancel
        </Button>
        <h1 className="font-display text-2xl font-semibold text-ink">Book a cleaning</h1>
      </div>

      <Stepper current={step} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* step body */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && <VehicleStep draft={draft} set={set} vehicles={vehicles} />}
              {step === 1 && <PackageStep draft={draft} set={set} />}
              {step === 2 && <ScheduleStep draft={draft} set={set} />}
              {step === 3 && <AddressStep draft={draft} set={set} addresses={addresses} />}
              {step === 4 && (
                <PaymentSummary
                  draft={draft}
                  total={payable}
                  discountInput={discountInput}
                  setDiscountInput={setDiscountInput}
                  appliedDiscount={appliedDiscount}
                  discountError={discountError}
                  applyDiscount={applyDiscount}
                  clearDiscount={clearDiscount}
                  applying={previewDiscount.isPending}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* nav */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={pay} disabled={processing} className="min-w-44">
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
          {payError && <p className="mt-3 text-right text-sm text-red-500">{payError}</p>}
        </div>

        {/* live summary */}
        <OrderSummary
          draft={draft}
          total={total}
          discount={appliedDiscount}
          step={step}
          address={address?.label}
        />
      </div>
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
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  vehicles: Vehicle[];
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  const usingSavedVehicle = vehicles.some((v) => v.name === draft.vehicleName && v.type === draft.vehicleType);
  const showPicker = !!draft.vehicleType && !usingSavedVehicle;

  const pickType = (t: CarType) => {
    setBrand("");
    setModel("");
    set({ vehicleType: t, vehicleName: `My ${VEHICLE_LABEL[t]}` });
  };

  const onBrandChange = (b: string) => {
    setBrand(b);
    setModel("");
  };

  const onModelChange = (m: string) => {
    setModel(m);
    if (brand && m) set({ vehicleName: `${brand} ${m}` });
  };

  return (
    <div>
      <StepHeading title="Which vehicle?" subtitle="Choose from your garage or pick a type." />

      {vehicles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => {
            const selected = draft.vehicleName === v.name && draft.vehicleType === v.type;
            return (
              <button
                key={v.id}
                onClick={() => set({ vehicleType: v.type, vehicleName: v.name })}
                className={cn(
                  "flex items-center gap-3 rounded-card border p-4 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-line bg-surface hover:border-primary/40",
                )}
              >
                <div className="w-20 shrink-0">
                  <CarSilhouette type={v.type} uid={`pick-${v.id}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{v.name}</p>
                  <p className="text-sm text-muted">{VEHICLE_LABEL[v.type]}</p>
                </div>
                {selected && <Check className="ml-auto size-5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-3 mt-6 text-sm font-medium text-muted">Or pick a vehicle type</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {VEHICLE_TYPES.map((t) => {
          const selected = draft.vehicleType === t && !usingSavedVehicle;
          return (
            <button
              key={t}
              onClick={() => pickType(t)}
              className={cn(
                "rounded-2xl border p-3 transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-line bg-surface hover:border-primary/40",
              )}
            >
              <CarSilhouette type={t} uid={`type-${t}`} />
              <p className="mt-1 text-center text-xs font-medium text-ink">{VEHICLE_LABEL[t]}</p>
            </button>
          );
        })}
      </div>

      {showPicker && draft.vehicleType && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2">
          <BrandModelSelect type={draft.vehicleType} brand={brand} model={model} onBrandChange={onBrandChange} onModelChange={onModelChange} />
        </div>
      )}
    </div>
  );
}

function PackageStep({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div>
      <StepHeading title="Choose a package" subtitle="Pricing shown for your selected vehicle." />
      <div className="space-y-3">
        {PACKAGES.map((p) => {
          const selected = draft.packageId === p.id;
          const price = draft.vehicleType ? priceFor(draft.vehicleType, p) : null;
          return (
            <button
              key={p.id}
              onClick={() => set({ packageId: p.id })}
              className={cn(
                "flex w-full items-start gap-4 rounded-card border p-5 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-line bg-surface hover:border-primary/40",
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg font-semibold text-ink">{p.name}</p>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3.5" /> {p.durationLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{p.tagline}</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <Check className="size-3 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                {price !== null && (
                  <p className="font-display text-xl font-semibold text-ink">{formatMoney(price)}</p>
                )}
                <span
                  className={cn(
                    "mt-2 inline-grid size-6 place-items-center rounded-full",
                    selected ? "bg-primary text-white" : "border border-line",
                  )}
                >
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

function ScheduleStep({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const dates = upcomingDates(7);
  return (
    <div>
      <StepHeading title="Pick a date & time" subtitle="When should the specialist arrive?" />
      <div className="flex gap-2.5 overflow-x-auto pb-2">
        {dates.map((d) => {
          const iso = d.toISOString();
          const selected = draft.date && new Date(draft.date).toDateString() === d.toDateString();
          return (
            <button
              key={iso}
              onClick={() => set({ date: iso })}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-line bg-surface hover:border-primary/40",
              )}
            >
              <span className="text-xs text-muted">
                {d.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
              <span className="font-display text-lg font-semibold text-ink">{d.getDate()}</span>
              <span className="text-xs text-muted">
                {d.toLocaleDateString("en-IN", { month: "short" })}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 mt-6 text-sm font-medium text-muted">Time slot</p>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {TIME_SLOTS.map((slot) => {
          const selected = draft.slot === slot;
          return (
            <button
              key={slot}
              onClick={() => set({ slot })}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-medium transition-all",
                selected
                  ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                  : "border-line bg-surface text-ink-soft hover:border-primary/40",
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
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
  return (
    <div>
      <StepHeading title="Where should we come?" subtitle="Select a saved address." />
      <div className="space-y-3">
        {addresses.map((a) => {
          const selected = draft.addressId === a.id;
          return (
            <button
              key={a.id}
              onClick={() => set({ addressId: a.id })}
              className={cn(
                "flex w-full items-center gap-4 rounded-card border p-4 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-line bg-surface hover:border-primary/40",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-ink">{a.label}</p>
                <p className="truncate text-sm text-muted">{a.line}</p>
              </div>
              {selected && <Check className="ml-auto size-5 text-primary" />}
            </button>
          );
        })}
      </div>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/app/profile">
          <Plus className="size-4" /> Add a new address
        </Link>
      </Button>
    </div>
  );
}

function PaymentSummary({
  draft,
  total,
  discountInput,
  setDiscountInput,
  appliedDiscount,
  discountError,
  applyDiscount,
  clearDiscount,
  applying,
}: {
  draft: Draft;
  total: number;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  appliedDiscount: PreviewAmountResponse | null;
  discountError: string;
  applyDiscount: () => void;
  clearDiscount: () => void;
  applying: boolean;
}) {
  const [method, setMethod] = useState("upi");
  const methods = [
    { id: "upi", label: "UPI" },
    { id: "card", label: "Card" },
    { id: "wallet", label: "Wallet" },
    { id: "cod", label: "Pay after service" },
  ];
  return (
    <div>
      <StepHeading title="Payment" subtitle="Choose how you'd like to pay." />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={cn(
              "rounded-xl border py-3 text-sm font-medium transition-all",
              method === m.id
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                : "border-line bg-surface text-ink-soft hover:border-primary/40",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
          <Tag className="size-4 text-muted" /> Have a discount code?
        </p>
        {appliedDiscount ? (
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
              aria-label="Remove discount code"
            >
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
              disabled={!discountInput.trim() || applying}
            >
              {applying ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface-muted/50 p-4 text-sm text-muted">
        Secured by <span className="font-medium text-ink">Razorpay</span>. {formatMoney(total)} will
        be collected on confirmation. Without test keys configured, payment is simulated and the
        booking is still created.
      </div>
      {draft.vehicleType && (
        <p className="mt-4 text-xs text-muted">
          Securing your slot for {VEHICLE_LABEL[draft.vehicleType]} · {draft.slot}
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Summary ---------------------------------- */

function OrderSummary({
  draft,
  total,
  discount,
  step,
  address,
}: {
  draft: Draft;
  total: number;
  discount: PreviewAmountResponse | null;
  step: number;
  address?: string;
}) {
  const pkg = PACKAGES.find((p) => p.id === draft.packageId);
  const rows = [
    { label: "Vehicle", value: draft.vehicleName || "—" },
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
    <GlassCard className="h-fit lg:sticky lg:top-24">
      <p className="font-display text-lg font-semibold text-ink">Summary</p>
      <p className="mt-1 text-xs text-muted">Step {step + 1} of {STEP_LABELS.length}</p>
      <dl className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">{r.label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-ink">{r.value}</dd>
          </div>
        ))}
        {discount && (
          <div className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted">Discount ({discount.discountCode})</dt>
            <dd className="max-w-[60%] text-right font-medium text-emerald-600">
              −{formatMoney(discount.discountAmount)}
            </dd>
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
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]"
      >
        <CheckCircle2 className="size-10" />
      </motion.div>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Booking confirmed!</h1>
      <p className="mt-2 text-muted">
        Your specialist is booked. Booking ID <span className="font-medium text-ink">{booking.id}</span>.
      </p>

      <GlassCard className="mt-8 text-left">
        <dl className="space-y-3 text-sm">
          <Row label="Vehicle" value={booking.vehicleName} />
          <Row label="Package" value={booking.packageName} />
          <Row
            label="When"
            value={`${new Date(booking.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${booking.slot}`}
          />
          <Row label="Address" value={`${booking.addressLabel} — ${booking.addressLine}`} />
          {!!booking.discountAmount && (
            <Row
              label={`Discount${booking.discountCode ? ` (${booking.discountCode})` : ""}`}
              value={`−${formatMoney(booking.discountAmount)}`}
            />
          )}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-muted">Paid</span>
            <span className="font-display text-xl font-semibold text-ink">
              {formatMoney(booking.price)}
            </span>
          </div>
        </dl>
      </GlassCard>

      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/app">Back to dashboard</Link>
        </Button>
        <Button asChild>
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
      <span className="max-w-[60%] text-right font-medium text-ink">{value}</span>
    </div>
  );
}
