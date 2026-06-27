import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useCustomers, usePlans } from "../api/admin.api";
import { CUSTOMER_STATUS_STYLE } from "../lib/status";
import type { CustomerStatus } from "../types";

const STATUS_FILTERS: { id: CustomerStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
];

export function Customers() {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: plans = [] } = usePlans();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");

  const planLabel = (planId: string | null) => {
    if (!planId) return "—";
    return plans.find((p) => p.id === planId)?.name ?? planId;
  };

  const planFilters = [{ id: "all", label: "All" }, { id: "none", label: "None" }, ...plans.map((p) => ({ id: p.id, label: p.name }))];

  const q = query.toLowerCase();
  const list = customers.filter((c) => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesPlan = planFilter === "all" || (planFilter === "none" ? !c.activePlan : c.activePlan === planFilter);
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    return matchesStatus && matchesPlan && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Customers</h1>
        <p className="mt-1 text-muted">{customers.length} registered · manage and review activity.</p>
      </div>

      <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-5">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Status</p>
            <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                    statusFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Plan</p>
            <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
              {planFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPlanFilter(f.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                    planFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search customers…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Phone</th>
              <th className="px-2 py-2 font-medium">Joined</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 text-right font-medium">Bookings</th>
              <th className="px-2 py-2 text-right font-medium">Total spend</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows rows={6} cols={7} />}
            {!isLoading && list.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/customers/${c.id}`)}
                className="cursor-pointer border-t border-line/70 transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{c.email || "No email"}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{c.phone}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(c.joinedAt)}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", CUSTOMER_STATUS_STYLE[c.status])}>
                    {c.status}
                  </span>
                </td>
                <td className="px-2 py-3 text-ink-soft">{planLabel(c.activePlan)}</td>
                <td className="px-2 py-3 text-right text-ink-soft">{c.totalBookings}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(c.totalSpend)}</td>
              </tr>
            ))}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-12 text-center text-muted">
                  No customers match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
