import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, Navigation, ChevronRight } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs } from "../api/agent.api";
import { VEHICLE_LABEL, STATUS_LABEL, type JobStatus } from "../types";

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
};

export function Jobs() {
  const { data: jobs = [] } = useJobs();
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");

  const list = jobs.filter((j) =>
    filter === "all" ? true : filter === "completed" ? j.status === "completed" : j.status !== "completed",
  );

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink">Jobs</h1>

      <div className="mb-6 inline-flex gap-1 rounded-pill border border-line bg-surface/70 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted">No jobs here.</GlassCard>
      ) : (
        <div className="space-y-4">
          {list.map((j) => (
            <Link key={j.id} to={`/agent/jobs/${j.id}`} className="block">
              <GlassCard interactive className="flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <CarSilhouette type={j.vehicleType} uid={`job-${j.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold text-ink">{j.vehicleName}</p>
                    <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[j.status])}>
                      {STATUS_LABEL[j.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {j.customerName} · {j.packageName} · {VEHICLE_LABEL[j.vehicleType]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 text-primary" /> {formatDate(j.date)} · {j.slot}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-primary" /> {j.addressLabel}
                    </span>
                    <span className="hidden items-center gap-1.5 sm:flex">
                      <Navigation className="size-4 text-primary" /> {j.distanceKm} km
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-display text-lg font-semibold text-ink">{formatMoney(j.payout)}</p>
                  <ChevronRight className="size-5 text-muted" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
