import { cn } from "@shared/lib/utils";

type LogoProps = {
  /** "full" = the full lockup, "mark" = small square crop for tight spaces */
  variant?: "full" | "mark" | "wordmark";
  className?: string;
};

const LOGO_SRC = "/logo.png";

/** NexClean brand mark. Single source image at /public/logo.png, swap there to rebrand. */
export function Logo({ variant = "full", className }: LogoProps) {
  if (variant === "mark") {
    return (
      <img
        src={LOGO_SRC}
        alt="NexClean"
        className={cn("size-[2.2em] rounded-[0.5em] object-cover", className)}
      />
    );
  }

  return (
    <img src={LOGO_SRC} alt="NexClean" className={cn("h-[2.6em] w-auto object-contain", className)} />
  );
}
