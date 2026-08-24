import { useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Navigation,
  Phone,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
  Eye,
  ShieldAlert,
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
import { JobNavigationCard } from "../components/JobNavigationCard";

type PhotoKind = "before" | "after";

const MANDATORY_COUNT = 4;
const MAX_COUNT = 8;

const SUGGESTED_SLOTS = [
  "1. Front View",
  "2. Rear View",
  "3. Left Side",
  "4. Right Side",
  "5. Interior Front",
  "6. Interior Rear",
  "7. Wheels / Rims",
  "8. Extra / Detail",
];

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: jobs = [] } = useJobs();
  const advance = useAdvanceJob();
  const jobPhoto = useJobPhoto();
  const job = jobs.find((j) => j.id === id);

  const [uploadingKind, setUploadingKind] = useState<PhotoKind | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [advanceError, setAdvanceError] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const beforeFileInputRef = useRef<HTMLInputElement>(null);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

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

  const beforePhotos = job.beforePhotos || [];
  const afterPhotos = job.afterPhotos || [];

  const beforeCount = beforePhotos.length;
  const afterCount = afterPhotos.length;

  const stepIndex = STATUS_FLOW.indexOf(job.status);
  const action = NEXT_ACTION[job.status];

  // Gating requirements
  const needsBeforePhotos = job.status === "arrived" && beforeCount < MANDATORY_COUNT && !job.hasBefore;
  const needsAfterPhotos = job.status === "in_progress" && afterCount < MANDATORY_COUNT && !job.hasAfter;
  const isButtonDisabled =
    needsBeforePhotos ||
    needsAfterPhotos ||
    uploadingKind !== null ||
    advance.isPending;

  const triggerUpload = (kind: PhotoKind) => {
    setUploadError("");
    if (kind === "before") {
      beforeFileInputRef.current?.click();
    } else {
      afterFileInputRef.current?.click();
    }
  };

  const handleFilePicked = async (kind: PhotoKind, file?: File) => {
    if (!file || !job) return;
    const currentCount = kind === "before" ? beforeCount : afterCount;
    if (currentCount >= MAX_COUNT) {
      setUploadError(`Maximum ${MAX_COUNT} ${kind} photos allowed.`);
      return;
    }

    setUploadingKind(kind);
    setUploadError("");

    try {
      const image = await fileToCompressedDataUri(file, 1400, 0.75);
      await jobPhoto.mutateAsync({ id: job.id, kind, image, action: "add" });
    } catch (e) {
      setUploadError(
        e instanceof ApiError
          ? e.message
          : "Photo upload failed. Check your connection and try again.",
      );
    } finally {
      setUploadingKind(null);
      if (kind === "before" && beforeFileInputRef.current) beforeFileInputRef.current.value = "";
      if (kind === "after" && afterFileInputRef.current) afterFileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async (kind: PhotoKind, index: number) => {
    if (!job) return;
    try {
      await jobPhoto.mutateAsync({ id: job.id, kind, action: "remove", index });
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : "Could not remove photo.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/agent/jobs")}>
        <ArrowLeft className="size-4" /> All jobs
      </Button>

      {/* Header */}
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

      {/* Status progress */}
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

      {/* Live navigation */}
      {job.status !== "completed" && (
        <JobNavigationCard
          jobId={job.id}
          status={job.status}
          fallbackAddress={job.addressLine}
          initialDestination={job.coordinates}
        />
      )}

      {/* Customer + location */}
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{job.addressLabel}</p>
                  {job.coordinates && (
                    <span
                      className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"
                      data-testid="job-coordinates-badge"
                    >
                      <Navigation className="size-2.5" />
                      {job.coordinates.lat.toFixed(5)}, {job.coordinates.lng.toFixed(5)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted break-words">{job.addressLine}</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <a
                href={
                  job.coordinates
                    ? `https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.addressLine)}`
                }
                target="_blank"
                rel="noreferrer"
                data-testid="job-direct-navigate"
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

      {/* ── BEFORE PHOTOS SECTION (When arrived or in progress or completed) ── */}
      {(job.status === "arrived" || job.status === "in_progress" || job.status === "completed") && (
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-semibold text-ink">Before Wash Photos</p>
              <p className="text-sm text-muted">
                {MANDATORY_COUNT} mandatory photos required before starting wash (Max {MAX_COUNT} photos).
              </p>
            </div>
            <span
              className={cn(
                "rounded-pill px-3 py-1 text-xs font-semibold",
                beforeCount >= MANDATORY_COUNT
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600",
              )}
            >
              {Math.min(beforeCount, MANDATORY_COUNT)}/{MANDATORY_COUNT} Mandatory ({beforeCount}/{MAX_COUNT} Total)
            </span>
          </div>

          <PhotoGrid
            kind="before"
            photos={beforePhotos}
            isEditable={job.status === "arrived" || job.status === "in_progress"}
            uploading={uploadingKind === "before"}
            onAdd={() => triggerUpload("before")}
            onRemove={(i) => void handleRemovePhoto("before", i)}
            onView={(url) => setLightbox({ url, label: "Before Photo" })}
          />
        </GlassCard>
      )}

      {/* ── AFTER PHOTOS SECTION (When in progress or completed) ── */}
      {(job.status === "in_progress" || job.status === "completed") && (
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-semibold text-ink">After Wash Photos</p>
              <p className="text-sm text-muted">
                {MANDATORY_COUNT} mandatory photos required to mark complete (Max {MAX_COUNT} photos).
              </p>
            </div>
            <span
              className={cn(
                "rounded-pill px-3 py-1 text-xs font-semibold",
                afterCount >= MANDATORY_COUNT
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600",
              )}
            >
              {Math.min(afterCount, MANDATORY_COUNT)}/{MANDATORY_COUNT} Mandatory ({afterCount}/{MAX_COUNT} Total)
            </span>
          </div>

          <PhotoGrid
            kind="after"
            photos={afterPhotos}
            isEditable={job.status === "in_progress"}
            uploading={uploadingKind === "after"}
            onAdd={() => triggerUpload("after")}
            onRemove={(i) => void handleRemovePhoto("after", i)}
            onView={(url) => setLightbox({ url, label: "After Photo" })}
          />
        </GlassCard>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Area alert */}
      {(job.status === "arrived" || job.status === "in_progress") && (
        <AreaAlertCard society={job.society} />
      )}

      {/* Primary action bar */}
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
            disabled={isButtonDisabled}
            onClick={() => {
              setAdvanceError("");
              advance.mutate(job.id, {
                onError: (e) =>
                  setAdvanceError(e instanceof ApiError ? e.message : "Couldn't update the job — try again"),
              });
            }}
          >
            {advance.isPending ? <Loader2 className="size-4 animate-spin" /> : action}
          </Button>

          {needsBeforePhotos && (
            <p className="mt-2 text-center text-xs font-medium text-amber-600">
              Upload {MANDATORY_COUNT - beforeCount} more mandatory before photo(s) to start cleaning.
            </p>
          )}

          {needsAfterPhotos && (
            <p className="mt-2 text-center text-xs font-medium text-amber-600">
              Upload {MANDATORY_COUNT - afterCount} more mandatory after photo(s) to mark complete.
            </p>
          )}

          {advanceError && <p className="mt-2 text-center text-xs text-red-600">{advanceError}</p>}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {lightbox && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="absolute right-5 top-5 grid size-10 place-items-center rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer"
            >
              <X className="size-5" />
            </button>
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>
      {/* Hidden file inputs for photo capture */}
      <input
        ref={beforeFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="upload-before-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFilePicked("before", file);
        }}
      />
      <input
        ref={afterFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="upload-after-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFilePicked("after", file);
        }}
      />
    </div>
  );
}

function PhotoGrid({
  kind,
  photos,
  isEditable,
  uploading,
  onAdd,
  onRemove,
  onView,
}: {
  kind: PhotoKind;
  photos: string[];
  isEditable: boolean;
  uploading: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onView: (url: string) => void;
}) {
  const count = photos.length;
  // Always render slots: first 4 mandatory slots + any uploaded optional slots + 1 add button if < 8
  const slotsCount = Math.max(MANDATORY_COUNT, Math.min(count + (isEditable ? 1 : 0), MAX_COUNT));
  const slots = Array.from({ length: slotsCount });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {slots.map((_, i) => {
        const photoUrl = photos[i];
        const isMandatory = i < MANDATORY_COUNT;
        const slotLabel = SUGGESTED_SLOTS[i] || `Photo ${i + 1}`;

        if (photoUrl) {
          return (
            <div
              key={i}
              className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <img
                src={photoUrl}
                alt={`${kind} ${i + 1}`}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute left-2 top-2 rounded-pill bg-ink/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                #{i + 1} {isMandatory ? "Mandatory" : "Optional"}
              </span>

              {/* Action overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onView(photoUrl)}
                  className="grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white cursor-pointer"
                  title="View full image"
                >
                  <Eye className="size-4" />
                </button>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="grid size-8 place-items-center rounded-full bg-red-600 text-white shadow hover:bg-red-700 cursor-pointer"
                    title="Delete photo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        }

        // Upload Slot
        if (!isEditable) {
          return null;
        }

        return (
          <button
            key={i}
            type="button"
            onClick={onAdd}
            disabled={uploading}
            className={cn(
              "relative grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed p-2 text-center transition-all cursor-pointer",
              isMandatory
                ? "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                : "border-line bg-surface hover:border-primary/40",
            )}
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <div>
                <Camera className={cn("mx-auto size-5", isMandatory ? "text-primary" : "text-muted")} />
                <p className="mt-1 text-xs font-semibold text-ink">{slotLabel}</p>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded-pill px-1.5 py-0.2 text-[9px] font-bold uppercase",
                    isMandatory ? "bg-primary/15 text-primary" : "bg-surface-muted text-muted",
                  )}
                >
                  {isMandatory ? "Required" : "Optional"}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
