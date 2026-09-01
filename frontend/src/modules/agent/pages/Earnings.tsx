import { useNavigate, Link } from "react-router-dom";
import { Wallet, TrendingUp, CheckCircle2, Briefcase, ArrowLeft, ArrowRight } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton, SkeletonStatCards } from "@shared/ui/Skeleton";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs, useSummary } from "../api/agent.api";

export function Earnings() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: summary, isLoading: summaryLoading } = useSummary();
  const completed = jobs.filter((j) => j.status === "completed");
  const isLoading = jobsLoading || summaryLoading;

  const total = completed.reduce((s, j) => s + j.payout, 0);

  const stats = [
    { icon: Wallet, label: "Total earned", value: formatMoney(total) },
    { icon: TrendingUp, label: "Today", value: formatMoney(summary?.earnedToday ?? 0) },
    { icon: CheckCircle2, label: "Jobs done", value: String(completed.length) },
    { icon: Briefcase, label: "Jobs today", value: String(summary?.jobsToday ?? 0) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Earnings</h1>
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5">
        <div>
          <p className="font-display font-semibold text-ink">Ready to cash out?</p>
          <p className="mt-0.5 text-sm text-muted">Request a payout of what you've earned to your bank account.</p>
        </div>
        <Link to="/agent/payouts">
          <Button size="sm">
            <Wallet className="size-4" /> Payouts <ArrowRight className="size-4" />
          </Button>
        </Link>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <SkeletonStatCards count={4} />
        ) : (
          stats.map((s) => (
            <GlassCard key={s.label} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:size-11">
                <s.icon className="size-4 sm:size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-ink sm:text-xl">{s.value}</p>
                <p className="text-[11px] leading-tight text-muted sm:text-xs">{s.label}</p>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">Payout history</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <GlassCard key={i} className="flex items-center gap-4">
                <Skeleton className="h-16 w-20 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </GlassCard>
            ))}
          </div>
        ) : completed.length === 0 ? (
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
