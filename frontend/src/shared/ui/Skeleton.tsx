import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";

/** Base shimmer block — compose with width/height classes for any shape. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-xl bg-surface-muted",
        "bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.85)_50%,transparent_70%)]",
        "bg-[length:200%_100%] motion-safe:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

/** One or more shimmer text lines; the last line is shorter when lines > 1. */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Stat-card grid placeholders — icon chip + value + label, matching StatCard/GlassCard layout. */
export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <GlassCard key={i} className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </GlassCard>
      ))}
    </>
  );
}

/** Table row placeholders — drop inside an existing <tbody>. */
export function SkeletonTableRows({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-line/70">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-2 py-3">
              <Skeleton className="h-4 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Stacked list-card placeholders — image/icon block + lines + trailing value, matching GlassCard list rows. */
export function SkeletonListCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <GlassCard key={i} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-16 w-24 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 self-start sm:self-center" />
        </GlassCard>
      ))}
    </div>
  );
}
