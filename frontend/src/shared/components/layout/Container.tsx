import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/utils";

/**
 * Centered max-width content wrapper with responsive gutters.
 */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-6 md:px-10", className)} {...props} />
  );
}
