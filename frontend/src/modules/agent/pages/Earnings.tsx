import { Wallet, TrendingUp, CheckCircle2, Briefcase } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs, useSummary } from "../api/agent.api";

export function Earnings() {
  const { data: jobs = [] } = useJobs();
  const { data: summary } = useSummary();
  const completed = jobs.filter((j) => j.status === "completed");

  const total = completed.reduce((s, j) => s + j.payout, 0);

  const stats = [
    { icon: Wallet, label: "Total earned", value: formatMoney(total) },
    { icon: TrendingUp, label: "Today", value: formatMoney(summary?.earnedToday ?? 0) },
    { icon: CheckCircle2, label: "Jobs done", value: String(completed.length) },
    { icon: Briefcase, label: "Jobs today", value: String(summary?.jobsToday ?? 0) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-ink">Earnings</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <GlassCard key={s.label} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <s.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold text-ink">{s.value}</p>
              <p className="truncate text-xs text-muted">{s.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">Payout history</h2>
        {completed.length === 0 ? (
          <GlassCard className="py-12 text-center text-muted">No completed jobs yet.</GlassCard>
        ) : (
          <div className="space-y-3">
            {completed.map((j) => (
              <GlassCard key={j.id} className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <CarSilhouette type={j.vehicleType} uid={`earn-${j.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">{j.vehicleName}</p>
                  <p className="text-sm text-muted">{j.customerName} · {formatDate(j.date)}</p>
                </div>
                <p className="font-display text-lg font-semibold text-emerald-600">+{formatMoney(j.payout)}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
