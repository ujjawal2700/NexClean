import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, Radar, Info, ArrowLeft, BellRing, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/utils";
import { getPushToken, getNotificationPermission, saveDeviceToken } from "@shared/lib/push";
import { resolveNotificationPath } from "@shared/lib/notificationLink";
import { useNotifications } from "../api/queries";
import { useMarkNotificationsRead, useRegisterToken } from "../api/mutations";
import type { AppNotification } from "../types";

const ICON: Record<AppNotification["type"], typeof Bell> = {
  booking: CalendarCheck,
  area_alert: Radar,
  system: Info,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Notifications() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const registerToken = useRegisterToken();
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [enabling, setEnabling] = useState(false);

  // Mark everything read once when the inbox is opened.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enablePush = async () => {
    setEnabling(true);
    try {
      // requestPermission is what makes the browser actually prompt. Without
      // it this resolves to the synthetic fallback token and the button looks
      // like it worked while registering something FCM can never deliver to.
      const token = await getPushToken({ requestPermission: true });
      saveDeviceToken(token);
      await registerToken.mutateAsync(token);
      setPermission(getNotificationPermission());
    } catch {
      /* ignore */
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Notifications</h1>
        </div>
      </div>

      {permission !== "granted" && permission !== "unsupported" && (
        <GlassCard className="mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BellRing className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-display font-semibold text-ink">Enable OS Push Notifications</p>
              <p className="mt-1 text-xs text-muted">
                Receive instant alerts for cleaner assignments, arrival updates, and exclusive offers even when your app is backgrounded.
              </p>
              <Button size="sm" className="mt-3" onClick={enablePush} disabled={enabling}>
                {enabling ? "Enabling..." : "Enable Push Notifications"}
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {permission === "granted" && (
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="size-4" /> OS Push notifications active
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="flex items-start gap-4">
              <Skeleton className="size-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="py-16 text-center">
          <Bell className="mx-auto size-8 text-muted/50" />
          <p className="mt-3 text-muted">You're all caught up. No notifications yet.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const Icon = ICON[n.type];
            const path = resolveNotificationPath(n.data);
            return (
              <GlassCard
                key={n.id}
                onClick={path ? () => navigate(path) : undefined}
                className={cn(
                  "flex items-start gap-4",
                  !n.read && "ring-1 ring-primary/20",
                  path && "cursor-pointer transition-colors hover:bg-surface-muted/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-2xl",
                    n.type === "area_alert"
                      ? "bg-gradient-to-br from-primary to-accent text-white"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display font-semibold text-ink">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{n.body}</p>
                </div>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
