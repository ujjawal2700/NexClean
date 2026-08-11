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
  Loader2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { ApiError } from "@shared/lib/api";
import { fileToCompressedDataUri } from "@shared/lib/imageUtils";
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

type PhotoKind = "before" | "after";

/** Local upload state per photo slot, so a failure is visible and retryable. */
type PhotoState = { preview?: string; uploading?: boolean; error?: string; file?: File };

/** Turn an upload failure into something a cleaner on site can act on. */
function photoErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 413) return "Photo too large for the server — retry to send a smaller copy.";
    if (e.status === 401 || e.status === 403) return "Session expired — sign in again, then retry.";
    return e.message;
  }
  return "Upload failed — check your signal and tap to retry.";
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: jobs = [] } = useJobs();
  const advance = useAdvanceJob();
  const jobPhoto = useJobPhoto();
  const job = jobs.find((j) => j.id === id);

  const [photos, setPhotos] = useState<Record<PhotoKind, PhotoState>>({ before: {}, after: {} });
  const [advanceError, setAdvanceError] = useState("");

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
  const uploadingPhoto = Boolean(photos.before.uploading || photos.after.uploading);
  const failedPhoto =
    (Boolean(photos.before.error) && !job.hasBefore) || (Boolean(photos.after.error) && !job.hasAfter);

  // The completion gate reads job.hasBefore/hasAfter from the server, so a
  // failed upload used to strand the agent: the tile showed the local preview
  // with a tick, but nothing reached the API and "Mark complete" stayed
  // disabled with no explanation. Track and surface every failure instead.
  const onPhoto = async (kind: PhotoKind, file?: File, attempt = 0) => {
    if (!file) return;
    setPhotos((p) => ({
      ...p,
      [kind]: { preview: p[kind].preview ?? URL.createObjectURL(file), uploading: true, file },
    }));
    try {
      // Upload the actual image, not just the "a photo exists" flag — it's the
      // only evidence available if the customer later disputes the work.
      // Compressed first: a raw phone photo is several MB once base64-inflated,
      // which stalls on mobile data and trips upload size limits outright.
      // Each retry shrinks it further, so a marginal connection still gets through.
      const image = await fileToCompressedDataUri(file, attempt > 0 ? 1000 : 1600, attempt > 0 ? 0.6 : 0.8);
      await jobPhoto.mutateAsync({ id: job.id, kind, image });
      setPhotos((p) => ({ ...p, [kind]: { ...p[kind], uploading: false, error: undefined } }));
    } catch (e) {
      setPhotos((p) => ({
        ...p,
        [kind]: {
          ...p[kind],
          uploading: false,
          error: photoErrorMessage(e),
        },
      }));
    }
  };

  const retryPhoto = (kind: PhotoKind) => {
    const file = photos[kind].file;
    if (file) void onPhoto(kind, file, 1);
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
              <Navigation className="size-4 text-primary" /> {job.distanceKm != null ? `${job.distanceKm} km away` : "Nearby"}
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
              state={photos.before}
              onPick={(f) => onPhoto("before", f)}
              onRetry={() => retryPhoto("before")}
            />
            <PhotoTile
              label="After"
              done={job.hasAfter}
              state={photos.after}
              onPick={(f) => onPhoto("after", f)}
              onRetry={() => retryPhoto("after")}
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
            disabled={needsPhotos || uploadingPhoto || advance.isPending}
            onClick={() => {
              setAdvanceError("");
              advance.mutate(job.id, {
                onError: (e) =>
                  setAdvanceError(e instanceof ApiError ? e.message : "Couldn't update the job — try again"),
              });
            }}
          >
            {action}
          </Button>
          {needsPhotos && (
            <p className="mt-2 text-center text-xs text-muted">
              {uploadingPhoto
                ? "Uploading photos…"
                : failedPhoto
                  ? "A photo didn't upload. Tap the red tile to retry, then mark complete."
                  : "Add both before & after photos to mark complete."}
            </p>
          )}
          {advanceError && <p className="mt-2 text-center text-xs text-red-600">{advanceError}</p>}
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  label,
  done,
  state,
  onPick,
  onRetry,
}: {
  label: string;
  done: boolean;
  state: PhotoState;
  onPick: (file?: File) => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { preview, uploading, error } = state;
  // A tick means "the server has it" — never just "a file was picked".
  const failed = Boolean(error) && !done;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        // A failed upload retries the same photo rather than asking the agent to
        // shoot it again — the car may already have been driven away.
        onClick={() => (failed ? onRetry() : ref.current?.click())}
        disabled={uploading}
        className={cn(
          "relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          failed && "border-red-400/60 bg-red-50/60",
          !failed && done && "border-primary/40 bg-primary/5",
          !failed && !done && "border-line bg-surface hover:border-primary/40",
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

        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-ink/40 text-white">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
        {failed && !uploading && (
          <span className="absolute inset-0 grid place-items-center bg-ink/45 text-white">
            <span className="flex items-center gap-1.5 rounded-pill bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600">
              <RotateCcw className="size-3.5" /> Retry upload
            </span>
          </span>
        )}
        {done && !uploading && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white">
            <Check className="size-3.5" />
          </span>
        )}
      </button>

      {/* Sibling, not a child of the button: a nested interactive control is
          invalid markup and its programmatic .click() can be swallowed. */}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {failed && !uploading && (
        <p className="text-xs text-red-600">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => ref.current?.click()}
          >
            Take a new photo
          </button>
        </p>
      )}
    </div>
  );
}
