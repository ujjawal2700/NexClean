import { motion } from "motion/react";
import { Phone, Star, Navigation2, WifiOff, CheckCircle2, Sparkles, MapPin } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { formatDistance } from "@shared/lib/maps";
import type { JobStatus, TrackingSnapshot } from "@shared/types/tracking";

/**
 * The journey, as the customer experiences it. Deliberately four steps rather
 * than the five the backend tracks — "assigned" and "enroute" are the same
 * thing from the pavement, and splitting them adds a step that never visibly
 * completes.
 */
const STEPS: { key: JobStatus[]; label: string; blurb: string }[] = [
  { key: ["assigned", "enroute"], label: "On the way", blurb: "Your cleaner is heading to your pin" },
  { key: ["arrived"], label: "Arrived", blurb: "They're at your location" },
  { key: ["in_progress"], label: "Cleaning", blurb: "Your car is being cleaned" },
  { key: ["completed"], label: "Done", blurb: "Service complete" },
];

const HEADLINE: Record<JobStatus, string> = {
  assigned: "Your cleaner is on the way",
  enroute: "Your cleaner is on the way",
  arrived: "Your cleaner has arrived",
  in_progress: "Cleaning in progress",
  completed: "All done — your car is sparkling",
};

function stepIndex(status: JobStatus): number {
  const i = STEPS.findIndex((s) => s.key.includes(status));
  return i < 0 ? 0 : i;
}

/**
 * The bottom sheet on the live tracking screen: who is coming, how far away
 * they are, and how to reach them.
 */
export function AgentPanel({
  snapshot,
  etaMinutes,
  distanceM,
  stale,
}: {
  snapshot: TrackingSnapshot;
  etaMinutes: number | null;
  distanceM: number | null;
  stale: boolean;
}) {
  const status = snapshot.jobStatus;
  const active = stepIndex(status);
  const agent = snapshot.agent;
  const travelling = status === "assigned" || status === "enroute";

  return (
    <div className="px-5 pb-8 pt-4">
      {/* Headline + the number the whole screen exists to deliver. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <motion.h2
            key={status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-xl font-semibold leading-tight text-ink"
            data-testid="tracking-headline"
          >
            {HEADLINE[status]}
          </motion.h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {snapshot.addressLabel}
              {snapshot.society ? ` · ${snapshot.society}` : ""}
            </span>
          </p>
        </div>

        {travelling && etaMinutes != null && (
          <div className="shrink-0 rounded-2xl bg-ink px-3.5 py-2 text-center text-white">
            <p className="font-display text-xl font-semibold leading-none tabular-nums" data-testid="eta-minutes">
              {etaMinutes}
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider opacity-70">min</p>
          </div>
        )}
      </div>

      {travelling && distanceM != null && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary"
          data-testid="tracking-distance"
        >
          <Navigation2 className="size-3.5" />
          {formatDistance(distanceM)} away
          {stale && (
            <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
              <WifiOff className="size-3" /> updating…
            </span>
          )}
        </p>
      )}

      {/* Progress rail */}
      <div className="mt-5 flex items-center gap-1.5" role="list" aria-label="Service progress">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex-1" role="listitem">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div
                className={cn("h-full rounded-full", i <= active ? "bg-primary" : "bg-transparent")}
                initial={{ width: 0 }}
                animate={{ width: i <= active ? "100%" : 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 text-[10px] font-semibold uppercase tracking-wide",
                i <= active ? "text-ink" : "text-muted/70",
              )}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{STEPS[active].blurb}</p>

      {/* Who's coming */}
      {agent && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-semibold text-primary">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink" data-testid="tracking-agent-name">
              {agent.name}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-0.5">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {agent.rating ? agent.rating.toFixed(1) : "New"}
              </span>
              <span aria-hidden>·</span>
              <span>{agent.jobsDone} washes</span>
            </p>
          </div>
          {agent.phone && (
            <a
              href={`tel:${agent.phone}`}
              aria-label={`Call ${agent.name}`}
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-soft transition-transform active:scale-95"
            >
              <Phone className="size-5" />
            </a>
          )}
        </div>
      )}

      {/* What they're doing */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-muted/60 p-3">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium text-ink">{snapshot.packageName}</p>
          <p className="truncate text-xs text-muted">
            {snapshot.vehicleName} · {snapshot.slot}
          </p>
        </div>
        {status === "completed" && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
      </div>
    </div>
  );
}
