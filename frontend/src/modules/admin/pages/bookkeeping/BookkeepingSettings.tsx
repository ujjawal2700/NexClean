import { useEffect, useState } from "react";
import { Check, Loader2, Percent, Save } from "lucide-react";
import { ApiError } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { computeTax, formatMoneyExact } from "@shared/lib/tax";
import { useBookkeepingConfig, useUpdateBookkeepingConfig, type BookkeepingConfig } from "../../api/bookkeeping.api";
import { BookkeepingHeader } from "./BookkeepingTabs";

const GST_RATES = [0, 5, 12, 18, 28];

type Form = Pick<BookkeepingConfig, "tax" | "business" | "invoice">;

/** Bookkeeping → GST & business: tax rate, seller details and invoice numbering. */
export function BookkeepingSettings() {
  const { data } = useBookkeepingConfig();
  const update = useUpdateBookkeepingConfig();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm({ tax: { ...data.tax }, business: { ...data.business }, invoice: { ...data.invoice } });
  }, [data]);

  if (!form || !data) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading settings…
      </p>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify({ tax: data.tax, business: data.business, invoice: data.invoice });
  const set = <K extends keyof Form>(section: K, patch: Partial<Form[K]>) => {
    setSaved(false);
    setForm((f) => f && { ...f, [section]: { ...f[section], ...patch } });
  };
  const save = () => update.mutate(form, { onSuccess: () => setSaved(true) });

  const example = computeTax(1000, { ...form.tax, rate: Number(form.tax.rate) || 0 });
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const sampleNumber = `${form.invoice.prefix || "INV"}/${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}/${"1".padStart(form.invoice.numberPadding, "0")}`;

  return (
    <div className="space-y-8">
      <BookkeepingHeader
        title="GST & business"
        subtitle="The tax checkout adds on top of the price, and the seller details printed on every invoice."
        actions={
          <div className="flex items-center gap-2">
            {saved && !dirty && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <Check className="size-4" /> Saved
              </span>
            )}
            <Button onClick={save} disabled={!dirty || update.isPending} data-testid="save-bookkeeping">
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
            </Button>
          </div>
        }
      />

      {update.isError && (
        <p className="rounded-2xl border border-red-300/60 bg-red-50/40 px-4 py-3 text-sm text-red-600">
          {update.error instanceof ApiError ? update.error.message : "Couldn't save the settings."}
        </p>
      )}

      <GlassCard className="space-y-5" data-testid="gst-settings">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Percent className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">GST at checkout</p>
              <p className="text-sm text-muted">
                Prices exclude GST. When on, it's added on top of the price after discounts, shown at checkout and charged.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <span className="text-sm font-medium text-ink">{form.tax.enabled ? "On" : "Off"}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Apply GST at checkout"
              checked={form.tax.enabled}
              onChange={(e) => set("tax", { enabled: e.target.checked })}
              className="peer sr-only"
            />
            <span className="relative h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className={cn("grid gap-5 lg:grid-cols-2", !form.tax.enabled && "opacity-60")}>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">GST rate</p>
              <div className="flex flex-wrap gap-2">
                {GST_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set("tax", { rate: r })}
                    className={cn(
                      "cursor-pointer rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
                      Number(form.tax.rate) === r ? "border-primary bg-primary/10 text-primary" : "border-line text-ink-soft hover:border-primary/40",
                    )}>
                    {r}%
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  max={28}
                  step={0.5}
                  aria-label="Custom GST rate"
                  value={form.tax.rate}
                  onChange={(e) => set("tax", { rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="h-10 w-24 rounded-pill border border-line bg-surface px-3 text-sm text-ink"
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Supply type</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["intra", "Within my state", "Split as CGST + SGST"],
                    ["inter", "Other state", "Charged as IGST"],
                  ] as const
                ).map(([v, title, hint]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("tax", { supplyType: v })}
                    className={cn(
                      "cursor-pointer rounded-2xl border px-4 py-2.5 text-left transition-colors",
                      form.tax.supplyType === v ? "border-primary bg-primary/10" : "border-line hover:border-primary/40",
                    )}>
                    <span className="block text-sm font-medium text-ink">{title}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="taxLabel" label="Tax label" value={form.tax.label} onChange={(e) => set("tax", { label: e.target.value })} />
              <Input name="sacCode" label="SAC code" value={form.tax.sacCode} onChange={(e) => set("tax", { sacCode: e.target.value })} />
            </div>
          </div>

          <div className="h-fit rounded-2xl border border-line bg-surface-muted/50 p-4" data-testid="gst-example">
            <p className="text-sm font-medium text-ink">Example: a ₹1,000 booking</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <ExRow label="Price (after discounts)" value={1000} />
              {example.cgstAmount > 0 && <ExRow label={`CGST @ ${form.tax.rate / 2}%`} value={example.cgstAmount} />}
              {example.sgstAmount > 0 && <ExRow label={`SGST @ ${form.tax.rate / 2}%`} value={example.sgstAmount} />}
              {example.igstAmount > 0 && <ExRow label={`IGST @ ${form.tax.rate}%`} value={example.igstAmount} />}
              {example.roundOff !== 0 && <ExRow label="Round off" value={example.roundOff} />}
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                <dt>Customer pays</dt>
                <dd className="tabular-nums">{formatMoneyExact(example.payableAmount)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Cleaner payouts stay a share of the price before GST. Bookings already made keep the tax they were charged.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Business details</p>
          <p className="text-sm text-muted">Printed as the seller on invoices issued from now on (existing invoices keep theirs).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="legalName" label="Legal name" value={form.business.legalName} onChange={(e) => set("business", { legalName: e.target.value })} />
          <Input name="tradeName" label="Trade name" value={form.business.tradeName} onChange={(e) => set("business", { tradeName: e.target.value })} />
          <Input
            name="gstin"
            label="GSTIN"
            placeholder="22AAAAA0000A1Z5"
            value={form.business.gstin}
            onChange={(e) => set("business", { gstin: e.target.value.toUpperCase() })}
          />
          <Input name="pan" label="PAN" placeholder="AAAAA0000A" value={form.business.pan} onChange={(e) => set("business", { pan: e.target.value.toUpperCase() })} />
          <div className="sm:col-span-2">
            <Input name="addressLine" label="Address" value={form.business.addressLine} onChange={(e) => set("business", { addressLine: e.target.value })} />
          </div>
          <Input name="city" label="City" value={form.business.city} onChange={(e) => set("business", { city: e.target.value })} />
          <Input name="state" label="State" value={form.business.state} onChange={(e) => set("business", { state: e.target.value })} />
          <Input name="stateCode" label="State code" placeholder="23" value={form.business.stateCode} onChange={(e) => set("business", { stateCode: e.target.value })} />
          <Input name="pincode" label="Pincode" value={form.business.pincode} onChange={(e) => set("business", { pincode: e.target.value })} />
          <Input name="bizEmail" label="Email" value={form.business.email} onChange={(e) => set("business", { email: e.target.value })} />
          <Input name="bizPhone" label="Phone" value={form.business.phone} onChange={(e) => set("business", { phone: e.target.value })} />
          <Input name="website" label="Website" value={form.business.website} onChange={(e) => set("business", { website: e.target.value })} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Invoice numbering</p>
          <p className="text-sm text-muted">Numbers run in sequence and restart each financial year (April–March).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="prefix" label="Prefix" value={form.invoice.prefix} onChange={(e) => set("invoice", { prefix: e.target.value.toUpperCase() })} />
          <Input
            name="numberPadding"
            label="Digits"
            type="number"
            min={3}
            max={8}
            value={form.invoice.numberPadding}
            onChange={(e) => set("invoice", { numberPadding: Math.min(8, Math.max(3, Number(e.target.value) || 5)) })}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Looks like</p>
            <p className="flex h-12 items-center rounded-2xl border border-dashed border-line px-4 font-mono text-sm text-ink" data-testid="number-preview">
              {sampleNumber}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function ExRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoneyExact(value)}</dd>
    </div>
  );
}
