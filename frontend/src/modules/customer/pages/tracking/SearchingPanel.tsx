import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Radar, ShieldCheck, Clock3, UserCog, AlertTriangle } from "lucide-react";
import { cn } from "@shared/lib/utils";
import type { TrackingSnapshot } from "@shared/types/tracking";

/** Copy that changes as the wait lengthens, so the screen never looks stuck. */
const REASSURANCE = [
  { after: 0, text: "Checking cleaners closest to your pin…" },
  { after: 20, text: "Widening the search to nearby areas…" },
  { after: 50, text: "Still looking — the nearest cleaners are finishing up." },
  { after: 90, text: "Almost there. We're offering your job to more cleaners." },
];

function elapsedLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * The "finding you a cleaner" state.
 *
 * Everything on it moves for a reason: a customer who cannot tell whether the
 * system is working assumes it isn't, and cancels. The elapsed clock, the
 * attempt counter and the widening radius are all real dispatch state pushed
 * from the server, not decorative animation.
 */
export function SearchingPanel({
  snapshot,
  onCancel,
  cancelling,
  cancelError,
}: {
  snapshot: TrackingSnapshot;
  onCancel: () => void;
  cancelling: boolean;
  /** Why a cancel was refused, when it was. */
  cancelError?: string;
}) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.round((Date.now() - new Date(snapshot.createdAt).getTime()) / 1000)),
  );

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const pendingAdmin = snapshot.dispatchStatus === "pending_admin";
  const message = pendingAdmin
    ? "Our dispatch team is placing this booking by hand."
    : [...REASSURANCE].reverse().find((r) => seconds >= r.after)?.text ?? REASSURANCE[0].text;

  const radiusKm = snapshot.searchRadiusM ? (snapshot.searchRadiusM / 1000).toFixed(0) : null;

  return (
    <div className="px-5 pb-8 pt-5">
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "relative mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl",
            pendingAdmin ? "bg-amber-500/12 text-amber-600" : "bg-primary/12 text-primary",
          )}
        >
          {pendingAdmin ? <UserCog className="size-5" /> : <Radar className="size-5" />}
          {!pendingAdmin && (
            <motion.span
              className="absolute inset-0 rounded-2xl border-2 border-primary/40"
              animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold leading-tight text-ink">
            {pendingAdmin ? "Priority assignment in progress" : "Finding the nearest cleaner"}
          </h2>
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-muted"
            data-testid="searching-message"
          >
            {message}
          </motion.p>
        </div>

        <span className="mt-1 shrink-0 rounded-lg bg-surface-muted px-2 py-1 font-mono text-xs font-semibold tabular-nums text-ink-soft">
          {elapsedLabel(seconds)}
        </span>
      </div>

      {/* Live dispatch telemetry — the proof that the search is really running. */}
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <Stat
          label="Cleaners asked"
          value={String(snapshot.dispatchAttempts ?? 0)}
          testId="dispatch-attempts"
        />
        <Stat label="Search radius" value={radiusKm ? `${radiusKm} km` : "—"} />
        <Stat
          label="Status"
          value={snapshot.dispatchStatus === "offered" ? "Offer out" : pendingAdmin ? "Manual" : "Searching"}
        />
      </div>

      <div className="mt-5 space-y-2.5 rounded-2xl border border-line bg-surface-muted/60 p-4">
        <Reassure icon={ShieldCheck} text="Every cleaner is ID-verified before they can accept." />
        <Reassure icon={Clock3} text="You'll see them on the map the second they accept." />
      </div>

      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
      >
        {cancelling && <Loader2 className="size-4 animate-spin" />}
        Cancel this booking
      </button>

      {cancelError && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700"
          data-testid="cancel-error"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {cancelError}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-2.5 py-2.5 text-center">
      <p className="font-display text-lg font-semibold tabular-nums text-ink" data-testid={testId}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Reassure({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <p className="flex items-start gap-2 text-xs text-ink-soft">
      <Icon className="mt-px size-3.5 shrink-0 text-primary" />
      {text}
    </p>
  );
}
