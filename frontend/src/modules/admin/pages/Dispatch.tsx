import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  Clock,
  MapPin,
  UserCheck,
  Wand2,
  AlertTriangle,
  Loader2,
  CalendarClock,
  ChevronDown,
  Navigation2,
} from "lucide-react";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useAdminSession } from "../store/sessionStore";
import {
  useDispatchQueue,
  useAssignableAgents,
  useAssignBooking,
  useAutoAssignBooking,
  useAutoAssignAll,
} from "../api/admin.api";
import type { DispatchQueueItem, DispatchStatus } from "../types";
import { TrackingModal } from "../components/TrackingModal";

const STATUS_STYLE: Record<DispatchStatus, string> = {
  pending_admin: "bg-red-500/10 text-red-600 border-red-500/20",
  offered: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  searching: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  scheduled: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  assigned: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-ink/5 text-muted border-line",
};

const STATUS_LABEL: Record<DispatchStatus, string> = {
  pending_admin: "Needs assignment",
  offered: "Offer out",
  searching: "Searching",
  scheduled: "Scheduled",
  assigned: "Assigned",
  in_progress: "In progress",
  cancelled: "Cancelled",
};

// Order the queue so the items needing a human come first.
const STATUS_RANK: Record<DispatchStatus, number> = {
  pending_admin: 0,
  offered: 1,
  searching: 2,
  scheduled: 3,
  in_progress: 4,
  assigned: 5,
  cancelled: 6,
};

export function Dispatch() {
  const { data: queue = [], isLoading } = useDispatchQueue();
  const autoAssignAll = useAutoAssignAll();
  const authenticated = useAdminSession((s) => s.authenticated);
  const qc = useQueryClient();

  // Live refresh: the backend emits on every dispatch state change.
  useEffect(() => {
    if (!authenticated) return;
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "admin" },
    });
    const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "dispatch"] });
    socket.on("dispatch_update", refresh);
    socket.on("dispatch_pending", refresh);
    return () => {
      socket.disconnect();
    };
  }, [authenticated, qc]);

  const sorted = useMemo(
    () =>
      [...queue].sort(
        (a, b) => STATUS_RANK[a.dispatchStatus] - STATUS_RANK[b.dispatchStatus] || +new Date(a.date) - +new Date(b.date),
      ),
    [queue],
  );

  const pendingCount = queue.filter((q) => q.dispatchStatus === "pending_admin").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl text-ink">
            <Radio className="size-7 text-primary" /> Dispatch
          </h1>
          <p className="mt-1 text-muted">
            Live view of jobs finding a cleaner. {pendingCount > 0 ? `${pendingCount} need manual assignment.` : "All flowing automatically."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => autoAssignAll.mutate()}
            disabled={autoAssignAll.isPending}
            className="bg-primary hover:bg-primary/90 text-white shadow-sm font-medium"
          >
            {autoAssignAll.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Auto-assign all
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{pendingCount} job{pendingCount > 1 ? "s" : ""} had no takers and are waiting for you to assign a cleaner.</span>
        </div>
      )}

      {isLoading ? (
        <GlassCard>
          <table className="w-full">
            <tbody>
              <SkeletonTableRows rows={4} cols={1} />
            </tbody>
          </table>
        </GlassCard>
      ) : sorted.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted">
          <Radio className="mx-auto mb-3 size-8 opacity-40" />
          Nothing in the dispatch queue right now. New bookings will appear here while they find a cleaner.
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {sorted.map((item) => (
            <DispatchRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DispatchRow({ item }: { item: DispatchQueueItem }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const needsAssignment = ["pending_admin", "searching", "offered", "scheduled"].includes(item.dispatchStatus);
  // Anything with a cleaner attached has a live position worth looking at.
  // Unassigned rows open too, so an admin can confirm the pin is where the
  // customer says it is before placing the job by hand.
  const trackable = item.dispatchStatus !== "cancelled";

  return (
    <GlassCard
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all",
        open && "relative z-30 shadow-xl border-primary/30",
        trackable && "cursor-pointer hover:border-primary/40",
      )}
      onClick={trackable ? () => setTracking(true) : undefined}
      role={trackable ? "button" : undefined}
      tabIndex={trackable ? 0 : undefined}
      onKeyDown={
        trackable
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setTracking(true);
              }
            }
          : undefined
      }
      data-testid={`dispatch-row-${item.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-pill border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[item.dispatchStatus])}>
            {STATUS_LABEL[item.dispatchStatus]}
          </span>
          {item.isSubscriptionWash && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600">
              <CalendarClock className="size-3" /> Subscription
            </span>
          )}
          {!item.hasLocation && needsAssignment && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
              <MapPin className="size-3" /> No location
            </span>
          )}
        </div>

        <p className="mt-2 font-display font-semibold text-ink">
          {item.vehicleName} · {item.packageName}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{item.customerName}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {formatDate(item.date)} · {item.slot}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {item.society || item.addressLine}
          </span>
        </div>

        <div className="mt-1.5 text-xs text-muted">
          {item.dispatchStatus === "offered" && item.currentOfferAgentName ? (
            <span>
              Offer out to <span className="font-medium text-ink">{item.currentOfferAgentName}</span>
              {item.offerExpiresAt && <OfferCountdown expiresAt={item.offerExpiresAt} />}
            </span>
          ) : item.dispatchStatus === "searching" ? (
            <span>Searching nearby cleaners · {item.dispatchAttempts} offer{item.dispatchAttempts === 1 ? "" : "s"} tried</span>
          ) : item.dispatchStatus === "scheduled" ? (
            <span>Will auto-assign the nearest cleaner before the slot</span>
          ) : item.dispatchStatus === "pending_admin" ? (
            <span className="text-red-500">No cleaner accepted after {item.dispatchAttempts} attempt{item.dispatchAttempts === 1 ? "" : "s"}</span>
          ) : (item.dispatchStatus === "assigned" || item.dispatchStatus === "in_progress") && item.agentName ? (
            <span className="flex items-center gap-1 text-emerald-600">
              <UserCheck className="size-3.5" />
              <span className="font-medium">{item.agentName}</span> is on this job
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="font-display font-semibold text-ink">{formatMoney(item.price)}</span>
        {trackable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTracking(true)}
            title="See the cleaner's live location"
            data-testid={`track-${item.id}`}
          >
            <Navigation2 className="size-4" />
            <span className="hidden sm:inline">Track</span>
          </Button>
        )}
        {needsAssignment && <AssignControls item={item} open={open} setOpen={setOpen} />}
      </div>

      {tracking && <TrackingModal bookingId={item.id} onClose={() => setTracking(false)} />}
    </GlassCard>
  );
}

function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((+new Date(expiresAt) - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((+new Date(expiresAt) - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="ml-1 tabular-nums text-amber-600">· {left}s left</span>;
}

function AssignControls({
  item,
  open,
  setOpen,
}: {
  item: DispatchQueueItem;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const assign = useAssignBooking();
  const autoAssign = useAutoAssignBooking();
  const { data: agents = [], isLoading } = useAssignableAgents(open ? item.id : null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpen]);

  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        title="Auto-assign the nearest available cleaner"
        disabled={autoAssign.isPending || !item.hasLocation}
        onClick={() => autoAssign.mutate(item.id)}
      >
        {autoAssign.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
        <span className="hidden sm:inline">Auto</span>
      </Button>
      <Button size="sm" onClick={() => setOpen((v) => !v)} disabled={assign.isPending}>
        <UserCheck className="size-4" /> Assign <ChevronDown className="size-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          {isLoading ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Finding cleaners…
            </p>
          ) : agents.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">No verified cleaners found.</p>
          ) : (
            agents.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  assign.mutate({ id: item.id, agentId: a.id });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{a.name}</span>
                  <span className="text-xs text-muted">
                    {a.distanceKm != null ? `${a.distanceKm} km` : a.area || "—"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-medium",
                    a.online ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/5 text-muted",
                  )}
                >
                  {a.online ? "online" : "offline"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
