import { IndianRupee, CheckCircle2, XCircle, Star, Users, Repeat, AlertTriangle, RefreshCw } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Skeleton, SkeletonStatCards } from "@shared/ui/Skeleton";
import { formatMoney } from "@shared/lib/format";
import { useBookings, useAgents, useReports } from "../api/admin.api";
import { VEHICLE_LABEL } from "../types";
import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/BarChart";

function dayLabel(iso: string, everyNth: number, index: number, total: number) {
  if (index !== 0 && index !== total - 1 && index % everyNth !== 0) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Reports() {
  const { data: bookings = [] } = useBookings();
  const { data: agents = [] } = useAgents();
  const { data: reports, isLoading, isError, refetch, isRefetching } = useReports();

  const completed = bookings.filter((b) => b.status === "completed").length;
  const cancelled = bookings.filter((b) => b.status === "cancelled").length;
  const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const avgRating = agents.length ? (agents.reduce((s, a) => s + a.rating, 0) / agents.length).toFixed(1) : "0.0";

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Reports &amp; Analytics</h1>
          <p className="mt-1 text-muted">Business insights from your operations.</p>
        </div>
        <GlassCard className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle className="size-6" />
          </span>
          <p className="font-display text-lg font-semibold text-ink">Couldn't load reports</p>
          <p className="max-w-sm text-sm text-muted">
            The reports service didn't respond. Check that the API is reachable, then try again.
          </p>
          <Button variant="outline" size="sm" disabled={isRefetching} onClick={() => refetch()}>
            <RefreshCw className="size-4" /> {isRefetching ? "Retrying…" : "Retry"}
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (isLoading || !reports) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Reports &amp; Analytics</h1>
          <p className="mt-1 text-muted">Business insights from your operations.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SkeletonStatCards count={4} />
        </div>
        <GlassCard>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
          <Skeleton className="mt-6 h-40 w-full" />
        </GlassCard>
      </div>
    );
  }

  const trendBars = reports.revenueTrend.map((d, i) => ({
    label: dayLabel(d.date, 5, i, reports.revenueTrend.length),
    value: d.revenue,
  }));
  const revenueByVehicle = reports.revenueByVehicle.map((v) => ({
    label: VEHICLE_LABEL[v.vehicleType].slice(0, 4),
    value: v.revenue,
  }));
  const maxSociety = Math.max(...reports.topSocieties.map((s) => s.count), 1);
  const { customerRetention: retention } = reports;

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

      <GlassCard>
        <p className="font-display text-lg font-semibold text-ink">Revenue trend</p>
        <p className="text-sm text-muted">Last 30 days, completed bookings</p>
        <div className="mt-6">
          <BarChart data={trendBars} format={formatMoney} />
        </div>
      </GlassCard>

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
            {reports.topSocieties.map((s) => (
              <div key={s.society}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{s.society}</span>
                  <span className="text-muted">{s.count} bookings</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${(s.count / maxSociety) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {reports.topSocieties.length === 0 && <p className="text-sm text-muted">No bookings yet.</p>}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Agent performance</p>
          <p className="text-sm text-muted">Revenue generated and completion rate</p>
          <div className="mt-5 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Agent</th>
                  <th className="px-2 py-2 font-medium">Rating</th>
                  <th className="px-2 py-2 font-medium">Completed</th>
                  <th className="px-2 py-2 font-medium">Completion rate</th>
                  <th className="px-2 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reports.agentPerformance.map((a) => (
                  <tr key={a.id} className="border-t border-line/70">
                    <td className="px-2 py-3 font-medium text-ink">{a.name}</td>
                    <td className="px-2 py-3 text-ink-soft">{a.rating}★</td>
                    <td className="px-2 py-3 text-ink-soft">{a.jobsCompleted}</td>
                    <td className="px-2 py-3 text-ink-soft">{a.completionRate}%</td>
                    <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reports.agentPerformance.length === 0 && <p className="px-2 py-3 text-sm text-muted">No agents yet.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Customer retention</p>
          <p className="text-sm text-muted">Repeat booking behaviour</p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="flex items-center gap-1.5 font-display text-2xl font-semibold text-ink">
                <Repeat className="size-4 text-primary" /> {retention.repeatRate}%
              </p>
              <p className="mt-1 text-xs text-muted">Repeat rate</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="flex items-center gap-1.5 font-display text-2xl font-semibold text-ink">
                <Users className="size-4 text-primary" /> {retention.totalCustomers}
              </p>
              <p className="mt-1 text-xs text-muted">Total customers</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="font-display text-2xl font-semibold text-ink">{retention.repeatCustomers}</p>
              <p className="mt-1 text-xs text-muted">Repeat customers</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="font-display text-2xl font-semibold text-ink">{retention.newThisMonth}</p>
              <p className="mt-1 text-xs text-muted">
                New this month{" "}
                <span className={retention.newThisMonth >= retention.newLastMonth ? "text-emerald-600" : "text-red-500"}>
                  ({retention.newThisMonth >= retention.newLastMonth ? "+" : ""}
                  {retention.newThisMonth - retention.newLastMonth} vs last month)
                </span>
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
