import { Link } from "react-router-dom";
import { ArrowRight, CalendarPlus, MapPin, Sparkles, Plus, CreditCard, Bell } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton } from "@shared/ui/Skeleton";
import { useMe, useBookings, usePromoBanners, useVehicleCategories, useCategoryLabel, useNotifications } from "../api/queries";
import { useIsGuest } from "../store/sessionStore";
import { PACKAGES } from "../data/catalog";
import { formatDate, formatMoney, greeting } from "@shared/lib/format";
import type { BannerType } from "../types";

/**
 * Corner badge per banner type. "promotional" deliberately has none — it is the
 * default and the most common, and labelling every card "Promotional" would be
 * noise rather than information.
 */
const BANNER_TYPE_BADGES: Partial<Record<BannerType, { label: string; className: string }>> = {
  discount: { label: "Discount", className: "bg-emerald-500/80 text-white" },
  "off-peak-hours": { label: "Off-peak hours", className: "bg-amber-500/85 text-white" },
  announcement: { label: "News", className: "bg-sky-500/80 text-white" },
};

export function Dashboard() {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: banners = [] } = usePromoBanners();
  const { data: categories = [] } = useVehicleCategories();
  const { data: notifications = [] } = useNotifications();
  const categoryLabel = useCategoryLabel();
  const isGuest = useIsGuest();

  const unread = notifications.filter((n) => !n.read).length;
  const unreadNotification = notifications.find((n) => !n.read);

  const name = isGuest ? "Guest" : me?.name ?? "Member";
  const vehicles = me?.vehicles ?? [];
  const activePlan = me?.activePlan ?? null;
  const next = bookings.filter((b) => b.status === "upcoming")[0];
  const cheapestBase = categories.length ? Math.min(...categories.map((c) => c.basePrice)) : 0;
  const categoryImageMap = new Map(categories.map((c) => [c.key, c.imageUrl]));

  return (
    <div className="space-y-8">
      {/* greeting & notification button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          {meLoading && !isGuest ? (
            <Skeleton className="mt-1 h-9 w-48" />
          ) : (
            <h1 className="text-2xl text-ink sm:text-3xl">{name || "Member"} 👋</h1>
          )}
        </div>

        {!isGuest && (
          <Link
            to="/app/notifications"
            className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-ink-soft shadow-xs transition-all hover:border-primary/40 hover:bg-surface-muted hover:text-primary active:scale-95 cursor-pointer"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-5 h-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-xs">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* In-app notification alert banner if unread */}
      {!isGuest && unread > 0 && unreadNotification && (
        <Link
          to="/app/notifications"
          className="group -mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-surface p-3.5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Bell className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                  {unread} New Alert{unread > 1 ? "s" : ""}
                </span>
                <p className="font-medium text-xs text-ink truncate">
                  {unreadNotification.title}
                </p>
              </div>
              <p className="text-xs text-muted truncate mt-0.5">
                {unreadNotification.body}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
            <span>View</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      )}

      {/* hero CTA + next booking */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary to-primary-soft p-5 text-white shadow-[var(--shadow-glow)] sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle, #00C2FF, transparent 70%)" }}
          />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/80 sm:text-sm">
              Doorstep car care
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold sm:mt-3 sm:max-w-xs sm:text-3xl">
              Ready for a spotless ride?
            </h2>
            <p className="mt-1.5 text-sm text-white/85 sm:mt-2 sm:max-w-sm">
              Book a certified specialist to your location in under a minute.
            </p>
            <Button asChild variant="glass" className="mt-4 bg-white text-primary hover:bg-white sm:mt-6">
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
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="font-display text-xl font-semibold text-ink">Special Offers</h2>
          </div>
          {/* Banners: intentionally horizontally scrollable, contained with overflow-hidden on parent */}
          <div className="overflow-hidden">
            <div className="flex gap-4 overflow-x-auto pb-3">
              {banners.map((b) => {
              const badge = BANNER_TYPE_BADGES[b.type];
              const content = (
                <div className="relative h-36 w-72 shrink-0 overflow-hidden rounded-card border border-line shadow-sm transition-transform hover:scale-[1.01] sm:w-80">
                  <img src={b.imageUrl} alt={b.title} className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {badge && (
                    <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="font-display text-base font-semibold text-white">{b.title}</p>
                    {b.subtitle && <p className="mt-0.5 text-xs text-white/80">{b.subtitle}</p>}
                    {b.ctaLabel && (
                      <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-white hover:bg-white/30 transition-colors">
                        {b.ctaLabel} <ArrowRight className="size-3" />
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
          </div>
        </section>
      )}


      {/* garage — a guest has none yet, so the slot sells the account instead */}
      {isGuest ? (
        <GlassCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-display font-semibold text-ink">Your garage</p>
            <p className="mt-1 text-sm text-muted">
              Log in to add your vehicles, save addresses and book a doorstep wash.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/app/login">
              Log in or sign up <ArrowRight className="size-4" />
            </Link>
          </Button>
        </GlassCard>
      ) : (
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
                    <CarSilhouette type={v.type} imageUrl={categoryImageMap.get(v.type)} uid={`dash-${v.id}`} />
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
      )}

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
