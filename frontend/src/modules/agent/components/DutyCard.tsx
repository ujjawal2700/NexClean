import { Link } from "react-router-dom";
import { BellOff, Loader2, Power } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { useOnlineSwitch } from "../hooks/useOnlineSwitch";
import { useAgentMe } from "../api/agent.api";

/**
 * The cleaner's on-duty switch, front and centre on Today. Online stays on
 * until they switch it off — closing or swiping the app away doesn't end it —
 * so the card says so plainly, and warns when this phone can't receive job
 * alerts with the app closed.
 */
export function DutyCard({ disabled }: { disabled?: boolean }) {
  const { online, pending, toggle } = useOnlineSwitch();
  const { data: me } = useAgentMe();
  // From the server: whether it holds a real push token for this cleaner —
  // what actually decides if an offer reaches a closed app. A guess from this
  // page's local storage can disagree with it.
  const pushOff = me?.pushReady === false;

  return (
    <GlassCard
      className={cn(
        "p-5 transition-colors",
        online ? "border-emerald-400/40 bg-emerald-50/60" : "border-amber-300/40 bg-amber-50/60",
      )}
      data-testid="duty-card"
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className={cn("font-display text-lg font-semibold", online ? "text-emerald-700" : "text-amber-700")}>
            {online ? "You're online" : "You're offline"}
          </p>
          <p className={cn("mt-1 text-sm leading-5", online ? "text-emerald-800/80" : "text-amber-800/80")}>
            {online
              ? "You'll get new job alerts even if you close the app. Go offline when you're done for the day."
              : "Go online to start getting new jobs nearby."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          aria-label={online ? "Go offline" : "Go online"}
          onClick={() => void toggle()}
          disabled={pending || disabled}
          data-testid="duty-switch"
          className={cn(
            "flex min-h-12 shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50",
            online ? "bg-ink hover:bg-ink/90" : "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
          {online ? "Go offline" : "Go online"}
        </button>
      </div>

      {online && pushOff && (
        <Link
          to="/agent/notifications"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-red-300/50 bg-red-50/80 p-3 text-sm text-red-700"
          data-testid="push-off-warning"
        >
          <BellOff className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Notifications are off on this phone.</span> You'll only get job alerts while the
            app is open. Tap to turn them on.
          </span>
        </Link>
      )}
    </GlassCard>
  );
}
