import { useState } from "react";
import { AlertTriangle, ExternalLink, Eye, RotateCcw, Search, Undo2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { usePayments, useBookings, usePaymentStats } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { PaymentDetailModal } from "../components/PaymentDetailModal";
import type { AdminPayment } from "../types";

/** A real Razorpay payment id (`pay_…`) is the only kind with a dashboard page to open. */
function razorpayPaymentUrl(paymentId: string | null): string | null {
  if (!paymentId || !paymentId.startsWith("pay_")) return null;
  return `https://dashboard.razorpay.com/app/payments/${paymentId}`;
}

function PendingRefundsTable({
  payments,
  onManage,
}: {
  payments: AdminPayment[];
  onManage: (p: AdminPayment) => void;
}) {
  const paginated = usePagination(payments, 10);

  return (
    <GlassCard className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 font-medium">Order</th>
            <th className="px-2 py-2 font-medium">Customer</th>
            <th className="px-2 py-2 font-medium">Agent</th>
            <th className="px-2 py-2 font-medium">Booking cancelled</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginated.pageItems.map((p) => {
            const razorpayUrl = razorpayPaymentUrl(p.paymentId);
            return (
              <tr key={p.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{p.orderId}</p>
                  {p.paymentId && <p className="text-xs text-muted break-all">{p.paymentId}</p>}
                </td>
                <td className="px-2 py-3 text-ink-soft">{p.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{p.agentName ?? "—"}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.amount)}</td>
                <td className="px-2 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {razorpayUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={razorpayUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Open in Razorpay
                        </a>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onManage(p)}>
                      <RotateCcw className="size-4" /> Refund
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
          {paginated.pageItems.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-10 text-center text-sm text-muted">
                No pending refunds — every cancelled, paid booking has been settled.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Pagination page={paginated.page} totalPages={paginated.totalPages} onPageChange={paginated.setPage} />
    </GlassCard>
  );
}

function RefundHistoryTable({ payments, onView }: { payments: AdminPayment[]; onView: (p: AdminPayment) => void }) {
  const paginated = usePagination(payments, 10);

  return (
    <GlassCard className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 font-medium">Order</th>
            <th className="px-2 py-2 font-medium">Customer</th>
            <th className="px-2 py-2 font-medium">Refunded on</th>
            <th className="px-2 py-2 font-medium">Remarks</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {paginated.pageItems.map((p) => (
            <tr key={p.id} className="border-t border-line/70">
              <td className="px-2 py-3 font-medium text-ink">{p.orderId}</td>
              <td className="px-2 py-3 text-ink-soft">{p.customerName}</td>
              <td className="px-2 py-3 text-ink-soft">{p.refundedAt ? formatDate(p.refundedAt) : "—"}</td>
              <td className="px-2 py-3 text-ink-soft italic truncate max-w-[220px]">{p.refundReason || "—"}</td>
              <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.refundAmount)}</td>
              <td className="px-2 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => onView(p)}>
                  <Eye className="size-4" /> View
                </Button>
              </td>
            </tr>
          ))}
          {paginated.pageItems.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center text-sm text-muted">
                No refunds processed yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Pagination page={paginated.page} totalPages={paginated.totalPages} onPageChange={paginated.setPage} />
    </GlassCard>
  );
}

export function Refunds() {
  const { data: rawPayments = [] } = usePayments();
  const { data: bookings = [] } = useBookings();
  const { data: stats } = usePaymentStats();
  const [query, setQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);

  const q = query.trim().toLowerCase();
  const matchesQuery = (p: AdminPayment) =>
    !q ||
    p.orderId.toLowerCase().includes(q) ||
    p.customerName.toLowerCase().includes(q) ||
    (p.paymentId && p.paymentId.toLowerCase().includes(q));

  // A payment is owed a refund once it was actually collected and the booking
  // it paid for was then cancelled — regardless of whether the cancellation
  // came before or after the money landed.
  const pending = rawPayments
    .filter((p) => p.status === "paid" && p.bookingStatus === "cancelled" && matchesQuery(p))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const refunded = rawPayments
    .filter((p) => p.status === "refunded" && matchesQuery(p))
    .sort((a, b) => new Date(b.refundedAt ?? b.createdAt).getTime() - new Date(a.refundedAt ?? a.createdAt).getTime());

  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Refunds</h1>
        <p className="mt-1 text-muted">
          Cancelled bookings that were already paid for — track and process what's owed back.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Pending refunds" value={String(pending.length)} icon={AlertTriangle} />
        <StatCard label="Amount owed" value={formatMoney(pendingTotal)} icon={Undo2} />
        {stats && <StatCard label="Refunded to date" value={formatMoney(stats.totalRefunded)} icon={RotateCcw} />}
      </div>

      <div className="sm:w-80">
        <Input
          name="search"
          placeholder="Order ID, Customer, Razorpay payment ID…"
          leading={<Search className="size-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2.5 font-display text-lg font-semibold text-ink">Pending refunds</p>
        <PendingRefundsTable payments={pending} onManage={setSelectedPayment} />
      </div>

      <div>
        <p className="mb-2.5 font-display text-lg font-semibold text-ink">Refund history</p>
        <RefundHistoryTable payments={refunded} onView={setSelectedPayment} />
      </div>

      {selectedPayment && (
        <PaymentDetailModal
          payment={rawPayments.find((p) => p.id === selectedPayment.id) ?? selectedPayment}
          booking={bookings.find((b) => b.id === selectedPayment.bookingId) ?? null}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
