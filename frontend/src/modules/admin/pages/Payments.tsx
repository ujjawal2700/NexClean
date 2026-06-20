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

export function Payments() {
  const { data: payments = [] } = usePayments();
  const { data: stats } = usePaymentStats();
  const refund = useRefundPayment();
  const settle = useSettlePayment();
  const [query, setQuery] = useState("");

  const q = query.toLowerCase();
  const list = payments.filter(
    (p) =>
      !q ||
      p.customerName.toLowerCase().includes(q) ||
      p.orderId.toLowerCase().includes(q) ||
      p.society.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Payments</h1>
          <p className="mt-1 text-muted">{payments.length} transactions · refunds and agent settlement.</p>
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search payments…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total collected" value={formatMoney(stats?.totalCollected ?? 0)} />
        <StatCard icon={Undo2} label="Total refunded" value={formatMoney(stats?.totalRefunded ?? 0)} />
        <StatCard icon={Wallet} label="Pending settlement" value={formatMoney(stats?.pendingSettlement ?? 0)} />
        <StatCard icon={CheckCircle2} label="Settled to agents" value={formatMoney(stats?.settledAmount ?? 0)} />
      </div>

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
