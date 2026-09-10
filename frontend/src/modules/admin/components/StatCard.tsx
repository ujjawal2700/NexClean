import { type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@shared/ui/GlassCard";
import { cn } from "@shared/lib/utils";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  /**
   * Where the tile drills through to. Omit and the card renders as plain,
   * non-interactive text — several screens (Reports, Plans, Payments) use these
   * purely as readouts with no matching detail page to open.
   */
  to?: string;
};

export function StatCard({ icon: Icon, label, value, delta, trend, to }: StatCardProps) {
  const body = (
    <GlassCard
      // `interactive` only when the tile actually goes somewhere — a hover lift
      // on a dead tile promises a click that does nothing.
      interactive={!!to}
      className={cn("flex h-full items-start justify-between", to && "cursor-pointer")}
    >
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
        {delta && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              trend === "down" ? "text-red-500" : "text-emerald-600",
            )}
          >
            {trend === "down" ? "▼" : "▲"} {delta}
          </p>
        )}
      </div>
      <span
        className={cn(
          "grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors",
          to && "group-hover:bg-primary group-hover:text-white",
        )}
      >
        <Icon className="size-5" />
      </span>
    </GlassCard>
  );

  if (!to) return body;

  return (
    <Link
      to={to}
      // The label already names the destination ("Active bookings" → bookings),
      // so an aria-label just repeats it; the group class drives the icon's
      // hover state from anywhere on the card.
      className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {body}
    </Link>
  );
}
