import { Loader2 } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { ScheduleSheet } from "./ScheduleSheet";

/**
 * Confirmation before a customer cancels. Cancelling used to fire on a single
 * tap with no warning and, from the bookings list, no word when it failed.
 */
export function CancelBookingSheet({
  title,
  detail,
  onConfirm,
  onClose,
  pending,
  error,
}: {
  /** e.g. "Express Wash" */
  title: string;
  /** e.g. "Sat, 3 Oct · 09:30 AM" */
  detail?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <ScheduleSheet
      title="Cancel this booking?"
      subtitle={detail ? `${title} · ${detail}` : title}
      error={error}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-12 sm:flex-1" onClick={onClose} disabled={pending}>
            Keep booking
          </Button>
          <Button
            className="min-h-12 bg-none bg-red-600 hover:bg-red-700 sm:flex-1"
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-cancel-booking"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Yes, cancel it
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-ink-soft">
        <p>Your cleaner will be told straight away and won&apos;t come.</p>
        <p>
          Anything you paid online goes back to your original payment method, and coins you used go back to your
          wallet, once our team reviews the refund. Bank refunds usually take 5–7 working days to show up.
        </p>
      </div>
    </ScheduleSheet>
  );
}
