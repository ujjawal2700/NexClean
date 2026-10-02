import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Coins, ExternalLink, Eye, Info, Loader2, RotateCcw, Search, Undo2, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { ApiError } from "@shared/lib/api";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { useRefunds, useApproveRefund, useRejectRefund, usePaymentStats } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { RefundDetailModal } from "../components/RefundDetailModal";
import type { AdminRefund } from "../types";

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Refunded" },
  { id: "rejected", label: "Declined" },
  { id: "all", label: "All" },
];

const STATUS: Record<AdminRefund["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700" },
  processing: { label: "Sending…", className: "bg-primary/10 text-primary" },
  approved: { label: "Refunded", className: "bg-emerald-500/10 text-emerald-700" },
  rejected: { label: "Declined", className: "bg-red-500/10 text-red-600" },
};

/** A real Razorpay payment id (`pay_…`) is the only kind with a dashboard page to open. */
function razorpayPaymentUrl(paymentId: string | null): string | null {
  if (!paymentId || !paymentId.startsWith("pay_")) return null;
  return `https://dashboard.razorpay.com/app/payments/${paymentId}`;
}

/** "₹100 + 100 coins" — what a refund returns, split by where it came from. */
function whatReturns(r: Pick<AdminRefund, "amount" | "coins">) {
  return [r.amount > 0 ? formatMoney(r.amount) : null, r.coins > 0 ? `${r.coins.toLocaleString("en-IN")} coins` : null]
    .filter(Boolean)
    .join(" + ");
}

/**
 * Admin → Refunds. Every cancelled booking the customer had paid for — online,
 * with coins, or both — lands here as a refund request. Nothing goes back until
 * an admin approves: the online part returns to the original payment method
 * through Razorpay, the coins return to the customer's wallet. Declining keeps
 * the money and tells the customer why.
 */
export function Refunds() {
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const { data: rows = [], isLoading } = useRefunds(tab);
  const { data: pendingRows = [] } = useRefunds("pending");
  const { data: stats } = usePaymentStats();

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      !q ||
      r.customer.name.toLowerCase().includes(q) ||
      r.customer.phone.includes(q) ||
      r.payments.some((p) => p.orderId.toLowerCase().includes(q) || (p.paymentId ?? "").toLowerCase().includes(q)),
  );
  const paginated = usePagination(visible, 10);

  const owedMoney = pendingRows.reduce((s, r) => s + r.amount, 0);
  const owedCoins = pendingRows.reduce((s, r) => s + r.coins, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Refunds</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Cancelled bookings the customer had paid for. Approve to send the online amount back to their original
          payment method and the coins back to their wallet, or decline with a reason.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Pending refunds" value={String(pendingRows.length)} icon={AlertTriangle} />
        <StatCard
          label="Amount owed"
          value={owedCoins > 0 ? `${formatMoney(owedMoney)} + ${owedCoins.toLocaleString("en-IN")} coins` : formatMoney(owedMoney)}
          icon={Undo2}
        />
        {stats && <StatCard label="Refunded to date" value={formatMoney(stats.totalRefunded)} icon={RotateCcw} />}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "cursor-pointer rounded-pill border px-4 py-1.5 text-sm transition-colors",
                tab === t.id ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.id === "pending" && pendingRows.length > 0 && ` (${pendingRows.length})`}
            </button>
          ))}
        </div>
        <div className="sm:w-80">
          <Input
            name="search"
            placeholder="Customer, phone, order or Razorpay ID…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading refunds…</p>
      ) : visible.length === 0 ? (
        <GlassCard className="py-14 text-center text-muted">
          <Undo2 className="mx-auto mb-2 size-7" />
          {tab === "pending" ? "No pending refunds — every cancelled, paid booking has been dealt with." : "Nothing here yet."}
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginated.pageItems.map((r) => (
            <RefundRow key={r.id} refund={r} />
          ))}
          <Pagination page={paginated.page} totalPages={paginated.totalPages} onPageChange={paginated.setPage} />
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Cash that was never collected isn&apos;t refunded, and peak-upgrade change fees are kept, as per the refund
        policy. A payment already refunded from Payments is skipped when you approve.
      </p>
    </div>
  );
}

function RefundRow({ refund: r }: { refund: AdminRefund }) {
  const approve = useApproveRefund();
  const reject = useRejectRefund();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState(false);
  const busy = approve.isPending || reject.isPending;
  const error = approve.error ?? reject.error;
  const status = STATUS[r.status];

  return (
    <GlassCard className="space-y-4" data-testid="refund-row">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {r.customer.id ? (
              <Link to={`/admin/customers/${r.customer.id}`} className="font-display text-lg font-semibold text-ink hover:text-primary">
                {r.customer.name}
              </Link>
            ) : (
              <span className="font-display text-lg font-semibold text-ink">{r.customer.name}</span>
            )}
            <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", status.className)}>{status.label}</span>
          </div>
          <p className="text-sm text-muted">
            {r.customer.phone && <>{r.customer.phone} · </>}
            {r.booking ? (
              <Link to={`/admin/bookings/${r.booking.id}`} className="hover:text-primary">
                {r.booking.packageName} · {r.booking.vehicleName}
                {r.booking.date && (
                  <>
                    {" "}
                    · {formatDate(r.booking.date)} {r.booking.slot}
                  </>
                )}
              </Link>
            ) : (
              "Booking removed"
            )}
          </p>
          <p className="text-xs text-muted">
            Cancelled by {r.cancelledBy === "customer" ? "the customer" : "an admin"} · requested {formatDate(r.createdAt)}
            {r.decidedAt && <> · decided {formatDate(r.decidedAt)}</>}
          </p>
          {r.payments.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted">
              {r.payments.map((p) => {
                const url = razorpayPaymentUrl(p.paymentId);
                return (
                  <span key={p.id} className="flex items-center gap-1.5">
                    {p.orderId} · {formatMoney(p.amount)}
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        <ExternalLink className="size-3" /> Razorpay
                      </a>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-right">
          {r.amount > 0 && (
            <p className="font-display text-xl font-semibold text-ink">
              {formatMoney(r.amount)} <span className="text-xs font-normal text-muted">to original payment</span>
            </p>
          )}
          {r.coins > 0 && (
            <p className="flex items-center justify-end gap-1 text-sm font-medium text-amber-600">
              <Coins className="size-4" /> {r.coins.toLocaleString("en-IN")} coins{" "}
              <span className="text-xs font-normal text-muted">to wallet</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setViewing(true)} data-testid="view-refund-details">
          <Eye className="size-4" /> View payment details
        </Button>
        {r.payments
          .filter((p) => razorpayPaymentUrl(p.paymentId))
          .map((p) => (
            <Button key={p.id} asChild variant="ghost" size="sm">
              <a href={razorpayPaymentUrl(p.paymentId)!} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> {p.paymentId}
              </a>
            </Button>
          ))}
      </div>
      {viewing && <RefundDetailModal id={r.id} onClose={() => setViewing(false)} />}

      {r.status === "rejected" && r.note && <p className="text-sm text-muted">Reason: {r.note}</p>}
      {r.lastError && r.status === "pending" && (
        <p className="flex items-start gap-1.5 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Last attempt failed: {r.lastError}
        </p>
      )}

      {r.status === "pending" && (
        <div className="border-t border-line pt-4">
          {mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setMode("approve")}>
                <Check className="size-4" /> Approve refund
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("reject")}>
                <X className="size-4" /> Decline
              </Button>
            </div>
          )}

          {mode === "approve" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 text-sm text-ink">
                Send {whatReturns(r)} back to {r.customer.name}?
              </p>
              <Button size="sm" disabled={busy} onClick={() => approve.mutate({ id: r.id }, { onSuccess: () => setMode("idle") })}>
                {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Yes, send refund
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          )}

          {mode === "reject" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  name="rejectNote"
                  label="Reason (shown to the customer, optional)"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => reject.mutate({ id: r.id, note }, { onSuccess: () => setMode("idle") })}
                >
                  {reject.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                  Decline refund
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error instanceof ApiError ? error.message : "Couldn't update this refund. Try again."}
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
