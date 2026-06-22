import { useEffect } from "react";
import { Bell, CalendarCheck, Radar, Info } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/utils";
import { useNotifications } from "../api/queries";
import { useMarkNotificationsRead } from "../api/mutations";
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
  const { data: items = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Mark everything read once when the inbox is opened.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl text-ink">Notifications</h1>

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
            return (
              <GlassCard key={n.id} className={cn("flex items-start gap-4", !n.read && "ring-1 ring-primary/20")}>
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
