import { useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, RotateCcw, Save } from "lucide-react";
import { ApiError } from "@shared/lib/api";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { InvoiceDocument } from "@shared/components/InvoiceDocument";
import { downloadInvoicePdf } from "@shared/lib/invoicePdf";
import { computeTax } from "@shared/lib/tax";
import type { Invoice, InvoiceTemplate } from "@shared/lib/invoice";
import {
  useBookkeepingConfig,
  useResetInvoiceTemplate,
  useUpdateBookkeepingConfig,
  type BookkeepingConfig,
} from "../../api/bookkeeping.api";
import { BookkeepingHeader } from "./BookkeepingTabs";

const TOGGLES: { key: keyof InvoiceTemplate; label: string }[] = [
  { key: "showLogo", label: "Logo" },
  { key: "showVehicleDetails", label: "Vehicle & number plate" },
  { key: "showServiceAddress", label: "Service address" },
  { key: "showCleaner", label: "Specialist's name" },
  { key: "showTaxBreakup", label: "CGST / SGST / IGST split" },
  { key: "showAmountInWords", label: "Amount in words" },
  { key: "showPaymentInfo", label: "Payment details" },
  { key: "showSignature", label: "Signature block" },
];

const LABELS: { key: keyof InvoiceTemplate["labels"]; label: string }[] = [
  { key: "billTo", label: "Bill-to heading" },
  { key: "serviceDetails", label: "Service heading" },
  { key: "description", label: "Description column" },
  { key: "amount", label: "Amount column" },
  { key: "subtotal", label: "Subtotal" },
  { key: "taxable", label: "Taxable value" },
  { key: "total", label: "Total" },
];

/** A realistic invoice to preview the template on, using the real business details and tax settings. */
function sampleInvoice(config: BookkeepingConfig): Invoice {
  const tax = computeTax(1080, { enabled: true, rate: config.tax.rate || 18, label: config.tax.label, supplyType: config.tax.supplyType });
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    id: "sample",
    booking: "sample",
    invoiceNumber: `${config.invoice.prefix}/${fy}-${String((fy + 1) % 100).padStart(2, "0")}/${"42".padStart(config.invoice.numberPadding, "0")}`,
    financialYear: "",
    issuedAt: now.toISOString(),
    status: "paid",
    billTo: { name: "Priya Sharma", phone: "+91 98765 43210", email: "priya@example.com", address: "B-402, Green Valley Society, Indore", gstin: "" },
    seller: config.business,
    service: {
      packageName: "Premium Detail",
      vehicleName: "Hyundai Creta",
      vehicleType: "suv",
      vehiclePlate: "MP 09 AB 1234",
      date: now.toISOString(),
      slot: "11:00 AM",
      address: "Home — B-402, Green Valley Society, Indore",
      cleanerName: "Rohit Kumar",
      isSubscriptionWash: false,
    },
    lines: [
      { description: "Premium Detail — Hyundai Creta", sac: config.tax.sacCode, quantity: 1, amount: 1200, kind: "service" },
      { description: "Discount (WELCOME10)", sac: "", quantity: 1, amount: -120, kind: "discount" },
    ],
    subtotal: 1200,
    discountTotal: 120,
    taxableAmount: tax.taxableAmount,
    taxLabel: config.tax.label,
    taxRate: tax.taxRate,
    supplyType: config.tax.supplyType,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    igstAmount: tax.igstAmount,
    taxAmount: tax.taxAmount,
    adjustmentTotal: 0,
    roundOff: tax.roundOff,
    total: tax.payableAmount,
    amountPaid: tax.payableAmount,
    paymentMethod: "Online",
    notes: "",
    revision: 0,
    editedAt: null,
    editedBy: "",
  };
}

/** Bookkeeping → Invoice template: every part of the invoice layout, with a live preview. */
export function InvoiceTemplateEditor() {
  const { data } = useBookkeepingConfig();
  const update = useUpdateBookkeepingConfig();
  const reset = useResetInvoiceTemplate();
  const [t, setT] = useState<InvoiceTemplate | null>(null);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (data) setT(structuredClone(data.template));
  }, [data]);

  const sample = useMemo(() => (data ? sampleInvoice(data) : null), [data]);

  if (!t || !data || !sample) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading template…
      </p>
    );
  }

  const dirty = JSON.stringify(t) !== JSON.stringify(data.template);
  const patch = (p: Partial<InvoiceTemplate>) => {
    setSaved(false);
    setT((cur) => cur && { ...cur, ...p });
  };
  const patchLabel = (k: keyof InvoiceTemplate["labels"], v: string) => {
    setSaved(false);
    setT((cur) => cur && { ...cur, labels: { ...cur.labels, [k]: v } });
  };

  return (
    <div className="space-y-8">
      <BookkeepingHeader
        title="Invoice template"
        subtitle="Change the title, colours, what's shown, every heading and the footer text. The preview updates as you type; saving applies it to every invoice, old and new."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {saved && !dirty && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <Check className="size-4" /> Saved
              </span>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Reset the invoice template to the default design?")) reset.mutate(undefined, { onSuccess: () => setSaved(true) });
              }}
              disabled={reset.isPending}>
              <RotateCcw className="size-4" /> Reset to default
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadInvoicePdf(sample, t);
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Sample PDF
            </Button>
            <Button onClick={() => update.mutate({ template: t }, { onSuccess: () => setSaved(true) })} disabled={!dirty || update.isPending} data-testid="save-template">
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save template
            </Button>
          </div>
        }
      />

      {(update.isError || reset.isError) && (
        <p className="rounded-2xl border border-red-300/60 bg-red-50/40 px-4 py-3 text-sm text-red-600">
          {update.error instanceof ApiError ? update.error.message : "Couldn't save the template."}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <GlassCard className="space-y-3">
            <p className="font-display font-semibold text-ink">Heading &amp; colour</p>
            <Input name="title" label="Document title" value={t.title} onChange={(e) => patch({ title: e.target.value })} />
            <div>
              <label htmlFor="accent" className="mb-1.5 block text-sm font-medium text-ink">
                Accent colour
              </label>
              <div className="flex items-center gap-3">
                <input id="accent" type="color" value={t.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-surface p-1" />
                <span className="font-mono text-sm text-ink-soft">{t.accentColor}</span>
              </div>
            </div>
            <TextArea id="headerNote" label="Note under the header" value={t.headerNote} onChange={(v) => patch({ headerNote: v })} rows={2} />
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="font-display font-semibold text-ink">Show on the invoice</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {TOGGLES.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={!!t[key]}
                    onChange={(e) => patch({ [key]: e.target.checked } as Partial<InvoiceTemplate>)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="font-display font-semibold text-ink">Headings &amp; labels</p>
            {LABELS.map(({ key, label }) => (
              <Input key={key} name={`label-${key}`} label={label} value={t.labels[key]} onChange={(e) => patchLabel(key, e.target.value)} />
            ))}
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="font-display font-semibold text-ink">Footer</p>
            <TextArea id="terms" label="Terms & conditions" value={t.terms} onChange={(v) => patch({ terms: v })} rows={4} />
            <TextArea id="footerNote" label="Closing note" value={t.footerNote} onChange={(v) => patch({ footerNote: v })} rows={2} />
            <Input name="signatoryLabel" label="Signature caption" value={t.signatoryLabel} onChange={(e) => patch({ signatoryLabel: e.target.value })} />
          </GlassCard>
        </div>

        <div className="space-y-2 xl:sticky xl:top-6 xl:self-start">
          <p className="text-sm font-medium text-muted">Live preview (sample booking)</p>
          <div className="overflow-x-auto" data-testid="template-preview">
            <div className="min-w-[680px]">
              <InvoiceDocument invoice={sample} template={t} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextArea({ id, label, value, onChange, rows }: { id: string; label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-primary/50"
      />
    </div>
  );
}
