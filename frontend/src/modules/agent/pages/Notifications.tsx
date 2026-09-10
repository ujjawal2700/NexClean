import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  BellOff,
  Briefcase,
  MapPin,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { formatDate, formatTime } from "@shared/lib/format";
import {
  getPushToken,
  getNotificationPermission,
  saveDeviceToken,
  isPushSupported,
} from "@shared/lib/push";
import {
  useAgentNotifications,
  useMarkAgentNotificationsRead,
  useRegisterToken,
} from "../api/agent.api";
import type { AgentNotification } from "../types";

const ICON: Record<AgentNotification["type"], typeof Bell> = {
  booking: Briefcase,
  area_alert: MapPin,
  system: Info,
};

const ICON_STYLE: Record<AgentNotification["type"], string> = {
  booking: "bg-primary/10 text-primary",
  area_alert: "bg-emerald-500/10 text-emerald-600",
  system: "bg-amber-500/10 text-amber-600",
};

/**
 * The cleaner's inbox.
 *
 * Job offers deliberately never land here — they expire in seconds and belong
 * in the popup, not a list you scroll later. What this holds is the durable
 * record: work assigned to you, jobs cancelled out from under you, and whether
 * your account got verified. Each of those has consequences after the moment it
 * happened, which is exactly what makes them worth storing.
 */
export function Notifications() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useAgentNotifications();
  const markRead = useMarkAgentNotificationsRead();
  const registerToken = useRegisterToken();

  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState("");

  // Opening the inbox is the act of reading it.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enablePush = async () => {
    setEnabling(true);
    setEnableError("");
    try {
      // requestPermission is what makes the browser actually prompt. Without
      // it this quietly resolves to a synthetic token that FCM can never
      // deliver to — the button would look like it worked and change nothing.
      const token = await getPushToken({ requestPermission: true });
      saveDeviceToken(token);
      await registerToken.mutateAsync(token);

      const next = getNotificationPermission();
      setPermission(next);
      if (next !== "granted") {
        setEnableError(
          "Notifications are still blocked. Allow them for this site in your browser settings, then try again.",
        );
      }
    } catch {
      setEnableError("Couldn't turn on notifications. Try again in a moment.");
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl text-ink">Notifications</h1>
          <p className="text-sm text-muted">Job assignments, cancellations and account updates.</p>
        </div>
      </div>

      {/* Push opt-in. Only shown when it can change something — no point
          offering it on a browser that can't do push, or when it's already on. */}
      {isPushSupported() && permission !== "granted" && (
        <GlassCard className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
            <BellOff className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink">Turn on push notifications</p>
            <p className="mt-0.5 text-sm text-muted">
              Without this you'll only see new jobs while the app is open on screen.
            </p>
            {enableError && (
              <p className="mt-1.5 text-xs font-medium text-amber-600" data-testid="push-enable-error">
                {enableError}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={enablePush}
            disabled={enabling || permission === "denied"}
            data-testid="enable-push"
            className="shrink-0"
          >
            {enabling ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enabling…
              </>
            ) : (
              <>
                <BellRing className="size-4" /> Enable
              </>
            )}
          </Button>
        </GlassCard>
      )}

      {permission === "granted" && (
        <p
          className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700"
          data-testid="push-enabled"
        >
          <ShieldCheck className="size-4 shrink-0" />
          Push notifications are on for this device.
        </p>
      )}

      {isLoading ? (
        <SkeletonListCards count={4} />
      ) : items.length === 0 ? (
        <GlassCard className="py-16 text-center" data-testid="notifications-empty">
          <Bell className="mx-auto mb-3 size-8 text-muted opacity-40" />
          <p className="font-medium text-ink">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">
            You'll see a note here whenever a job is assigned to you, a booking is cancelled, or your
            account status changes.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/agent/jobs">View my jobs</Link>
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-3" data-testid="notifications-list">
          {items.map((n, i) => {
            const Icon = ICON[n.type] ?? Info;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
              >
                <GlassCard
                  className={cn(
                    "flex items-start gap-3.5",
                    // Unread keeps a marker even though opening the page marks
                    // everything read — the list is already rendered from the
                    // pre-read data, so this still reads correctly on arrival.
                    !n.read && "border-primary/30 bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-2xl",
                      ICON_STYLE[n.type] ?? ICON_STYLE.system,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display font-semibold text-ink">{n.title}</p>
                      {!n.read && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
