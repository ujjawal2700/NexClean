import { Logo } from "@shared/components/brand/Logo";

/** Full-screen branded fallback while a lazily-loaded module is fetched. */
export function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <Logo variant="mark" className="text-[2rem] motion-safe:animate-pulse" />
        <span className="text-sm text-muted">Loading…</span>
      </div>
    </div>
  );
}
