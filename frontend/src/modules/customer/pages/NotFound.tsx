import { useEffect } from "react";
import { ArrowLeft, Headphones, Home, SearchX } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";

/** Customer-friendly fallback for unknown public and /app routes. */
export function CustomerNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const insideCustomerApp = location.pathname === "/app" || location.pathname.startsWith("/app/");

  useEffect(() => {
    document.title = "Page not found | NexClean";
  }, []);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-6 py-16">
      <div
        className="pointer-events-none absolute -left-28 top-10 size-80 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-28 bottom-0 size-96 rounded-full bg-accent/15 blur-3xl"
        aria-hidden="true"
      />

      <section className="relative w-full max-w-2xl rounded-[2rem] border border-line/70 bg-surface/85 p-7 text-center shadow-[var(--shadow-soft)] backdrop-blur-xl sm:p-12">
        <Link
          to="/"
          className="mx-auto inline-flex rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="NexClean home"
        >
          <Logo variant="full" className="h-16 sm:h-20" />
        </Link>

        <div className="mx-auto mt-7 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <SearchX className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          Error 404
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          This page took a wrong turn.
        </h1>
        <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted">
          The link may be outdated, or the page may have moved. Your account and bookings are safe.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to={insideCustomerApp ? "/app" : "/"}>
              <Home className="size-4" />
              {insideCustomerApp ? "Customer dashboard" : "Back to homepage"}
            </Link>
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Go back
          </Button>
        </div>

        <Link
          to="/support"
          className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-primary hover:underline"
        >
          <Headphones className="size-4" /> Need help? Contact support
        </Link>
      </section>
    </main>
  );
}
