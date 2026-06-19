import { IndianRupee, CheckCircle2, XCircle, Star } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatMoney } from "@shared/lib/format";
import { useBookings, useAgents } from "../api/admin.api";
import { VEHICLE_LABEL, VEHICLE_TYPES } from "../types";
import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/BarChart";

export function Reports() {
  const { data: bookings = [] } = useBookings();
  const { data: agents = [] } = useAgents();

  const revenueByVehicle = VEHICLE_TYPES.map((t) => ({
    label: VEHICLE_LABEL[t].slice(0, 4),
    value: bookings.filter((b) => b.vehicleType === t && b.status === "completed").reduce((s, b) => s + b.price, 0),
  }));

  const completed = bookings.filter((b) => b.status === "completed").length;
  const cancelled = bookings.filter((b) => b.status === "cancelled").length;
  const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const avgRating = agents.length ? (agents.reduce((s, a) => s + a.rating, 0) / agents.length).toFixed(1) : "0.0";

  // top societies by booking count
  const societyCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.society] = (acc[b.society] ?? 0) + 1;
    return acc;
  }, {});
  const topSocieties = Object.entries(societyCounts).sort((a, b) => b[1] - a[1]);
  const maxSociety = Math.max(...topSocieties.map(([, n]) => n), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Reports &amp; Analytics</h1>
        <p className="mt-1 text-muted">Business insights from your operations.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total revenue" value={formatMoney(revenue)} />
        <StatCard icon={CheckCircle2} label="Completed" value={String(completed)} />
        <StatCard icon={XCircle} label="Cancelled" value={String(cancelled)} />
        <StatCard icon={Star} label="Avg agent rating" value={`${avgRating}★`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Revenue by vehicle type</p>
          <p className="text-sm text-muted">Completed bookings</p>
          <div className="mt-6">
            <BarChart data={revenueByVehicle} format={formatMoney} />
          </div>
        </GlassCard>

        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Top societies</p>
          <p className="text-sm text-muted">By booking volume</p>
          <div className="mt-6 space-y-4">
            {topSocieties.map(([society, count]) => (
              <div key={society}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{society}</span>
                  <span className="text-muted">{count} bookings</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${(count / maxSociety) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
