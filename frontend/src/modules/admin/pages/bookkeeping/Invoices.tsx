import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoneyExact } from "@shared/lib/tax";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@shared/lib/invoice";
import { useInvoices } from "../../api/bookkeeping.api";
import { BookkeepingHeader } from "./BookkeepingTabs";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  issued: "bg-amber-500/15 text-amber-700",
  paid: "bg-emerald-500/10 text-emerald-700",
  cancelled: "bg-red-500/10 text-red-600",
};

/** Bookkeeping → Invoices: every booking's invoice, searchable and paged. */
export function Invoices() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching } = useInvoices({ page, status, search });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-8">
      <BookkeepingHeader
        title="Invoices"
        subtitle="One tax invoice per booking, numbered per financial year. Open one to view, edit the billing details or download it."
      />

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4">
            <Search className="size-4 text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search invoice number, customer, phone or package"
              aria-label="Search invoices"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
            />
          </label>
          <div className="flex gap-1 rounded-pill border border-line bg-surface/70 p-1">
            {(["all", "issued", "paid", "cancelled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={cn(
                  "cursor-pointer rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
                  status === s ? "bg-primary text-white" : "text-muted hover:text-ink",
                )}>
                {s === "all" ? "All" : INVOICE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {isFetching && <Loader2 className="size-4 animate-spin text-muted" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 font-medium">Service</th>
                <th className="px-2 py-2 text-right font-medium">Taxable</th>
                <th className="px-2 py-2 text-right font-medium">GST</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted">
                    Loading invoices…
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((inv) => (
                  <tr key={inv.id} className="border-t border-line/70" data-testid="invoice-row">
                    <td className="px-2 py-3">
                      <Link to={`/admin/bookkeeping/invoices/${inv.id}`} className="font-mono font-semibold text-ink hover:text-primary">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-muted">{new Date(inv.issuedAt).toLocaleDateString("en-IN")}</p>
                    </td>
                    <td className="px-2 py-3 text-ink-soft">
                      {inv.billTo.name || "—"}
                      <p className="text-xs text-muted">{inv.billTo.phone}</p>
                    </td>
                    <td className="px-2 py-3 text-ink-soft">
                      {inv.service.packageName}
                      <p className="text-xs text-muted">{inv.service.vehicleName}</p>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-soft">{formatMoneyExact(inv.taxableAmount)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-soft">{formatMoneyExact(inv.taxAmount)}</td>
                    <td className="px-2 py-3 text-right font-medium tabular-nums text-ink">{formatMoneyExact(inv.total)}</td>
                    <td className="px-2 py-3">
                      <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[inv.status])}>
                        {INVOICE_STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted">
                    No invoices match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </GlassCard>
    </div>
  );
}
