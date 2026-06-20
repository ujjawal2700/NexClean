import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useCustomers } from "../api/admin.api";

export function Customers() {
  const { data: customers = [] } = useCustomers();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const q = query.toLowerCase();
  const list = customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Customers</h1>
          <p className="mt-1 text-muted">{customers.length} registered · manage and review activity.</p>
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
      </div>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Phone</th>
              <th className="px-2 py-2 font-medium">Joined</th>
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 text-right font-medium">Bookings</th>
              <th className="px-2 py-2 text-right font-medium">Total spend</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
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
                <td className="px-2 py-3 text-ink-soft capitalize">{c.activePlan ?? "—"}</td>
                <td className="px-2 py-3 text-right text-ink-soft">{c.totalBookings}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(c.totalSpend)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-12 text-center text-muted">
                  No customers match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
