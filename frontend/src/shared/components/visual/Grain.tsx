import { cn } from "@shared/lib/utils";

const NOISE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

/**
 * Fine film-grain overlay for a premium, tactile finish. Fixed, full-screen,
 * non-interactive. Very low opacity so it reads as texture, not noise.
 */
export function Grain({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-multiply", className)}
      style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundSize: "160px" }}
      aria-hidden
    />
  );
}
