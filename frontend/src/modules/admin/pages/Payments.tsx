import { useState } from "react";
import { IndianRupee, RotateCcw, Wallet, CheckCircle2, Undo2, Search } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePayments, usePaymentStats, useRefundPayment, useSettlePayment } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { PAYMENT_STATUS_STYLE, PAYMENT_STATUS_LABEL, SETTLEMENT_STATUS_STYLE } from "../lib/status";

const isWithinDays = (dateStr: string | Date, days: number) => {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date.getTime() >= cutoff.getTime();
};

const isToday = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const isYesterday = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

export function Payments() {
  const { data: payments = [] } = usePayments();
  const { data: stats } = usePaymentStats();
  const refund = useRefundPayment();
  const settle = useSettlePayment();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Distinct agent names for the select filter dropdown
  const agentsList = Array.from(
    new Set(
      payments
        .map((p) => p.agentName)
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    )
  ).sort();

  const q = query.toLowerCase();
  const filteredList = payments.filter((p) => {
    // 1. Search Query Match
    const matchesSearch =
      !q ||
      p.customerName.toLowerCase().includes(q) ||
      (p.agentName && p.agentName.toLowerCase().includes(q)) ||
      p.orderId.toLowerCase().includes(q) ||
      p.society.toLowerCase().includes(q) ||
      p.amount.toString().includes(q);

    // 2. Status Match
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;

    // 3. Agent Match
    const matchesAgent = agentFilter === "all" || p.agentName === agentFilter;

    // 4. Date Range Match
    let matchesDate = true;
    if (dateFilter !== "all") {
      if (dateFilter === "today") {
        matchesDate = isToday(p.createdAt);
      } else if (dateFilter === "yesterday") {
        matchesDate = isYesterday(p.createdAt);
      } else if (dateFilter === "7days") {
        matchesDate = isWithinDays(p.createdAt, 7);
      } else if (dateFilter === "30days") {
        matchesDate = isWithinDays(p.createdAt, 30);
      }
    }

    return matchesSearch && matchesStatus && matchesAgent && matchesDate;
  });

  // Sorting
  const list = [...filteredList].sort((a, b) => {
    if (sortBy === "date-desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === "date-asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === "amount-desc") {
      return b.amount - a.amount;
    }
    if (sortBy === "amount-asc") {
      return a.amount - b.amount;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Payments</h1>
          <p className="mt-1 text-muted">{payments.length} transactions · refunds and agent settlement.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total collected" value={formatMoney(stats?.totalCollected ?? 0)} />
        <StatCard icon={Undo2} label="Total refunded" value={formatMoney(stats?.totalRefunded ?? 0)} />
        <StatCard icon={Wallet} label="Pending settlement" value={formatMoney(stats?.pendingSettlement ?? 0)} />
        <StatCard icon={CheckCircle2} label="Settled to agents" value={formatMoney(stats?.settledAmount ?? 0)} />
      </div>

      {/* Filters and Sorting Controls */}
      <GlassCard className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 bg-surface/50 border-line/50 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Search</label>
          <Input
            name="search"
            placeholder="Order, customer, agent, amount…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="mock">Mock</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Agent</label>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer"
          >
            <option value="all">All Agents</option>
            {agentsList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Date Range</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4 xl:col-span-1">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer"
          >
            <option value="date-desc">Date: Newest First</option>
            <option value="date-asc">Date: Oldest First</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="amount-asc">Amount: Low to High</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Order</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Settlement</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{p.orderId}</p>
                  <p className="text-xs text-muted">{p.society || "—"}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{p.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{p.agentName ?? "—"}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYMENT_STATUS_STYLE[p.status])}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                  {p.status === "refunded" && (
                    <p className="mt-1 text-xs text-muted">{formatMoney(p.refundAmount)} refunded</p>
                  )}
                </td>
                <td className="px-2 py-3">
                  {p.status === "paid" ? (
                    <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", SETTLEMENT_STATUS_STYLE[p.settlementStatus])}>
                      {p.settlementStatus}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(p.amount)}</td>
                <td className="px-2 py-3 text-right">
                  {p.status === "paid" && (
                    <div className="flex justify-end gap-1.5">
                      {p.settlementStatus === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={settle.isPending}
                          onClick={() => settle.mutate(p.id)}
                        >
                          <Wallet className="size-4" /> Settle
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={refund.isPending}
                        onClick={() => refund.mutate({ id: p.id })}
                      >
                        <RotateCcw className="size-4" /> Refund
                      </Button>
                    </div>
                  )}
                  {p.status !== "paid" && <span className="text-xs text-muted">—</span>}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-12 text-center text-muted">
                  No payments match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
