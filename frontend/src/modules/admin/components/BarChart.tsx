import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";

type Bar = { label: string; value: number };

/** Premium CSS Bar Chart with fixed track height so percentage heights never collapse. */
export function BarChart({ data, format }: { data: Bar[]; format?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const hasData = max > 0;

  if (!hasData) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-2 text-muted">
        <TrendingUp className="size-8 opacity-30" />
        <p className="text-sm font-medium">No revenue recorded yet</p>
        <p className="text-xs opacity-60">Revenue trends appear here automatically as bookings occur</p>
      </div>
    );
  }

  return (
    <div className="flex h-52 items-end gap-1 sm:gap-2">
      {data.map((d, i) => {
        // Enforce a min height of 6% for non-zero values so small bars remain visible
        const rawPct = max > 0 ? (d.value / max) * 100 : 0;
        const pct = d.value > 0 ? Math.max(6, Math.round(rawPct)) : 0;

        return (
          <div key={`${d.label}-${i}`} className="group flex h-full flex-1 flex-col items-center justify-end min-w-0">
            {/* Top label / value */}
            <div className="mb-1 flex h-5 items-center justify-center">
              {d.value > 0 && (
                <span className="whitespace-nowrap text-[10px] font-bold text-primary transition-transform group-hover:scale-110">
                  {format ? format(d.value) : d.value}
                </span>
              )}
            </div>

            {/* Bar Track Container with explicit 144px (h-36) height */}
            <div className="relative flex h-36 w-full items-end justify-center rounded-t-lg bg-primary/5 p-0.5 border border-line/30">
              {pct > 0 ? (
                <motion.div
                  initial={{ height: "0%" }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.02, 0.3) }}
                  className="w-full rounded-t-md bg-gradient-to-t from-primary via-primary to-accent shadow-sm"
                />
              ) : (
                <div className="h-[2px] w-full rounded-full bg-line/50" />
              )}
            </div>

            {/* Bottom Label */}
            <span className="mt-2 text-[10px] font-medium text-muted truncate max-w-full text-center">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
