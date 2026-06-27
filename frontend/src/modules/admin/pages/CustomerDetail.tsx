import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Car, Ban, RotateCcw, Download, Loader2, Gift, Users } from "lucide-react";
import { cn } from "@shared/lib/utils";

import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate, formatTime } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { downloadBookingReceipt, downloadPaymentReceipt } from "@shared/lib/receipt";
import { useCustomer, useCustomerActivity, useCategoryLabel, useSetCustomerStatus } from "../api/admin.api";
import type { AdminBooking, AdminPayment } from "../types";
import {
  BOOKING_STATUS_STYLE,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  CUSTOMER_STATUS_STYLE,
} from "../lib/status";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer } = useCustomer(id ?? "");
  const { data: activity } = useCustomerActivity(id ?? "");
  const categoryLabel = useCategoryLabel();
  const setCustomerStatus = useSetCustomerStatus();
  const bookings = usePagination(activity?.bookings ?? [], 5);
  const payments = usePagination(activity?.payments ?? [], 5);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadReceipt = async (b: AdminBooking) => {
    setDownloadingId(b.id);
    try {
      const payment = activity?.payments.find((p) => p.bookingId === b.id) ?? null;
      await downloadBookingReceipt(b, payment, categoryLabel(b.vehicleType));
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadPaymentReceiptFor = async (p: AdminPayment) => {
    setDownloadingId(p.id);
    try {
      const booking = activity?.bookings.find((b) => b.id === p.bookingId) ?? null;
      await downloadPaymentReceipt(p, booking, booking ? categoryLabel(booking.vehicleType) : "");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/admin/customers")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to customers
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-lg font-semibold text-white">
          {customer.name.split(" ").map((n) => n[0]).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-ink">{customer.name}</h1>
            <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", CUSTOMER_STATUS_STYLE[customer.status])}>
              {customer.status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {customer.phone}
            </span>
            {customer.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {customer.email}
              </span>
            )}
            <span>Joined {formatDate(customer.joinedAt)}</span>
          </div>
        </div>

        {customer.status === "active" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={setCustomerStatus.isPending}
            onClick={() => setCustomerStatus.mutate({ id: customer.id, status: "suspended" })}
          >
            <Ban className="size-4" /> Suspend
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={setCustomerStatus.isPending}
            onClick={() => setCustomerStatus.mutate({ id: customer.id, status: "active" })}
          >
            <RotateCcw className="size-4" /> Reactivate
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GlassCard>
          <p className="text-sm text-muted">Total bookings</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{customer.totalBookings}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Total spend</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{formatMoney(customer.totalSpend)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Active plan</p>
          <p className="mt-1.5 font-display text-2xl font-semibold capitalize text-ink">{customer.activePlan ?? "None"}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Vehicles / addresses</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">
            {customer.vehicleCount} / {customer.addressCount}
          </p>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Vehicles</p>
          <div className="mt-4 space-y-3">
            {customer.vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Car className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{v.name}</p>
                  <p className="text-xs text-muted">{categoryLabel(v.type)} · {v.plate}</p>
                </div>
              </div>
            ))}
            {customer.vehicles.length === 0 && <p className="text-sm text-muted">No vehicles added.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Addresses</p>
          <div className="mt-4 space-y-3">
            {customer.addresses.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{a.label}</p>
                  <p className="text-xs text-muted">{a.line}{a.society ? ` · ${a.society}` : ""}</p>
                </div>
              </div>
            ))}
            {customer.addresses.length === 0 && <p className="text-sm text-muted">No addresses added.</p>}
          </div>
        </GlassCard>
      </div>


      {/* Referral History & Statuses */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            <p className="font-display text-lg font-semibold text-ink">Referral Summary</p>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center py-2.5 border-b border-line">
              <span className="text-sm text-muted">Referral Code</span>
              <span className="font-mono text-sm font-semibold rounded bg-primary/5 border border-primary/10 px-2.5 py-1 text-primary">
                {customer.referralCode ?? "—"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-line">
              <span className="text-sm text-muted">Referral Earnings</span>
              <span className="text-sm font-bold text-ink">{formatMoney(customer.referralEarnings)}</span>
            </div>
            <div className="py-2.5">
              <span className="block text-sm text-muted mb-2">Referred By</span>
              {customer.referredBy ? (
                <div className="rounded-2xl border border-line bg-surface/60 p-3 flex flex-col gap-1 text-xs">
                  <p className="font-semibold text-ink">{customer.referredBy.name}</p>
                  <p className="text-muted">Phone: {customer.referredBy.phone}</p>
                  <p className="text-muted">Code: <span className="font-mono text-primary font-medium">{customer.referredBy.code}</span></p>
                </div>
              ) : (
                <p className="text-sm text-muted italic">None (Direct signup)</p>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <p className="font-display text-lg font-semibold text-ink">Referred Friends ({customer.referredUsers.length})</p>
          </div>
          <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1">
            {customer.referredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface/60 p-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{u.name}</p>
                  <p className="text-xs text-muted">Phone: {u.phone} · Joined {formatDate(u.joinedAt)}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium border",
                  u.status === "Subscribed" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                  u.status === "First Clean Done" && "bg-green-500/10 text-green-600 border-green-500/20",
                  u.status === "Joined" && "bg-gray-500/10 text-ink-soft border-line"
                )}>
                  {u.status === "Joined" ? "Signed Up" : u.status}
                </span>
              </div>
            ))}
            {customer.referredUsers.length === 0 && (
              <p className="text-sm text-muted">This customer hasn't referred anyone yet.</p>
            )}
          </div>
        </GlassCard>
      </div>


      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Booking history</p>
        <table className="mt-4 w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Booking</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 text-right font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {bookings.pageItems.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{b.vehicleName}</p>
                  <p className="text-xs text-muted">#{b.id}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)}</td>
                <td className="px-2 py-3 text-ink-soft">{b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">{b.agentName ?? "—"}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", BOOKING_STATUS_STYLE[b.status])}>
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(b.price)}</td>
                <td className="px-2 py-3 text-right">
                  <button
                    onClick={() => downloadReceipt(b)}
                    disabled={downloadingId === b.id}
                    aria-label={`Download receipt for booking ${b.id}`}
                    className="ml-auto grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  >
                    {downloadingId === b.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {bookings.pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-muted">
                  No bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={bookings.page} totalPages={bookings.totalPages} onPageChange={bookings.setPage} />
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Payment history</p>
        <table className="mt-4 w-full min-w-[740px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Order</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 text-right font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {payments.pageItems.map((p) => (
              <tr key={p.id} className="border-t border-line/70">
                <td className="px-2 py-3 text-ink-soft">{p.orderId}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                <td className="px-2 py-3 text-ink-soft">{formatTime(p.createdAt)}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYMENT_STATUS_STYLE[p.status])}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.amount)}</td>
                <td className="px-2 py-3 text-right">
                  <button
                    onClick={() => downloadPaymentReceiptFor(p)}
                    disabled={downloadingId === p.id}
                    aria-label={`Download receipt for order ${p.orderId}`}
                    className="ml-auto grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  >
                    {downloadingId === p.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {payments.pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={payments.page} totalPages={payments.totalPages} onPageChange={payments.setPage} />
      </GlassCard>
    </div>
  );
}
