import { type LucideIcon } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { cn } from "@shared/lib/utils";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
};

export function StatCard({ icon: Icon, label, value, delta, trend }: StatCardProps) {
  return (
    <GlassCard className="flex items-start justify-between">
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
      <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
    </GlassCard>
  );
}
