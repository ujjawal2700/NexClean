import { cn } from "@shared/lib/utils";

type LogoProps = {
  /** "full" = mark + wordmark, "mark" = emblem only, "wordmark" = text only */
  variant?: "full" | "mark" | "wordmark";
  className?: string;
  /** show the "Car Wash Services" descriptor line under the wordmark */
  withTagline?: boolean;
};

/**
 * NexClean brand lockup — typographic stand-in built from the design system.
 * Drop the official logo at /public/logo.svg and swap <Mark/> when ready.
 */
function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-[0.7em] shadow-[var(--shadow-glow)]",
        "size-[2.2em] bg-gradient-to-br from-primary to-accent",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="size-[60%]" fill="none">
        <path
          d="M32 16c6.5 8 11 13.2 11 18.8A11 11 0 0 1 21 34.8C21 29.2 25.5 24 32 16Z"
          fill="#fff"
          fillOpacity="0.96"
        />
        <circle cx="28" cy="35" r="2.4" fill="#4F7CFF" fillOpacity="0.55" />
      </svg>
    </span>
  );
}

export function Logo({ variant = "full", className, withTagline = false }: LogoProps) {
  if (variant === "mark") {
    return <Mark className={className} />;
  }

  const wordmark = (
    <span className="font-display font-semibold italic leading-none tracking-tight">
      <span className="text-primary">nex</span>
      <span className="text-muted">clean</span>
    </span>
  );

  if (variant === "wordmark") {
    return <span className={cn("text-[1.6rem]", className)}>{wordmark}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-[0.55em] text-[1.5rem]", className)}>
      <Mark />
      <span className="flex flex-col">
        {wordmark}
        {withTagline && (
          <span className="mt-[0.15em] text-[0.32em] font-medium uppercase tracking-[0.42em] text-muted">
            Car Care Services
          </span>
        )}
      </span>
    </span>
  );
}
