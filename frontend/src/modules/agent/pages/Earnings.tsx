import { useNavigate, Link } from "react-router-dom";
import { Wallet, TrendingUp, CheckCircle2, Briefcase, ArrowLeft, ArrowRight } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton } from "@shared/ui/Skeleton";
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Earnings</h1>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 bg-primary/5 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm text-ink-soft">Total earned</p>
            {isLoading ? <Skeleton className="mt-1 h-9 w-28" /> :
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{formatMoney(total)}</p>}
          </div>
          <Link to="/agent/payouts">
            <Button size="sm"><Wallet className="size-4" /> Payouts <ArrowRight className="size-4" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line/60 border-y border-line/60 py-3">
          {stats.slice(1).map((s) => (
            <div key={s.label} className="min-w-0 px-3 sm:px-5">
              <s.icon className="mb-1.5 size-4 text-primary" />
              {isLoading ? <Skeleton className="mb-1 h-5 w-12" /> :
                <p className="font-display text-lg font-semibold text-ink">{s.value}</p>}
              <p className="mt-0.5 text-[11px] text-muted sm:text-xs">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="px-4 py-2.5 text-xs text-muted sm:px-5">Request a payout of what you've earned to your bank account.</p>
      </GlassCard>

      <section>
        <h2 className="mb-2.5 font-display text-lg font-semibold text-ink">Earnings history</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <GlassCard key={i} className="flex items-center gap-3 p-3.5">
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
              <GlassCard key={j.id} className="flex items-center gap-3 p-3.5">
                <div className="w-14 shrink-0">
                  <CarSilhouette type={j.vehicleType} uid={`earn-${j.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">{j.vehicleName}</p>
                  <p className="text-xs text-muted">{j.customerName} · {formatDate(j.date)}</p>
                </div>
                <p className="shrink-0 font-display text-base font-semibold text-emerald-600">+{formatMoney(j.payout)}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
