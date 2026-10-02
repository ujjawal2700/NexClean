import { Link } from "react-router-dom";
import { Coins, CreditCard, ExternalLink, Info, Phone } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useRefundDetail } from "../api/admin.api";
import { CopyField, DetailModal } from "./DetailModal";

/** A real Razorpay payment id (`pay_…`) is the only kind with a dashboard page to open. */
function razorpayPaymentUrl(paymentId: string | null): string | null {
  if (!paymentId || !paymentId.startsWith("pay_")) return null;
  return `https://dashboard.razorpay.com/app/payments/${paymentId}`;
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700" },
  processing: { label: "Sending…", className: "bg-primary/10 text-primary" },
  approved: { label: "Refunded", className: "bg-emerald-500/10 text-emerald-700" },
  rejected: { label: "Declined", className: "bg-red-500/10 text-red-600" },
};

/**
 * What a refund is for, before deciding on it: how the customer paid (online
 * via Razorpay, coins, coupon), each payment's order and payment ids with a
 * link into the Razorpay dashboard, and the booking that was cancelled.
 */
export function RefundDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: r, isLoading, error } = useRefundDetail(id);
  const status = r ? STATUS[r.status] : null;

  return (
    <DetailModal
      title="Refund details"
      subtitle={r ? `Requested ${formatDate(r.createdAt)} · cancelled by ${r.cancelledBy === "customer" ? "the customer" : "an admin"}` : undefined}
      onClose={onClose}
      testId="refund-detail"
    >
      {isLoading || !r ? (
        <p className="text-sm text-muted">{error ? "Couldn't load this refund." : "Loading…"}</p>
      ) : (
        <>
          {/* What goes back */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Refund</p>
              <p className="font-display text-2xl font-semibold text-ink">
                {r.amount > 0 ? formatMoney(r.amount) : "—"}
                {r.coins > 0 && (
                  <span className="ml-2 text-base font-medium text-amber-600">
                    + {r.coins.toLocaleString("en-IN")} coins
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {r.amount > 0 && "Money to the original payment method"}
                {r.amount > 0 && r.coins > 0 && " · "}
                {r.coins > 0 && "coins to the wallet"}
              </p>
            </div>
            {status && (
              <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", status.className)}>{status.label}</span>
            )}
          </div>
          {(r.decidedAt || r.note || r.lastError) && (
            <p className="-mt-2 text-xs text-muted">
              {r.decidedAt && <>Decided {formatDate(r.decidedAt)}{r.decidedByName ? ` by ${r.decidedByName}` : ""}. </>}
              {r.note && <>Reason: {r.note}. </>}
              {r.lastError && <span className="text-amber-700">Last attempt failed: {r.lastError}</span>}
            </p>
          )}

          {/* Payments */}
          <section className="space-y-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CreditCard className="size-4 text-primary" /> Payments
            </p>
            {r.payments.length === 0 ? (
              <p className="rounded-2xl border border-line px-4 py-3 text-sm text-muted">
                No online payment — this booking was paid in cash (never collected) and/or coins only.
              </p>
            ) : (
              r.payments.map((p) => {
                const url = razorpayPaymentUrl(p.paymentId);
                return (
                  <div key={p.id} className="rounded-2xl border border-line p-4" data-testid="refund-payment">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {p.mode}
                      </span>
                      <span className="text-xs capitalize text-muted">
                        {p.kind === "reschedule" ? "Reschedule payment" : "Booking payment"} · {p.status}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted">Paid</dt>
                        <dd className="font-medium text-ink">{formatMoney(p.paidAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted">To refund</dt>
                        <dd className="font-medium text-ink">{formatMoney(p.refundAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted">Paid on</dt>
                        <dd className="font-medium text-ink">{p.paidAt ? formatDate(p.paidAt) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted">Refunded on</dt>
                        <dd className="font-medium text-ink">{p.refundedAt ? formatDate(p.refundedAt) : "—"}</dd>
                      </div>
                    </dl>
                    <div className="mt-2 divide-y divide-line/60 border-t border-line/60">
                      <CopyField label="Order ID" value={p.orderId} mono />
                      <CopyField label="Payment ID" value={p.paymentId} mono />
                    </div>
                    {url ? (
                      <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                        <a href={url} target="_blank" rel="noreferrer" data-testid="open-in-razorpay">
                          <ExternalLink className="size-4" /> Open payment in Razorpay
                        </a>
                      </Button>
                    ) : (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        Not a Razorpay payment, so there's no dashboard page to open.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {/* How the booking was paid for */}
          {r.booking && (
            <section className="rounded-2xl border border-line p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/admin/bookings/${r.booking.id}`} onClick={onClose} className="font-semibold text-primary hover:underline">
                    {r.booking.packageName} · {r.booking.vehicleName}
                  </Link>
                  <p className="text-xs text-muted">
                    {r.booking.date ? `${formatDate(r.booking.date)} · ${r.booking.slot}` : r.booking.slot}
                    {r.booking.address && ` · ${r.booking.address}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs capitalize text-muted">{r.booking.status}</span>
              </div>
              <dl className="mt-3 space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted">Booking total</dt>
                  <dd className="font-medium text-ink">{formatMoney(r.booking.price)}</dd>
                </div>
                {r.booking.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Coupon{r.booking.discountCode ? ` (${r.booking.discountCode})` : ""}</dt>
                    <dd className="font-medium text-emerald-600">−{formatMoney(r.booking.discountAmount)}</dd>
                  </div>
                )}
                {r.booking.coinsRedeemed > 0 && (
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-1 text-muted">
                      <Coins className="size-3.5 text-amber-600" /> Coins used ({r.booking.coinsRedeemed.toLocaleString("en-IN")})
                    </dt>
                    <dd className="font-medium text-amber-600">−{formatMoney(r.booking.coinDiscount)}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Customer */}
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-4 text-sm">
            {r.customer.id ? (
              <Link to={`/admin/customers/${r.customer.id}`} onClick={onClose} className="font-semibold text-primary hover:underline">
                {r.customer.name}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{r.customer.name}</span>
            )}
            <span className="flex flex-wrap items-center gap-3 text-muted">
              {r.customer.phone && (
                <a href={`tel:${r.customer.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <Phone className="size-3.5" /> {r.customer.phone}
                </a>
              )}
              {r.customer.email && <span className="break-all">{r.customer.email}</span>}
            </span>
          </section>
        </>
      )}
    </DetailModal>
  );
}
