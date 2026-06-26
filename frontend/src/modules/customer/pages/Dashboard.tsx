import { Link } from "react-router-dom";
import { ArrowRight, CalendarPlus, MapPin, Sparkles, Plus, CreditCard } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton } from "@shared/ui/Skeleton";
import { useMe, useBookings, usePromoBanners, useVehicleCategories, useCategoryLabel } from "../api/queries";
import { PACKAGES } from "../data/catalog";
import { formatDate, formatMoney, greeting } from "@shared/lib/format";

export function Dashboard() {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: banners = [] } = usePromoBanners();
  const { data: categories = [] } = useVehicleCategories();
  const categoryLabel = useCategoryLabel();

  const name = me?.name ?? "Member";
  const vehicles = me?.vehicles ?? [];
  const activePlan = me?.activePlan ?? null;
  const next = bookings.filter((b) => b.status === "upcoming")[0];
  const cheapestBase = categories.length ? Math.min(...categories.map((c) => c.basePrice)) : 0;

  return (
    <div className="space-y-8">
      {/* greeting */}
      <div>
        <p className="text-sm text-muted">{greeting()},</p>
        {meLoading ? (
          <Skeleton className="mt-1 h-9 w-48" />
        ) : (
          <h1 className="text-3xl text-ink">{name || "Member"} 👋</h1>
        )}
      </div>

      {/* hero CTA + next booking */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary to-primary-soft p-8 text-white shadow-[var(--shadow-glow)]">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle, #00C2FF, transparent 70%)" }}
          />
          <div className="relative">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/80">
              Doorstep car care
            </p>
            <h2 className="mt-3 max-w-xs font-display text-3xl font-semibold">
              Ready for a spotless ride?
            </h2>
            <p className="mt-2 max-w-sm text-white/85">
              Book a certified specialist to your location in under a minute.
            </p>
            <Button asChild variant="glass" className="mt-6 bg-white text-primary hover:bg-white">
              <Link to="/app/book">
                Book a cleaning <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* next booking */}
        <GlassCard className="flex flex-col">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-ink">Next booking</p>
            <Sparkles className="size-5 text-primary" />
          </div>
          {bookingsLoading ? (
            <div className="mt-4 flex-1 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : next ? (
            <div className="mt-4 flex flex-1 flex-col">
              <p className="text-sm text-muted">{next.packageName}</p>
              <p className="mt-1 font-display text-xl text-ink">{next.vehicleName}</p>
              <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
                <p className="flex items-center gap-2">
                  <CalendarPlus className="size-4 text-primary" /> {formatDate(next.date)} · {next.slot}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> {next.addressLabel}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                <Link to="/app/bookings">View details</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-1 flex-col items-start justify-center">
              <p className="text-sm text-muted">No upcoming bookings yet.</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/app/book">Book your first clean</Link>
              </Button>
            </div>
          )}
        </GlassCard>
      </div>

      {/* promotional banners */}
      {banners.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {banners.map((b) => {
            const content = (
              <div className="relative h-36 w-80 shrink-0 overflow-hidden rounded-card">
                <img src={b.imageUrl} alt={b.title} className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="font-display text-lg font-semibold text-white">{b.title}</p>
                  {b.subtitle && <p className="mt-0.5 text-sm text-white/85">{b.subtitle}</p>}
                  {b.ctaLabel && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white">
                      {b.ctaLabel} <ArrowRight className="size-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
            return b.ctaLink ? (
              <a key={b.id} href={b.ctaLink} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <div key={b.id}>{content}</div>
            );
          })}
        </div>
      )}

      {/* garage */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">Your garage</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/profile">
              <Plus className="size-4" /> Manage
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <GlassCard key={i} className="flex items-center gap-4">
                  <Skeleton className="h-16 w-24 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </GlassCard>
              ))
            : vehicles.map((v) => (
                <GlassCard key={v.id} interactive className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <CarSilhouette type={v.type} uid={`dash-${v.id}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">{v.name}</p>
                    <p className="text-sm text-muted">{categoryLabel(v.type)}</p>
                    <p className="mt-0.5 text-xs text-muted">{v.plate}</p>
                  </div>
                </GlassCard>
              ))}
        </div>
      </section>

      {/* plan strip */}
      <GlassCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CreditCard className="size-5" />
          </span>
          <div>
            <p className="font-display font-semibold text-ink">
              {activePlan ? `${activePlan[0].toUpperCase()}${activePlan.slice(1)} plan active` : "No active plan"}
            </p>
            <p className="text-sm text-muted">
              {activePlan
                ? "Enjoy priority scheduling and savings."
                : "Subscribe and save on every wash."}
            </p>
          </div>
        </div>
        <Button asChild variant={activePlan ? "outline" : "primary"} size="sm">
          <Link to="/app/plans">{activePlan ? "Manage plan" : "View plans"}</Link>
        </Button>
      </GlassCard>

      <p className="text-center text-xs text-muted">
        Starting prices from {formatMoney(PACKAGES[0].factor * cheapestBase)} · Cancel anytime
      </p>
    </div>
  );
}
