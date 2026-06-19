import { useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Navigation,
  Phone,
  Camera,
  Check,
  CheckCircle2,
  ImageIcon,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import { useJobs, useAdvanceJob, useJobPhoto } from "../api/agent.api";
import {
  VEHICLE_LABEL,
  STATUS_FLOW,
  STATUS_LABEL,
  NEXT_ACTION,
  type JobStatus,
} from "../types";
import { AreaAlertCard } from "../components/AreaAlertCard";

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: jobs = [] } = useJobs();
  const advance = useAdvanceJob();
  const jobPhoto = useJobPhoto();
  const job = jobs.find((j) => j.id === id);

  const [previews, setPreviews] = useState<{ before?: string; after?: string }>({});

  if (!job) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Job not found.</p>
        <Button asChild className="mt-4">
          <Link to="/agent/jobs">Back to jobs</Link>
        </Button>
      </div>
    );
  }

  const stepIndex = STATUS_FLOW.indexOf(job.status);
  const needsPhotos = job.status === "in_progress" && !(job.hasBefore && job.hasAfter);
  const action = NEXT_ACTION[job.status];

  const onPhoto = (kind: "before" | "after", file?: File) => {
    if (!file) return;
    setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    jobPhoto.mutate({ id: job.id, kind });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/agent/jobs")}>
        <ArrowLeft className="size-4" /> All jobs
      </Button>

      {/* header */}
      <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="w-28 shrink-0">
          <CarSilhouette type={job.vehicleType} uid={`detail-${job.id}`} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{job.vehicleName}</h1>
            <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {STATUS_LABEL[job.status]}
            </span>
          </div>
          <p className="text-sm text-muted">
            {job.packageName} · {VEHICLE_LABEL[job.vehicleType]} · #{job.id}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Your payout</p>
          <p className="font-display text-2xl font-semibold text-ink">{formatMoney(job.payout)}</p>
        </div>
      </GlassCard>

      {/* status progress */}
      <GlassCard>
        <ol className="flex items-center gap-2">
          {STATUS_FLOW.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 sm:flex-row">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      done && "bg-primary text-white",
                      active && "bg-primary/10 text-primary ring-2 ring-primary/30",
                      !done && !active && "bg-surface-muted text-muted",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("hidden text-xs font-medium sm:inline", active ? "text-ink" : "text-muted")}>
                    {STATUS_LABEL[s as JobStatus]}
                  </span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-line")} />
                )}
              </li>
            );
          })}
        </ol>
      </GlassCard>

      {/* customer + location */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 font-display font-semibold text-primary">
              {job.customerName.split(" ").map((n) => n[0]).join("")}
            </span>
            <div>
              <p className="font-display font-semibold text-ink">{job.customerName}</p>
              <p className="text-sm text-muted">Customer</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Phone className="size-4" /> Call
          </Button>
        </div>

        <div className="rounded-2xl border border-line bg-surface-muted/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-ink">{job.addressLabel}</p>
                <p className="text-sm text-muted">{job.addressLine}</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.addressLine)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="size-4" /> Navigate
              </a>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-primary" /> {job.slot}
            </span>
            <span className="flex items-center gap-1.5">
              <Navigation className="size-4 text-primary" /> {job.distanceKm} km away
            </span>
          </div>
        </div>
      </GlassCard>

      {/* photos — shown once on the way / cleaning */}
      {job.status !== "assigned" && (
        <GlassCard>
          <p className="font-display text-lg font-semibold text-ink">Before &amp; after</p>
          <p className="mt-1 text-sm text-muted">
            Capture photos to document your work. Both are required to complete the job.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <PhotoTile
              label="Before"
              done={job.hasBefore}
              preview={previews.before}
              onPick={(f) => onPhoto("before", f)}
            />
            <PhotoTile
              label="After"
              done={job.hasAfter}
              preview={previews.after}
              onPick={(f) => onPhoto("after", f)}
            />
          </div>
        </GlassCard>
      )}

      {/* area alert while servicing */}
      {(job.status === "arrived" || job.status === "in_progress") && (
        <AreaAlertCard society={job.society} />
      )}

      {/* primary action */}
      {job.status === "completed" ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-card border border-emerald-500/30 bg-emerald-50/60 p-5 text-emerald-700"
        >
          <CheckCircle2 className="size-6" />
          <div>
            <p className="font-display font-semibold">Job completed</p>
            <p className="text-sm">{formatMoney(job.payout)} added to your earnings.</p>
          </div>
        </motion.div>
      ) : (
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <Button
            className="w-full"
            size="lg"
            disabled={needsPhotos || advance.isPending}
            onClick={() => advance.mutate(job.id)}
          >
            {action}
          </Button>
          {needsPhotos && (
            <p className="mt-2 text-center text-xs text-muted">
              Add both before &amp; after photos to mark complete.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  label,
  done,
  preview,
  onPick,
}: {
  label: string;
  done: boolean;
  preview?: string;
  onPick: (file?: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={cn(
        "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
        done ? "border-primary/40 bg-primary/5" : "border-line bg-surface hover:border-primary/40",
      )}
    >
      {preview ? (
        <img src={preview} alt={`${label} preview`} className="absolute inset-0 size-full object-cover" />
      ) : done ? (
        <div className="text-center text-primary">
          <ImageIcon className="mx-auto size-6" />
          <p className="mt-1 text-xs font-medium">{label} uploaded</p>
        </div>
      ) : (
        <div className="text-center text-muted">
          <Camera className="mx-auto size-6" />
          <p className="mt-1 text-xs font-medium">Add {label.toLowerCase()} photo</p>
        </div>
      )}
      {(done || preview) && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white">
          <Check className="size-3.5" />
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </button>
  );
}
