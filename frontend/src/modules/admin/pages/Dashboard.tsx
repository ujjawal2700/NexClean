import { Link } from "react-router-dom";
import { IndianRupee, CalendarRange, Users, Radar, ArrowRight, UserRound, Car } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { cn } from "@shared/lib/utils";
import { formatMoney, formatDate } from "@shared/lib/format";
import { Skeleton, SkeletonStatCards, SkeletonTableRows } from "@shared/ui/Skeleton";
import { useStats, useBookings, useTriggered, useReports, useAgents } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/BarChart";
import { BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL } from "../lib/status";
import { Button } from "@shared/ui/Button";

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: triggered = [], isLoading: triggeredLoading } = useTriggered();
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { data: agents = [] } = useAgents();

  const pendingCount = agents.filter((a) => a.status === "pending").length;
  const recent = bookings.slice(0, 5);
  const weeklyRevenue = (reports?.revenueTrend ?? []).slice(-7).map((d) => ({
    label: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }),
    value: d.revenue,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Dashboard</h1>
        <p className="mt-1 text-muted">Operations overview at a glance.</p>
      </div>

      {pendingCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-orange-500 text-white shadow-md">
                <Users className="size-5" />
              </span>
              <div>
                <p className="font-display font-semibold text-ink">Pending Agent Verifications</p>
                <p className="text-sm text-muted">
                  There {pendingCount === 1 ? "is 1 agent application" : `are ${pendingCount} agent applications`} waiting for verification.
                </p>
              </div>
            </div>
            <Link to="/admin/agent-verification" className="shrink-0">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white shadow-sm font-medium">
                Verify Now <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statsLoading ? (
          <SkeletonStatCards count={6} />
        ) : (
          <>
            <StatCard icon={UserRound} label="Total users" value={String(stats?.totalUsers ?? 0)} />
            <StatCard icon={IndianRupee} label="Revenue (completed)" value={formatMoney(stats?.revenue ?? 0)} delta="12.4% vs last week" trend="up" />
            <StatCard icon={CalendarRange} label="Active bookings" value={String(stats?.activeBookings ?? 0)} delta="today" trend="up" />
            <StatCard icon={Car} label="Active services" value={String(stats?.activeServices ?? 0)} delta="in progress" trend="up" />
            <StatCard icon={Users} label="Agents online" value={`${stats?.agentsOnline ?? 0}/${stats?.agentsTotal ?? 0}`} />
            <StatCard icon={Radar} label="Alerts triggered" value={String(stats?.alertsTriggered ?? 0)} delta="this week" trend="up" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* revenue chart */}
        <GlassCard>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-ink">Revenue</p>
              <p className="text-sm text-muted">Last 7 days</p>
            </div>
            {reportsLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="font-display text-xl font-semibold text-ink">
                {formatMoney(weeklyRevenue.reduce((s, d) => s + d.value, 0))}
              </p>
            )}
          </div>
          {reportsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <BarChart data={weeklyRevenue} format={formatMoney} />
          )}
        </GlassCard>

        {/* alerts triggered */}
        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Recent area alerts</p>
          <div className="mt-4 space-y-3">
            {triggeredLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-15 w-full rounded-2xl" />)
            ) : (
              triggered.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Radar className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.society}</p>
                    <p className="text-xs text-muted">by {t.agentName}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{t.sentCount}</span>
                </div>
              ))
            )}
          </div>
          <Link to="/admin/area-alerts" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-ink">
            Manage alerts <ArrowRight className="size-4" />
          </Link>
        </GlassCard>
      </div>

      {/* recent bookings */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Recent bookings</p>
          <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-ink">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Booking</th>
                <th className="px-2 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Agent</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookingsLoading && <SkeletonTableRows rows={5} cols={6} />}
              {!bookingsLoading && recent.map((b) => (
                <tr key={b.id} className="border-t border-line/70">
                  <td className="px-2 py-3">
                    <p className="font-medium text-ink">{b.vehicleName}</p>
                    <p className="text-xs text-muted">#{b.id}</p>
                  </td>
                  <td className="px-2 py-3 text-ink-soft">{b.customerName}</td>
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
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
