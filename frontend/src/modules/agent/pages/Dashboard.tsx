import { Link } from "react-router-dom";
import { ArrowRight, ListChecks, CheckCircle2, Wallet, TrendingUp, MapPin, Clock, Navigation, Zap, Loader2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton, SkeletonStatCards } from "@shared/ui/Skeleton";
import { greeting, formatMoney } from "@shared/lib/format";
import { useAgentMe, useJobs, useSummary, useAvailableJobs, useClaimJob } from "../api/agent.api";
import { VEHICLE_LABEL, STATUS_LABEL } from "../types";
import { AreaAlertCard } from "../components/AreaAlertCard";

export function Dashboard() {
  const { data: me, isLoading: meLoading } = useAgentMe();
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: summary, isLoading: summaryLoading } = useSummary();
  const { data: availableJobs = [] } = useAvailableJobs();
  const claimJob = useClaimJob();

  const active = jobs.find((j) => j.status !== "completed");

  const stats = [
    { icon: ListChecks, label: "Jobs today", value: String(summary?.jobsToday ?? 0) },
    { icon: CheckCircle2, label: "Completed", value: String(summary?.completedToday ?? 0) },
    { icon: Wallet, label: "Earned today", value: formatMoney(summary?.earnedToday ?? 0) },
    { icon: TrendingUp, label: "Potential", value: formatMoney(summary?.potentialToday ?? 0) },
  ];

  const isUnverified = me?.agentStatus !== "verified";

  return (
    <div className="space-y-8">
      {isUnverified && (
        <GlassCard className="border-red-300/40 bg-red-50/60 text-red-700 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-semibold text-lg">⚠️ KYC Verification Required</p>
            <p className="text-sm">Please submit your Aadhar and KYC documents to get verified and start receiving jobs.</p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/agent/signup">Submit KYC</Link>
          </Button>
        </GlassCard>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          {meLoading ? (
            <Skeleton className="mt-1 h-9 w-44" />
          ) : (
            <h1 className="text-2xl text-ink sm:text-3xl">{me?.name ?? "Specialist"} 👋</h1>
          )}
        </div>
      </div>

      {me && !me.online && (
        <GlassCard className="border-amber-300/40 bg-amber-50/60 text-amber-700">
          You're <span className="font-semibold">offline</span> — toggle online (top right) to receive new jobs.
        </GlassCard>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryLoading ? (
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
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">
          {jobsLoading ? "Current job" : active ? "Current job" : "You're all caught up"}
        </h2>
        {jobsLoading ? (
          <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Skeleton className="h-24 w-28 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </GlassCard>
        ) : active ? (
          <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="w-28 shrink-0">
              <CarSilhouette type={active.vehicleType} uid={`agdash-${active.id}`} />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold text-ink">{active.vehicleName}</p>
                <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {STATUS_LABEL[active.status]}
                </span>
              </div>
              <p className="text-sm text-muted">
                {active.customerName} · {active.packageName} · {VEHICLE_LABEL[active.vehicleType]}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" /> {active.slot}</span>
                <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" /> {active.addressLine}</span>
                <span className="flex items-center gap-1.5"><Navigation className="size-4 text-primary" /> {active.distanceKm != null ? `${active.distanceKm} km away` : "Nearby"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className="font-display text-xl font-semibold text-ink">{formatMoney(active.payout)}</p>
              {isUnverified ? (
                <Button size="sm" disabled>
                  Open <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link to={`/agent/jobs/${active.id}`}>Open <ArrowRight className="size-4" /></Link>
                </Button>
              )}
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="py-12 text-center">
            <p className="text-muted">No active jobs right now. Nice work! 🎉</p>
            {isUnverified ? (
              <Button variant="outline" className="mt-4" disabled>
                View all jobs
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/agent/jobs">View all jobs</Link>
              </Button>
            )}
          </GlassCard>
        )}
      </section>

      {/* ── Available Work Pool ──────────────────────────────── */}
      {!isUnverified && availableJobs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
              Available now
            </h2>
            <span className="ml-auto rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
              {availableJobs.length} open
            </span>
          </div>
          <div className="space-y-3">
            {availableJobs.map((j) => (
              <GlassCard key={j.id} className="flex items-center gap-3 p-4">
                <div className="w-16 shrink-0">
                  <CarSilhouette type={j.vehicleType} uid={`avail-${j.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">{j.vehicleName}</p>
                  <p className="text-xs text-muted">{j.packageName}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-soft">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-primary" />{j.slot}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 text-primary" />{j.addressLabel}
                    </span>
                    {j.distanceKm != null && (
                      <span className="flex items-center gap-1">
                        <Navigation className="size-3 text-primary" />{j.distanceKm} km
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="font-display text-base font-bold text-emerald-600">{formatMoney(j.payout)}</p>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3"
                    disabled={claimJob.isPending}
                    onClick={() => claimJob.mutate(j.id)}
                  >
                    {claimJob.isPending && claimJob.variables === j.id
                      ? <Loader2 className="size-3 animate-spin" />
                      : <><Zap className="size-3" /> Claim</>}
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {active && <AreaAlertCard society={active.society} />}
    </div>
  );
}
