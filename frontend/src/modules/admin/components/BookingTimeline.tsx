import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Car,
  CheckCircle2,
  Clock,
  Hand,
  History,
  Inbox,
  MapPin,
  Search,
  Send,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TimerOff,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatDate, formatTime } from "@shared/lib/format";
import type { BookingTimelineEntry, BookingTimelineEventType } from "../types";

type Tone = "neutral" | "info" | "good" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  info: "bg-primary/10 text-primary",
  good: "bg-emerald-500/10 text-emerald-600",
  warn: "bg-amber-500/15 text-amber-600",
  bad: "bg-red-500/10 text-red-600",
};

const EVENT: Record<BookingTimelineEventType, { icon: LucideIcon; tone: Tone; title: string }> = {
  created: { icon: CalendarPlus, tone: "info", title: "Booking placed" },
  searching: { icon: Search, tone: "neutral", title: "Searching for a cleaner" },
  offered: { icon: Send, tone: "info", title: "Offered to" },
  declined: { icon: ThumbsDown, tone: "warn", title: "Declined by" },
  offer_expired: { icon: TimerOff, tone: "warn", title: "No response from" },
  accepted: { icon: ThumbsUp, tone: "good", title: "Accepted by" },
  claimed: { icon: Hand, tone: "good", title: "Picked from open jobs by" },
  assigned: { icon: UserCheck, tone: "good", title: "Assigned by admin to" },
  auto_assigned: { icon: UserCheck, tone: "good", title: "Auto-assigned to" },
  admin_queue: { icon: Inbox, tone: "warn", title: "Moved to the admin queue" },
  released: { icon: AlertTriangle, tone: "bad", title: "Can't go — job given back by" },
  enroute: { icon: Car, tone: "info", title: "On the way" },
  arrived: { icon: MapPin, tone: "info", title: "Arrived at the location" },
  started: { icon: Sparkles, tone: "info", title: "Wash started" },
  completed: { icon: CheckCircle2, tone: "good", title: "Wash completed" },
  rescheduled: { icon: CalendarClock, tone: "neutral", title: "Rescheduled" },
  cancelled: { icon: XCircle, tone: "bad", title: "Booking cancelled" },
  reviewed: { icon: Star, tone: "good", title: "Customer rated" },
};

/** Events whose title ends with the cleaner's name ("Offered to <name>"). */
const NAMES_AGENT = new Set<BookingTimelineEventType>([
  "offered",
  "declined",
  "offer_expired",
  "accepted",
  "claimed",
  "assigned",
  "auto_assigned",
  "released",
  "reviewed",
]);

const ACTOR_LABEL = { customer: "Customer", agent: "Cleaner", admin: "Admin", system: "System" } as const;

function when(iso: string | null): string {
  if (!iso) return "Time not recorded";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/** Deep link to the cleaner's admin profile. */
function AgentLink({ agent }: { agent: { id: string; name: string } }) {
  return (
    <Link
      to={`/admin/agents/${agent.id}`}
      className="font-semibold text-primary underline-offset-2 hover:underline"
      data-testid="timeline-agent-link">
      {agent.name}
    </Link>
  );
}

function Details({ entry }: { entry: BookingTimelineEntry }) {
  const m = entry.meta ?? {};
  const bits: string[] = [];
  if (entry.type === "offered" && typeof m.distanceM === "number") {
    bits.push(m.distanceM >= 1000 ? `${(m.distanceM / 1000).toFixed(1)} km away` : `${m.distanceM} m away`);
  }
  if (entry.type === "rescheduled" && m.toSlot) {
    const from = m.fromDate ? `${formatDate(String(m.fromDate))} · ${m.fromSlot ?? ""}` : String(m.fromSlot ?? "—");
    const to = m.toDate ? `${formatDate(String(m.toDate))} · ${m.toSlot}` : String(m.toSlot);
    bits.push(`${from} → ${to}`);
    if (typeof m.feePaid === "number" && m.feePaid > 0) bits.push(`₹${m.feePaid} paid for the move`);
    if (m.waived) bits.push("upgrade fee waived");
  }
  if (entry.type === "created" && m.slot) {
    bits.push(`For ${m.date ? formatDate(String(m.date)) : ""} · ${m.slot}`);
  }
  if (entry.type === "released" && m.jobStatus && m.jobStatus !== "assigned") {
    bits.push(`Was ${String(m.jobStatus).replace("enroute", "on the way")} when they gave it back`);
  }
  if (entry.type === "assigned" && m.replacedAgentId) bits.push("Replaced the previous cleaner");
  if (entry.type === "reviewed" && typeof m.rating === "number") bits.push(`${"★".repeat(m.rating)}${"☆".repeat(5 - m.rating)} ${m.rating}/5`);
  if (bits.length === 0) return null;
  return <p className="mt-0.5 text-xs text-muted">{bits.join(" · ")}</p>;
}

/**
 * The whole life of a booking, oldest first: who it was offered to, who
 * declined or didn't answer, who accepted, any cleaner who gave it back and
 * why, reschedules, and completion or cancellation.
 */
export function BookingTimeline({ entries }: { entries: BookingTimelineEntry[] }) {
  const count = (t: BookingTimelineEventType) => entries.filter((e) => e.type === t).length;
  const stats = [
    { label: "Offers sent", value: count("offered") },
    { label: "Declined", value: count("declined") },
    { label: "No response", value: count("offer_expired") },
    { label: "Gave back", value: count("released") },
  ];
  const derived = entries.some((e) => e.derived);

  return (
    <GlassCard data-testid="booking-timeline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <History className="size-4 text-primary" />
          Booking timeline
        </p>
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <span
              key={s.label}
              className={cn(
                "rounded-pill px-2.5 py-1 text-xs font-medium",
                s.value > 0 && s.label !== "Offers sent" ? "bg-amber-500/15 text-amber-700" : "bg-surface-muted text-ink-soft",
              )}>
              {s.label}: <span className="font-semibold">{s.value}</span>
            </span>
          ))}
        </div>
      </div>

      {derived && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted/60 px-3 py-2 text-xs text-ink-soft">
          <Clock className="mt-px size-3.5 shrink-0" />
          This booking was made before full tracking was switched on, so this history is rebuilt from what was saved
          at the time. Individual offers aren't available and declines have no time.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No history recorded for this booking.</p>
      ) : (
        <ol className="relative mt-5 space-y-5 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-line">
          {entries.map((e) => {
            const cfg = EVENT[e.type] ?? { icon: Clock, tone: "neutral" as Tone, title: e.type };
            const Icon = cfg.icon;
            return (
              <li key={e.id} className="relative flex gap-3" data-testid={`timeline-${e.type}`}>
                <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-surface", TONE[cfg.tone])}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {cfg.title}
                      {NAMES_AGENT.has(e.type) && e.agent && (
                        <>
                          {" "}
                          <AgentLink agent={e.agent} />
                        </>
                      )}
                    </p>
                    <time className="shrink-0 text-xs text-muted" dateTime={e.at ?? undefined}>
                      {when(e.at)}
                    </time>
                  </div>
                  {e.actor !== "system" && !NAMES_AGENT.has(e.type) && (
                    <p className="mt-0.5 text-xs text-muted">
                      By {ACTOR_LABEL[e.actor]}
                      {e.actorName && ` · ${e.actorName}`}
                      {e.agent && !["created", "rescheduled"].includes(e.type) && (
                        <>
                          {" · cleaner "}
                          <AgentLink agent={e.agent} />
                        </>
                      )}
                    </p>
                  )}
                  {(e.type === "assigned" || e.type === "auto_assigned") && e.actor === "admin" && e.actorName && (
                    <p className="mt-0.5 text-xs text-muted">By {e.actorName}</p>
                  )}
                  <Details entry={e} />
                  {e.reason &&
                    (e.type === "released" ? (
                      <div
                        className="mt-2 rounded-xl border border-red-500/25 bg-red-50/70 px-3 py-2 text-sm text-red-800"
                        data-testid="timeline-release-reason">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-red-600">
                          Reason they can't go
                        </span>
                        “{e.reason}”
                      </div>
                    ) : e.type === "reviewed" ? (
                      <p className="mt-1 text-sm italic text-ink-soft">“{e.reason}”</p>
                    ) : (
                      <p className="mt-1 text-xs text-ink-soft">{e.reason}</p>
                    ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </GlassCard>
  );
}
