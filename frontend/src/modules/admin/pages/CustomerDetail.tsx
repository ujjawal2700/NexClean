import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Car } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useCustomer, useCustomerActivity } from "../api/admin.api";
import { VEHICLE_LABEL } from "../types";
import { BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL, PAYMENT_STATUS_STYLE, PAYMENT_STATUS_LABEL } from "../lib/status";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer } = useCustomer(id ?? "");
  const { data: activity } = useCustomerActivity(id ?? "");

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
        <div>
          <h1 className="font-display text-2xl text-ink">{customer.name}</h1>
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
                  <p className="text-xs text-muted">{VEHICLE_LABEL[v.type]} · {v.plate}</p>
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

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Booking history</p>
        <table className="mt-4 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Booking</th>
              <th className="px-2 py-2 font-medium">When</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(activity?.bookings ?? []).map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{b.vehicleName}</p>
                  <p className="text-xs text-muted">#{b.id}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)} · {b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">{b.agentName ?? "—"}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", BOOKING_STATUS_STYLE[b.status])}>
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(b.price)}</td>
              </tr>
            ))}
            {(activity?.bookings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted">
                  No bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Payment history</p>
        <table className="mt-4 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Order</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(activity?.payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line/70">
                <td className="px-2 py-3 text-ink-soft">{p.orderId}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYMENT_STATUS_STYLE[p.status])}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.amount)}</td>
              </tr>
            ))}
            {(activity?.payments ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center text-muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
