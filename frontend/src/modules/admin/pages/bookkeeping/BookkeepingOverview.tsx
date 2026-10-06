import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Landmark, Loader2, ReceiptText, Wallet } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatMoneyExact } from "@shared/lib/tax";
import { useBookkeepingConfig, useBookkeepingSummary } from "../../api/bookkeeping.api";
import { BookkeepingHeader } from "./BookkeepingTabs";

type Range = "month" | "30d" | "fy" | "custom";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(r: Range, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  if (r === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (r === "30d") return { from: iso(new Date(now.getTime() - 29 * 86_400_000)), to: iso(now) };
  if (r === "fy") {
    const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: `${start}-04-01`, to: iso(now) };
  }
  return custom;
}

/** Bookkeeping → Overview: what was billed, how the money splits, and GST owed. */
export function BookkeepingOverview() {
  const [range, setRange] = useState<Range>("month");
  const [custom, setCustom] = useState({ from: iso(new Date(Date.now() - 29 * 86_400_000)), to: iso(new Date()) });
  const { from, to } = rangeFor(range, custom);
  // Whole days: from 00:00 of the first to 23:59:59 of the last.
  // Interpreted in the admin's own timezone, then sent as exact instants.
  const { data, isLoading, isFetching } = useBookkeepingSummary(
    new Date(`${from}T00:00:00`).toISOString(),
    new Date(`${to}T23:59:59.999`).toISOString(),
  );
  const { data: config } = useBookkeepingConfig();

  const flow = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Gross service value", value: data.grossServiceValue, note: "Package prices before any discount" },
      { label: "Discount codes", value: -data.discounts },
      { label: "Coins redeemed", value: -data.coinDiscounts },
      { label: "Taxable value", value: data.taxableValue, strong: true, note: "Revenue — cleaner payouts come out of this" },
      ...(data.igst > 0 || data.cgst + data.sgst === 0
        ? []
        : [
            { label: "CGST", value: data.cgst },
            { label: "SGST", value: data.sgst },
          ]),
      ...(data.igst > 0 ? [{ label: "IGST", value: data.igst }] : []),
      { label: "Round off", value: data.roundOff },
      { label: "Charged after checkout", value: data.adjustments, note: "Reschedule subsidy reclaims and peak fees (no GST)" },
      { label: "Total billed to customers", value: data.totalBilled, strong: true },
    ].filter((r) => r.strong || r.value !== 0 || r.label === "Gross service value");
  }, [data]);

  return (
    <div className="space-y-8">
      <BookkeepingHeader
        title="Bookkeeping"
        subtitle="Billing, GST and where every rupee goes. Cancelled bookings are excluded; figures cover bookings placed in the selected period."
      />

      {config && !config.tax.enabled && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50/60 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            GST is currently <strong>off</strong> — checkout charges no tax.{" "}
            <Link to="/admin/bookkeeping/settings" className="font-semibold underline">
              Turn it on in GST &amp; business
            </Link>
            .
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {(
          [
            ["month", "This month"],
            ["30d", "Last 30 days"],
            ["fy", "This financial year"],
            ["custom", "Custom"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={cn(
              "cursor-pointer rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
              range === key ? "border-primary bg-primary/10 text-primary" : "border-line text-ink-soft hover:border-primary/40",
            )}>
            {label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              min={custom.from}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
            />
          </div>
        )}
        {isFetching && <Loader2 className="ml-2 size-4 animate-spin text-muted" />}
      </div>

      {isLoading || !data ? (
        <p className="flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" /> Loading figures…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={ReceiptText} label="Total billed" value={data.totalBilled} hint={`${data.bookings} bookings`} testId="stat-billed" />
            <Stat icon={Landmark} label="GST collected" value={data.taxCollected} hint="Owed to the government" testId="stat-gst" />
            <Stat icon={Wallet} label="Cleaner payouts" value={data.cleanerPayouts} hint="Completed jobs" />
            <Stat icon={Wallet} label="Platform net" value={data.platformNet} hint="Taxable value + fees − payouts" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
            <GlassCard data-testid="price-flow">
              <p className="font-display text-lg font-semibold text-ink">From service value to amount billed</p>
              <dl className="mt-4 space-y-1">
                {flow.map((r) => (
                  <div
                    key={r.label}
                    className={cn(
                      "flex items-baseline justify-between gap-4 rounded-xl px-3 py-2",
                      r.strong ? "bg-primary/5 font-semibold text-ink" : "text-ink-soft",
                    )}>
                    <dt>
                      {r.label}
                      {r.note && <span className="block text-xs font-normal text-muted">{r.note}</span>}
                    </dt>
                    <dd className={cn("tabular-nums", r.value < 0 && "text-emerald-600")}>{formatMoneyExact(r.value)}</dd>
                  </div>
                ))}
              </dl>
            </GlassCard>

            <div className="space-y-5">
              <GlassCard>
                <p className="font-display text-lg font-semibold text-ink">GST liability</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <Line label="CGST" value={data.cgst} />
                  <Line label="SGST" value={data.sgst} />
                  <Line label="IGST" value={data.igst} />
                  <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                    <dt>Total GST</dt>
                    <dd className="tabular-nums">{formatMoneyExact(data.taxCollected)}</dd>
                  </div>
                </dl>
              </GlassCard>
              <GlassCard>
                <p className="font-display text-lg font-semibold text-ink">Other</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <Line label="Refunds processed" value={data.refunds} />
                  <div className="flex justify-between text-ink-soft">
                    <dt>Cancelled bookings</dt>
                    <dd>{data.cancelledBookings}</dd>
                  </div>
                </dl>
                <Link
                  to="/admin/bookkeeping/invoices"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  View invoices <ArrowRight className="size-4" />
                </Link>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, testId }: { icon: typeof Wallet; label: string; value: number; hint: string; testId?: string }) {
  return (
    <GlassCard data-testid={testId}>
      <div className="flex items-center gap-2 text-sm text-muted">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-ink tabular-nums">{formatMoneyExact(value)}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </GlassCard>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoneyExact(value)}</dd>
    </div>
  );
}
