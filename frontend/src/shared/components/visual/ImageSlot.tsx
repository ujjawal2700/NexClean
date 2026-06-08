import { cn } from "@shared/lib/utils";

type ImageSlotProps = {
  /** drop a real asset path here later; until then a branded placeholder shows */
  src?: string;
  alt?: string;
  /** label shown on the placeholder so the client knows what goes here */
  label?: string;
  className?: string;
  rounded?: string;
};

/**
 * Branded media placeholder. Renders the image when `src` is provided,
 * otherwise a tasteful gradient slot indicating what asset belongs here.
 * Lets the whole landing page ship before real photography/video exists.
 */
export function ImageSlot({ src, alt = "", label, className, rounded = "rounded-card" }: ImageSlotProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("h-full w-full object-cover", rounded, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative grid h-full w-full place-items-center overflow-hidden border border-line/70",
        rounded,
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, #eef2fb 0%, #dfe8fb 45%, #d7ecfb 100%)",
      }}
      aria-hidden
    >
      <div className="bg-grid absolute inset-0 opacity-50" />
      <div
        className="absolute -right-10 -top-10 size-48 rounded-full opacity-50 blur-2xl"
        style={{ background: "radial-gradient(circle, #6EA8FF, transparent 70%)" }}
      />
      {label && (
        <span className="relative z-10 rounded-pill bg-surface/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted backdrop-blur">
          {label}
        </span>
      )}
    </div>
  );
}
