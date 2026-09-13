import { useState } from "react";
import { IndianRupee, RotateCcw, Wallet, CheckCircle2, Undo2, Search, Eye, TrendingUp, FileSpreadsheet } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate, chartDayLabel } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import { usePagination } from "@shared/lib/usePagination";
import { usePayments, usePaymentStats, useSettlePayment, useAgents, useReports, useBookings } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/BarChart";
import { PaymentDetailModal } from "../components/PaymentDetailModal";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";
import type { AdminPayment } from "../types";
import {
  PAYMENT_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_ORDER,
  SETTLEMENT_STATUS_STYLE,
} from "../lib/status";

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
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    date.getDate() === y.getDate() &&
    date.getMonth() === y.getMonth() &&
    date.getFullYear() === y.getFullYear()
  );
};

export function Payments() {
  const { data: rawPayments = [] } = usePayments();
  const { data: agents = [] } = useAgents();
  const { data: stats } = usePaymentStats();
  const { data: reports } = useReports();
  const { data: bookings = [] } = useBookings();
  const settle = useSettlePayment();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  /**
   * Filter options come from the agents directory, not from the payment rows.
   *
   * Deriving them from `rawPayments` meant a cleaner only appeared in the
   * dropdown once they already had a payment in the list — so newly added
   * agents, and anyone whose payments fell outside the 200-row window the API
   * returns, were simply missing from the filter. Sorted by name so the list is
   * scannable regardless of the order the API happens to return.
   */
  const agentOptions = [...agents]
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Payments still awaiting a cleaner are worth isolating: pay-to-cleaner rows
  // start life unassigned, so this is the queue an admin actually chases.
  const hasUnassigned = rawPayments.some((p) => !p.agentId);

  const list = rawPayments
    .filter((p) => {
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.orderId.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        (p.agentName && p.agentName.toLowerCase().includes(q)) ||
        (p.society && p.society.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;

      const matchesAgent =
        agentFilter === "all" ||
        (agentFilter === "unassigned" ? !p.agentId : p.agentId === agentFilter);

      let matchesDate = true;
      if (dateFilter === "today") matchesDate = isToday(p.createdAt);
      else if (dateFilter === "yesterday") matchesDate = isYesterday(p.createdAt);
      else if (dateFilter === "7days") matchesDate = isWithinDays(p.createdAt, 7);
      else if (dateFilter === "30days") matchesDate = isWithinDays(p.createdAt, 30);

      return matchesQuery && matchesStatus && matchesAgent && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "date-asc")
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "amount-desc") return b.amount - a.amount;
      if (sortBy === "amount-asc") return a.amount - b.amount;
      return 0;
    });

  const paginated = usePagination(list, 10);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = list.filter((p) => {
      const created = new Date(p.createdAt);
      if (range.from && created < range.from) return false;
      if (range.to && created > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((p) => ({
        "Order ID": p.orderId,
        "Payment ID": p.paymentId ?? "",
        Customer: p.customerName,
        Agent: p.agentName ?? "",
        Society: p.society,
        Date: formatDate(p.createdAt),
        Status: PAYMENT_STATUS_LABEL[p.status],
        Settlement: p.status === "paid" ? p.settlementStatus : "",
        "Amount (₹)": p.amount,
        "Refund Amount (₹)": p.refundAmount,
      })),
      `nexclean-payments-${new Date().toISOString().slice(0, 10)}`,
      "Payments",
    );
  };

  return (
    <div className="space-y-6">
      {showExportModal && (
        <ExportDateRangeModal
          title="Export Payments"
          description="Choose a date range to export, or leave blank to export every payment currently matching your filters."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Payments & Settlement</h1>
          <p className="mt-1 text-muted">
            Review transactions, agent payouts & process refunds.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportModal(true)}
          disabled={list.length === 0}
          className="shrink-0"
        >
          <FileSpreadsheet className="size-4" /> Export Excel
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross collections"
            value={formatMoney(stats.totalCollected)}
            icon={IndianRupee}
          />
          <StatCard
            label="Refunds processed"
            value={formatMoney(stats.totalRefunded)}
            icon={Undo2}
          />
          <StatCard
            label="Agent payouts settled"
            value={formatMoney(stats.settledAmount)}
            icon={CheckCircle2}
          />
          <StatCard
            label="Pending settlement"
            value={formatMoney(stats.pendingSettlement)}
            icon={Wallet}
          />
        </div>
      )}

      {/* Revenue trend — lives here too, not just in Reports, so tracking the
          app's finances (collections, refunds, payouts, the trend behind them)
          never means leaving this section of the sidebar. */}
      {reports && (
        <GlassCard>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <p className="font-display text-lg font-semibold text-ink">Revenue trend</p>
          </div>
          <p className="text-sm text-muted">Last 30 days, completed bookings</p>
          <div className="mt-6">
            <BarChart
              data={reports.revenueTrend.map((d, i) => ({
                label: chartDayLabel(d.date, 5, i, reports.revenueTrend.length),
                value: d.revenue,
              }))}
              format={formatMoney}
            />
          </div>
        </GlassCard>
      )}

      {/* Filter Bar */}
      <GlassCard className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4 xl:col-span-1">
          <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Search</label>
          <Input
            name="search"
            placeholder="Order ID, Customer, Agent…"
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
            {/* Built from the status map rather than hand-listed: the hardcoded
                list had drifted, offering a "Pending" value no payment ever has
                (the statuses are created/paid/mock/refunded) while omitting
                "created" entirely — so that option always returned an empty
                table, and unpaid bookings could not be filtered for at all. */}
            <option value="all">All Statuses</option>
            {PAYMENT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>
            ))}
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
            {hasUnassigned && <option value="unassigned">Unassigned</option>}
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
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

        <div className="flex flex-col gap-1.5">
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
            {paginated.pageItems.map((p) => (
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
                  {p.status === "paid" && p.bookingStatus === "cancelled" && (
                    <p className="mt-1 text-xs font-medium text-amber-600">Refund owed</p>
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
                  <div className="flex justify-end gap-1.5">
                    {p.status === "paid" && p.settlementStatus === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={settle.isPending}
                        onClick={() => settle.mutate(p.id)}
                      >
                        <Wallet className="size-4" /> Settle
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPayment(p)}>
                      {p.status === "paid" ? <RotateCcw className="size-4" /> : <Eye className="size-4" />}
                      {p.status === "paid" ? "Refund" : "View"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.pageItems.length === 0 && (
              <tr className="border-t border-line/70">
                <td colSpan={8} className="px-2 py-8 text-center text-sm text-muted">
                  No payments match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          onPageChange={paginated.setPage}
        />
      </GlassCard>

      {selectedPayment && (
        <PaymentDetailModal
          // Re-resolved against the live list on every render (not the stale
          // snapshot captured on click) so a refund/settle inside the modal
          // updates it immediately instead of only after it's reopened.
          payment={rawPayments.find((p) => p.id === selectedPayment.id) ?? selectedPayment}
          booking={bookings.find((b) => b.id === selectedPayment.bookingId) ?? null}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
