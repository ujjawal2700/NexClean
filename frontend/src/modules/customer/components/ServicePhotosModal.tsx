import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Camera, Eye, ImageOff } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import type { Booking } from "../types";
import type { TrackingSnapshot } from "@shared/types/tracking";

export function ServicePhotosModal({
  booking,
  onClose,
}: {
  booking: Booking | TrackingSnapshot;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"before" | "after">("before");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const beforePhotos: string[] =
    booking.beforePhotos && booking.beforePhotos.length > 0
      ? booking.beforePhotos
      : booking.beforePhotoUrl
        ? [booking.beforePhotoUrl]
        : [];

  const afterPhotos: string[] =
    booking.afterPhotos && booking.afterPhotos.length > 0
      ? booking.afterPhotos
      : booking.afterPhotoUrl
        ? [booking.afterPhotoUrl]
        : [];

  const currentPhotos = activeTab === "before" ? beforePhotos : afterPhotos;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-photos-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Camera className="size-5" />
            </div>
            <div>
              <h2 id="service-photos-title" className="font-display text-lg font-semibold text-ink">
                Service Photos
              </h2>
              <p className="text-xs text-muted">
                {booking.vehicleName} · {booking.packageName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="mt-4 flex gap-2 rounded-2xl border border-line bg-surface-muted/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("before")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors cursor-pointer",
              activeTab === "before"
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            <span>Before Wash</span>
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 text-[10px]",
                activeTab === "before" ? "bg-primary/10 text-primary font-bold" : "bg-line text-muted",
              )}
            >
              {beforePhotos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("after")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors cursor-pointer",
              activeTab === "after"
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            <span>After Wash</span>
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 text-[10px]",
                activeTab === "after" ? "bg-emerald-500/10 text-emerald-600 font-bold" : "bg-line text-muted",
              )}
            >
              {afterPhotos.length}
            </span>
          </button>
        </div>

        {/* Photo Gallery Grid */}
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
          {currentPhotos.length === 0 ? (
            <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-line bg-surface-muted/30 text-center p-6">
              <div>
                <ImageOff className="mx-auto size-8 text-muted/60" />
                <p className="mt-2 text-sm font-medium text-ink">No {activeTab} photos uploaded</p>
                <p className="mt-1 text-xs text-muted">
                  The cleaner did not upload photos for this stage.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {currentPhotos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxUrl(url)}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-transform hover:scale-[1.02] cursor-pointer"
                >
                  <img
                    src={url}
                    alt={`${activeTab} photo ${idx + 1}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink shadow">
                      <Eye className="size-3.5" /> View
                    </span>
                  </div>
                  <span className="absolute bottom-2 left-2 rounded-pill bg-ink/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setLightboxUrl(null)}
              aria-label="Close"
              className="absolute right-5 top-5 grid size-10 place-items-center rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer"
            >
              <X className="size-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Full resolution proof"
              className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
