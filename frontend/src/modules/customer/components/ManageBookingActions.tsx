import { Loader2, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@shared/lib/utils";

/**
 * Change or cancel a booking that hasn't started yet. Shown everywhere an
 * upcoming booking is — the tracking screen a booking opens on and the
 * dashboard — not only in the bookings list, so a customer never lands on a
 * scheduled job with no way to edit it.
 *
 * The server has the final word on both (a cleaner already on the way, a
 * subscription wash inside its 12-hour window); its reason is shown by the
 * reschedule dialog and the cancel sheet.
 */
export function ManageBookingActions({
  canReschedule,
  canCancel,
  onReschedule,
  onCancel,
  cancelling,
  className,
}: {
  canReschedule: boolean;
  canCancel: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  cancelling?: boolean;
  className?: string;
}) {
  if (!canReschedule && !canCancel) return null;
  return (
    <div className={cn("grid gap-2", canReschedule && canCancel ? "grid-cols-2" : "grid-cols-1", className)}>
      {canReschedule && (
        <button
          type="button"
          onClick={onReschedule}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary"
          data-testid="manage-reschedule"
        >
          <RefreshCw className="size-4" /> Reschedule
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-500/5 disabled:opacity-60"
          data-testid="manage-cancel"
        >
          {cancelling ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Cancel booking
        </button>
      )}
    </div>
  );
}

/**
 * Mirrors the server's guards: a booking moves only until the cleaner sets
 * off (reschedule.service), and cancels until cleaning starts (cancelBooking).
 */
export function bookingManageRules(b: { status: string; jobStatus?: string | null }) {
  const upcoming = b.status === "upcoming";
  const js = b.jobStatus ?? "";
  return {
    canReschedule: upcoming && (js === "" || js === "assigned"),
    canCancel: upcoming && js !== "in_progress" && js !== "completed",
  };
}
