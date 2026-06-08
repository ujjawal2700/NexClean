import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@shared/lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /** subtle interactive lift on hover */
  interactive?: boolean;
};

/**
 * Frosted surface card — the workhorse container across all modules.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass rounded-card p-6 shadow-[var(--shadow-soft)]",
        interactive &&
          "transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] " +
            "hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
