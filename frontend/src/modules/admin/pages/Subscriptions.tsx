import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Users, CalendarClock, Receipt, Search, Info } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { Pagination } from "@shared/ui/Pagination";
import { useSubscriptionOverview } from "../api/admin.api";
import { StatCard } from "../components/StatCard";

type StatusFilter = "all" | "active" | "expired";

/** Admin → Subscribers: who has bought a plan, and what plans have earned. */
export function Subscriptions() {
  const { data, isLoading } = useSubscriptionOverview();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const subscribers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.subscribers ?? []).filter(
      (s) =>
        (status === "all" || s.status === status) &&
        (!q || s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.planName.toLowerCase().includes(q)),
    );
  }, [data, query, status]);

  const subscriberPages = usePagination(subscribers, 10);
  const purchasePages = usePagination(data?.recentPurchases ?? [], 10);

  if (isLoading || !data) return <p className="text-muted">Loading subscriptions…</p>;
  const { stats, byPlan, recentPurchases } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Subscribers</h1>
        <p className="mt-1 text-muted">Customers on a plan, and the revenue plans have brought in.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plan revenue (all time)" value={formatMoney(stats.totalRevenue)} icon={IndianRupee} />
        <StatCard label="Plan revenue this month" value={formatMoney(stats.revenueThisMonth)} icon={Receipt} />
        <StatCard label="Active subscribers" value={String(stats.activeSubscribers)} icon={Users} />
        <StatCard label="Plans ended, not renewed" value={String(stats.expiredSubscribers)} icon={CalendarClock} />
      </div>

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Revenue by plan</p>
        <table className="mt-4 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 text-right font-medium">Active subscribers</th>
              <th className="px-2 py-2 text-right font-medium">Purchases</th>
              <th className="px-2 py-2 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {byPlan.map((p) => (
              <tr key={p.planId} className="border-t border-line/70">
                <td className="px-2 py-3 font-medium text-ink">
                  {p.name}
                  {!p.active && <span className="ml-2 text-xs font-normal text-muted">(inactive)</span>}
                </td>
                <td className="px-2 py-3 text-right text-ink-soft">{p.activeSubscribers}</td>
                <td className="px-2 py-3 text-right text-ink-soft">{p.purchases}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Revenue counts completed plan payments, after any coins redeemed. Purchases made before plan payments were
          tracked aren&apos;t included.
        </p>
      </GlassCard>

      <GlassCard className="space-y-4 overflow-x-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-semibold text-ink">
            Subscribers <span className="text-sm font-normal text-muted">({subscribers.length})</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-64">
              <Input
                name="search"
                placeholder="Search name, phone or plan"
                leading={<Search className="size-4" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by status"
              className="h-12 cursor-pointer rounded-2xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Ended</option>
            </select>
          </div>
        </div>

        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 font-medium">Cycle</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Washes used</th>
              <th className="px-2 py-2 text-right font-medium">Total paid</th>
            </tr>
          </thead>
          <tbody>
            {subscriberPages.pageItems.map((s) => (
              <tr key={s.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <Link to={`/admin/customers/${s.id}`} className="font-medium text-ink hover:text-primary">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted">{s.phone}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{s.planName}</td>
                <td className="px-2 py-3 text-ink-soft">
                  {s.startDate ? formatDate(s.startDate) : "—"} → {s.endDate ? formatDate(s.endDate) : "—"}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-0.5 text-xs font-medium",
                      s.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700",
                    )}
                  >
                    {s.status === "active" ? "Active" : "Ended"}
                  </span>
                </td>
                <td className="px-2 py-3 text-right text-ink-soft">
                  {s.washesUsed} / {s.washesLimit === -1 ? "∞" : s.washesLimit}
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">
                  {s.totalPaid > 0 ? formatMoney(s.totalPaid) : "—"}
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-sm text-muted">
                  No subscribers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={subscriberPages.page}
          totalPages={subscriberPages.totalPages}
          onPageChange={subscriberPages.setPage}
        />
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Recent plan purchases</p>
        <table className="mt-4 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchasePages.pageItems.map((p) => (
              <tr key={p.id} className="border-t border-line/70">
                <td className="px-2 py-3 text-ink">{p.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{p.planName}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">
                  {formatMoney(p.amount)}
                  {p.status === "refunded" && <span className="ml-1.5 text-xs font-normal text-amber-700">refunded</span>}
                </td>
              </tr>
            ))}
            {recentPurchases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center text-sm text-muted">
                  No plan purchases recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={purchasePages.page} totalPages={purchasePages.totalPages} onPageChange={purchasePages.setPage} />
      </GlassCard>
    </div>
  );
}
