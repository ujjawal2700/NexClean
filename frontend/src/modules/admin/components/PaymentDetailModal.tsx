import { useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  ExternalLink,
  Download,
  Wallet,
  RotateCcw,
  Loader2,
  User,
  Wrench,
  CalendarClock,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { formatMoney, formatDate } from "@shared/lib/format";
import { downloadPaymentReceipt } from "@shared/lib/receipt";
import { useRefundPayment, useSettlePayment, useCategoryLabel } from "../api/admin.api";
import type { AdminPayment, AdminBooking } from "../types";
import {
  PAYMENT_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  SETTLEMENT_STATUS_STYLE,
  BOOKING_STATUS_STYLE,
  BOOKING_STATUS_LABEL,
} from "../lib/status";

/**
 * A real Razorpay payment id (`pay_…`) is the only kind with a dashboard page
 * to deep-link to — mock/dev-mode ids (`order_mock_…`) and cash rows
 * (`cash_…`) never reached Razorpay and have nothing to open there.
 */
function razorpayPaymentUrl(paymentId: string | null): string | null {
  if (!paymentId || !paymentId.startsWith("pay_")) return null;
  return `https://dashboard.razorpay.com/app/payments/${paymentId}`;
}

export function PaymentDetailModal({
  payment,
  booking,
  onClose,
}: {
  payment: AdminPayment;
  booking: AdminBooking | null;
  onClose: () => void;
}) {
  const refund = useRefundPayment();
  const settle = useSettlePayment();
  const categoryLabel = useCategoryLabel();
  const [refundAmount, setRefundAmount] = useState(String(payment.amount));
  const [refundReason, setRefundReason] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const razorpayUrl = razorpayPaymentUrl(payment.paymentId);
  const needsRefund = payment.status === "paid" && payment.bookingStatus === "cancelled";

  const submitRefund = () => {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      setError("Enter a refund amount greater than ₹0");
      return;
    }
    setError("");
    refund.mutate(
      { id: payment.id, amount, reason: refundReason.trim() || undefined },
      { onError: (err: any) => setError(err?.message || "Refund failed") },
    );
  };

  const downloadReceipt = async () => {
    setDownloading(true);
    try {
      await downloadPaymentReceipt(payment, booking, booking ? categoryLabel(booking.vehicleType) : "");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4 shrink-0">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Payment details</h3>
            <p className="text-xs text-muted">{payment.orderId}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {needsRefund && (
            <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
              This booking was cancelled after the customer paid — a refund is owed here.
            </div>
          )}

          {/* Identifiers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYMENT_STATUS_STYLE[payment.status])}>
                {PAYMENT_STATUS_LABEL[payment.status]}
              </span>
              {payment.status === "paid" && (
                <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", SETTLEMENT_STATUS_STYLE[payment.settlementStatus])}>
                  {payment.settlementStatus}
                </span>
              )}
            </div>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Order ID</dt>
              <dd className="text-ink font-medium break-all">{payment.orderId}</dd>
              <dt className="text-muted">Payment ID</dt>
              <dd className="text-ink font-medium break-all">
                {payment.paymentId ?? <span className="text-muted font-normal">Not collected yet</span>}
              </dd>
              <dt className="text-muted">Amount</dt>
              <dd className="text-ink font-medium">{formatMoney(payment.amount)}</dd>
              <dt className="text-muted">Date</dt>
              <dd className="text-ink font-medium">{formatDate(payment.createdAt)}</dd>
            </dl>
          </div>

          {/* People & booking */}
          <div className="space-y-2 rounded-2xl border border-line bg-surface-muted/40 p-3.5">
            <div className="flex items-center gap-2 text-sm">
              <User className="size-4 text-muted shrink-0" />
              <span className="text-muted">Customer</span>
              <Link to={`/admin/customers/${payment.customerId}`} onClick={onClose} className="ml-auto font-medium text-primary hover:underline">
                {payment.customerName}
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="size-4 text-muted shrink-0" />
              <span className="text-muted">Agent</span>
              {payment.agentId ? (
                <Link to={`/admin/agents/${payment.agentId}`} onClick={onClose} className="ml-auto font-medium text-primary hover:underline">
                  {payment.agentName}
                </Link>
              ) : (
                <span className="ml-auto text-ink-soft">{payment.agentName ?? "Not yet assigned"}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-muted shrink-0" />
              <span className="text-muted">Booking</span>
              {payment.bookingId ? (
                <Link to={`/admin/bookings/${payment.bookingId}`} onClick={onClose} className="ml-auto font-medium text-primary hover:underline">
                  #{payment.bookingId}
                </Link>
              ) : (
                <span className="ml-auto text-ink-soft">—</span>
              )}
            </div>
            {payment.bookingStatus && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Booking status</span>
                <span className={cn("ml-auto rounded-pill px-2.5 py-0.5 text-xs font-medium", BOOKING_STATUS_STYLE[payment.bookingStatus])}>
                  {BOOKING_STATUS_LABEL[payment.bookingStatus]}
                </span>
              </div>
            )}
          </div>

          {/* Refund history / form */}
          {payment.status === "refunded" ? (
            <div className="space-y-1.5 rounded-2xl border border-line p-3.5 text-sm">
              <p className="font-medium text-ink">Refunded</p>
              <p className="text-ink-soft">{formatMoney(payment.refundAmount)} on {payment.refundedAt ? formatDate(payment.refundedAt) : "—"}</p>
              {payment.refundReason && <p className="text-muted italic">"{payment.refundReason}"</p>}
            </div>
          ) : payment.status === "paid" ? (
            <div className="space-y-2.5 rounded-2xl border border-line p-3.5">
              <p className="text-sm font-semibold text-ink">Process a refund</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={payment.amount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Full amount</label>
                  <button
                    type="button"
                    onClick={() => setRefundAmount(String(payment.amount))}
                    className="h-10 w-full rounded-xl border border-line text-sm text-ink-soft hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    {formatMoney(payment.amount)}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Remarks (shown on the ledger)</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Booking cancelled by admin, customer requested refund…"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary/50"
                />
              </div>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <Button
                size="sm"
                variant={needsRefund ? "primary" : "outline"}
                disabled={refund.isPending}
                onClick={submitRefund}
                className="w-full"
              >
                {refund.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Process refund
              </Button>
            </div>
          ) : null}

          {/* Settlement */}
          {payment.status === "paid" && payment.settlementStatus === "pending" && (
            <Button variant="outline" size="sm" disabled={settle.isPending} onClick={() => settle.mutate(payment.id)} className="w-full">
              <Wallet className="size-4" /> Mark agent payout settled
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-6 py-4 shrink-0">
          <Button variant="outline" size="sm" disabled={downloading} onClick={downloadReceipt} className="flex-1">
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Receipt
          </Button>
          {razorpayUrl && (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={razorpayUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open in Razorpay
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
