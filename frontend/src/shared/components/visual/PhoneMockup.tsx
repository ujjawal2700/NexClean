import { type ReactNode } from "react";
import { cn } from "@shared/lib/utils";

/**
 * Reusable phone frame. Pass screen content as children.
 * Used by real-time tracking and the mobile app showcase.
 */
export function PhoneMockup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19] w-[260px] rounded-[2.5rem] border border-line bg-ink p-2.5 shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {/* notch */}
      <div className="absolute left-1/2 top-3 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-bg">
        {children}
      </div>
    </div>
  );
}
