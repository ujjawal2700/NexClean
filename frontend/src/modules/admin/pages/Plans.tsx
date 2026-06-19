import { Users, IndianRupee, Repeat } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatMoney } from "@shared/lib/format";
import { StatCard } from "../components/StatCard";
import { usePlans } from "../api/admin.api";

export function Plans() {
  const { data: plans = [] } = usePlans();
  const totalSubs = plans.reduce((s, p) => s + p.subscribers, 0);
  const mrr = plans.reduce((s, p) => s + p.subscribers * p.price, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Subscriptions</h1>
        <p className="mt-1 text-muted">Recurring revenue across all plans.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total subscribers" value={totalSubs.toLocaleString("en-IN")} />
        <StatCard icon={IndianRupee} label="Monthly recurring revenue" value={formatMoney(mrr)} delta="8.2%" trend="up" />
        <StatCard icon={Repeat} label="Active plans" value={String(plans.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => {
          const share = Math.round((p.subscribers / (totalSubs || 1)) * 100);
          return (
            <GlassCard key={p.id}>
              <div className="flex items-baseline justify-between">
                <p className="font-display text-xl font-semibold text-ink">{p.name}</p>
                <p className="font-display text-lg font-semibold text-primary">{formatMoney(p.price)}<span className="text-sm font-normal text-muted">/mo</span></p>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="font-display text-3xl font-semibold text-ink">{p.subscribers}</p>
                  <p className="text-sm text-muted">subscribers</p>
                </div>
                <p className="text-sm font-medium text-muted">{share}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-4 text-sm text-muted">
                Contributing <span className="font-medium text-ink">{formatMoney(p.subscribers * p.price)}</span> / month
              </p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
