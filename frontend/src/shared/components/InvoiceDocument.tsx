import { amountInWords, formatMoneyExact } from "@shared/lib/tax";
import { INVOICE_STATUS_LABEL, sellerAddress, type Invoice, type InvoiceTemplate } from "@shared/lib/invoice";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * The invoice as a printable "sheet of paper", laid out by the admin's
 * template. Always rendered on white (it's a document, not app chrome), and
 * mirrored line-for-line by renderInvoicePdf so the download matches what's
 * on screen.
 */
export function InvoiceDocument({ invoice: inv, template: t }: { invoice: Invoice; template: InvoiceTemplate }) {
  const accent = t.accentColor || "#0f766e";
  const s = inv.seller ?? {};
  const taxable = inv.lines.filter((l) => l.kind !== "adjustment");
  const adjustments = inv.lines.filter((l) => l.kind === "adjustment");
  const intra = inv.supplyType !== "inter";

  return (
    <article
      className="relative mx-auto w-full max-w-[820px] overflow-hidden rounded-2xl bg-white text-[13px] leading-relaxed text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_28px_rgba(0,0,0,0.06)] ring-1 ring-slate-200"
      data-testid="invoice-document">
      <div className="h-2" style={{ backgroundColor: accent }} />
      {inv.status === "cancelled" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center text-[88px] font-black uppercase tracking-widest text-red-500/10 [transform:rotate(-24deg)]">
          Cancelled
        </div>
      )}

      <div className="space-y-6 p-6 sm:p-10">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            {t.showLogo && <img src="/logo.png" alt="" className="size-12 rounded-xl object-contain" />}
            <div>
              <p className="text-lg font-bold text-slate-900">{s.tradeName || s.legalName || "NexClean"}</p>
              {s.legalName && s.legalName !== s.tradeName && <p className="text-xs text-slate-500">{s.legalName}</p>}
              {sellerAddress(s) && <p className="mt-1 max-w-xs text-xs text-slate-500">{sellerAddress(s)}</p>}
              <p className="mt-1 text-xs text-slate-500">
                {[s.phone, s.email, s.website].filter(Boolean).join(" · ")}
              </p>
              {s.gstin && (
                <p className="mt-1 text-xs font-medium text-slate-700">
                  GSTIN {s.gstin}
                  {s.stateCode && ` · State code ${s.stateCode}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold uppercase tracking-wide" style={{ color: accent }}>
              {t.title}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900" data-testid="invoice-number">
              {inv.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500">Issued {fmtDate(inv.issuedAt)}</p>
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: inv.status === "paid" ? "#dcfce7" : inv.status === "cancelled" ? "#fee2e2" : "#fef3c7",
                color: inv.status === "paid" ? "#166534" : inv.status === "cancelled" ? "#991b1b" : "#92400e",
              }}
              data-testid="invoice-status">
              {INVOICE_STATUS_LABEL[inv.status]}
            </span>
          </div>
        </header>

        {t.headerNote && <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">{t.headerNote}</p>}

        {/* Parties */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {t.labels.billTo}
            </p>
            <p className="mt-1 font-semibold text-slate-900">{inv.billTo.name || "Customer"}</p>
            {inv.billTo.address && <p className="text-xs text-slate-600">{inv.billTo.address}</p>}
            <p className="text-xs text-slate-600">{[inv.billTo.phone, inv.billTo.email].filter(Boolean).join(" · ")}</p>
            {inv.billTo.gstin && <p className="mt-1 text-xs font-medium text-slate-700">GSTIN {inv.billTo.gstin}</p>}
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {t.labels.serviceDetails}
            </p>
            <p className="mt-1 font-semibold text-slate-900">{inv.service.packageName}</p>
            <p className="text-xs text-slate-600">
              {fmtDate(inv.service.date)} · {inv.service.slot}
            </p>
            {t.showVehicleDetails && (
              <p className="text-xs text-slate-600">
                {inv.service.vehicleName}
                {inv.service.vehiclePlate && ` · ${inv.service.vehiclePlate}`}
              </p>
            )}
            {t.showServiceAddress && inv.service.address && <p className="text-xs text-slate-600">{inv.service.address}</p>}
            {t.showCleaner && inv.service.cleanerName && (
              <p className="text-xs text-slate-600">Specialist: {inv.service.cleanerName}</p>
            )}
          </div>
        </section>

        {/* Lines */}
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-white" style={{ backgroundColor: accent }}>
              <th className="rounded-l-lg px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">{t.labels.description}</th>
              <th className="px-3 py-2 font-semibold">SAC</th>
              <th className="rounded-r-lg px-3 py-2 text-right font-semibold">{t.labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {taxable.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2.5">{l.description}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{l.sac || "—"}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${l.amount < 0 ? "text-emerald-700" : ""}`}>
                  {formatMoneyExact(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <section className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3 text-xs text-slate-600 sm:max-w-[48%]">
            {t.showAmountInWords && (
              <p>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount in words</span>
                <span className="font-medium text-slate-800">{amountInWords(inv.total)}</span>
              </p>
            )}
            {t.showPaymentInfo && (
              <p>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payment</span>
                {inv.status === "cancelled"
                  ? "Booking cancelled"
                  : inv.paymentMethod
                    ? `${inv.paymentMethod} · ${formatMoneyExact(inv.amountPaid)} received`
                    : "Payable to the specialist on completion"}
              </p>
            )}
            {inv.notes && (
              <p>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</span>
                <span className="whitespace-pre-line">{inv.notes}</span>
              </p>
            )}
          </div>

          <dl className="w-full space-y-1.5 sm:w-72" data-testid="invoice-totals">
            <Row label={t.labels.subtotal} value={inv.subtotal} />
            {inv.discountTotal > 0 && <Row label="Discounts" value={-inv.discountTotal} />}
            <Row label={t.labels.taxable} value={inv.taxableAmount} strong />
            {t.showTaxBreakup && inv.taxAmount > 0 ? (
              intra ? (
                <>
                  <Row label={`CGST @ ${inv.taxRate / 2}%`} value={inv.cgstAmount} />
                  <Row label={`SGST @ ${inv.taxRate / 2}%`} value={inv.sgstAmount} />
                </>
              ) : (
                <Row label={`IGST @ ${inv.taxRate}%`} value={inv.igstAmount} />
              )
            ) : (
              <Row label={inv.taxRate > 0 ? `${inv.taxLabel} @ ${inv.taxRate}%` : inv.taxLabel} value={inv.taxAmount} />
            )}
            {inv.roundOff !== 0 && <Row label="Round off" value={inv.roundOff} />}
            {adjustments.map((l, i) => (
              <Row key={`adj-${i}`} label={l.description} value={l.amount} />
            ))}
            <div
              className="mt-2 flex items-baseline justify-between rounded-xl px-3 py-2.5 text-white"
              style={{ backgroundColor: accent }}>
              <dt className="text-sm font-semibold">{t.labels.total}</dt>
              <dd className="text-lg font-bold tabular-nums" data-testid="invoice-total">
                {formatMoneyExact(inv.total)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-6 border-t border-slate-200 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 text-xs text-slate-500 sm:max-w-[60%]">
            {t.terms && <p className="whitespace-pre-line">{t.terms}</p>}
            {t.footerNote && <p className="font-medium text-slate-700">{t.footerNote}</p>}
          </div>
          {t.showSignature && (
            <div className="text-center text-xs text-slate-600">
              <p className="font-semibold text-slate-800">For {s.legalName || s.tradeName || "NexClean"}</p>
              <div className="mx-auto mt-8 w-40 border-t border-slate-300" />
              <p className="mt-1">{t.signatoryLabel}</p>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 px-3 ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoneyExact(value)}</dd>
    </div>
  );
}
