import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Clock, Navigation, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs } from "../api/agent.api";
import { VEHICLE_LABEL, STATUS_LABEL, isActiveJob, type JobStatus } from "../types";

const FILTERS: { id: "active" | "completed" | "all"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

const STATUS_STYLES: Record<JobStatus, string> = {
  assigned: "bg-primary/10 text-primary",
  enroute: "bg-amber-500/10 text-amber-600",
  arrived: "bg-amber-500/10 text-amber-600",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-red-500/10 text-red-600",
};

export function Jobs() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useJobs();
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");

  const list = jobs.filter((j) =>
    filter === "all" ? true : filter === "completed" ? j.status === "completed" : isActiveJob(j),
  );

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Jobs</h1>
      </div>

      <div className="mb-3 inline-flex gap-1 rounded-pill border border-line bg-surface/70 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-pill min-h-10 px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonListCards count={4} />
      ) : list.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted">No jobs here.</GlassCard>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {list.map((j) => (
            <Link key={j.id} to={`/agent/jobs/${j.id}`} className="block">
              <GlassCard interactive className="h-full p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0 sm:w-20">
                    <CarSilhouette type={j.vehicleType} uid={`job-${j.id}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-ink [overflow-wrap:anywhere]">{j.vehicleName}</p>
                    <p className="mt-0.5 text-xs text-muted">{j.packageName} · {VEHICLE_LABEL[j.vehicleType]}</p>
                    <p className="mt-1 truncate text-xs text-ink-soft">{j.customerName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-semibold text-ink">{formatMoney(j.payout)}</p>
                    <span className={cn("mt-1 inline-block rounded-pill px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[j.status])}>
                      {STATUS_LABEL[j.status]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5 text-xs text-ink-soft">
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5 shrink-0 text-primary" /> {formatDate(j.date)} · {j.slot}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0 text-primary" /><span className="truncate">{j.addressLabel}</span>
                      <span className="hidden items-center gap-1 sm:flex"><Navigation className="size-3.5" />{j.distanceKm != null ? `${j.distanceKm} km` : "Nearby"}</span>
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
