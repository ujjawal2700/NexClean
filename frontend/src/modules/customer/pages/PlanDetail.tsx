import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Car, Repeat, Sparkles } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useMe, usePlans, useCategoryLabel, useSubscriptionSchedule } from "../api/queries";
import { useIsGuest } from "../store/sessionStore";
import { planCopy, washesLabel } from "../data/plans";
import type { CarType } from "../types";
import type { PlansLocationState } from "./Subscriptions";

/**
 * Everything about one subscription plan: the admin-written description and
 * key points, washes per month and the price for each vehicle category. Opened
 * from a plan card on /app/plans; a nested screen, so the tab bar is hidden.
 */
export function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  const { data: plans = [], isLoading } = usePlans();
  const { data: schedule } = useSubscriptionSchedule();
  const categoryLabel = useCategoryLabel();

  const plan = plans.find((p) => p.id === id);
  const ownedTypes = Array.from(new Set((me?.vehicles ?? []).map((v) => v.type)));
  const [selectedType, setSelectedType] = useState<CarType | null>(null);
  const vehicleType = selectedType ?? ownedTypes[0] ?? null;

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/plans"));

  const header = (title: string) => (
    <div className="sticky top-0 z-20 -mx-4 mb-5 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
      <button
        onClick={goBack}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
        aria-label="Back">
        <ArrowLeft className="size-4" />
      </button>
      <h1 className="truncate font-display text-2xl text-ink sm:text-3xl">{title}</h1>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {header("Plan details")}
        <p className="text-muted">Loading plan…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div>
        {header("Plan details")}
        <GlassCard className="text-center">
          <p className="font-display text-lg font-semibold text-ink">This plan isn't available</p>
          <p className="mt-1 text-sm text-muted">It may have been retired. Have a look at the current plans.</p>
          <Button className="mt-4" onClick={() => navigate("/app/plans", { replace: true })}>
            See all plans
          </Button>
        </GlassCard>
      </div>
    );
  }

  const copy = planCopy(plan);
  const isCurrent = me?.activePlan === plan.id && !schedule?.expired;
  const price = vehicleType ? plan.prices[vehicleType] : plan.price;
  const priceRows = Object.entries(plan.prices).filter(([, v]) => typeof v === "number");
  const includedItems = [
    ...(plan.washesPerMonth !== 0 ? [washesLabel(plan.washesPerMonth)] : []),
    ...copy.keyPoints,
  ];

  const choose = () => {
    if (isGuest) {
      navigate("/app/login", { state: { from: `/app/plans/${plan.id}` } });
      return;
    }
    const state: PlansLocationState = { checkoutPlanId: plan.id };
    navigate("/app/plans", { state });
  };

  return (
    <div className="pb-28">
      {header(plan.name)}

      {/* Hero */}
      <div
        className={cn(
          "rounded-card p-6 sm:p-8",
          copy.featured
            ? "bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)]"
            : "border border-line bg-surface/70 shadow-[var(--shadow-soft)]",
        )}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-3xl font-semibold">{plan.name}</h2>
              {isCurrent && (
                <span
                  className={cn(
                    "rounded-pill px-3 py-1 text-xs font-medium",
                    copy.featured ? "bg-white/20" : "bg-primary/10 text-primary",
                  )}>
                  Your plan
                </span>
              )}
            </div>
            {copy.tagline ? (
              <p className={cn("mt-1 text-sm", copy.featured ? "text-white/80" : "text-muted")}>{copy.tagline}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="flex items-end justify-end gap-1">
              {!vehicleType && (
                <span className={cn("pb-1 text-sm", copy.featured ? "text-white/80" : "text-muted")}>from</span>
              )}
              <span className="font-display text-3xl font-semibold sm:text-4xl">{formatMoney(price)}</span>
              <span className={cn("pb-1 text-sm", copy.featured ? "text-white/80" : "text-muted")}>/month</span>
            </p>
            {vehicleType && (
              <p className={cn("mt-1 text-xs", copy.featured ? "text-white/70" : "text-muted")}>
                for your {categoryLabel(vehicleType)}
              </p>
            )}
          </div>
        </div>

        {plan.washesPerMonth !== 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-medium",
                copy.featured ? "bg-white/20" : "bg-primary/10 text-primary",
              )}>
              <Repeat className="size-4" /> {washesLabel(plan.washesPerMonth)}
            </span>
          </div>
        )}

        {ownedTypes.length > 1 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={cn("text-sm", copy.featured ? "text-white/80" : "text-muted")}>Pricing for</span>
            {ownedTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  "cursor-pointer rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
                  t === vehicleType
                    ? copy.featured
                      ? "border-white bg-white text-primary"
                      : "border-primary bg-primary text-white"
                    : copy.featured
                      ? "border-white/40 text-white hover:border-white"
                      : "border-line bg-surface/70 text-ink-soft hover:border-primary/40",
                )}>
                {categoryLabel(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {copy.description && (
          <GlassCard className="lg:col-span-2">
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <Sparkles className="size-5 text-primary" /> About this plan
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{copy.description}</p>
          </GlassCard>
        )}

        {includedItems.length > 0 && (
          <GlassCard>
            <p className="font-display text-lg font-semibold text-ink">What's included</p>
            <ul className="mt-4 space-y-3">
              {includedItems.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink-soft">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10">
                    <Check className="size-3 text-primary" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        <GlassCard className={includedItems.length === 0 && !copy.description ? "lg:col-span-2" : undefined}>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Car className="size-5 text-primary" /> Monthly price by vehicle
          </p>
          <dl className="mt-4 divide-y divide-line/70 text-sm">
            {priceRows.map(([key, value]) => (
              <div
                key={key}
                className={cn(
                  "flex justify-between py-2.5",
                  key === vehicleType && "font-semibold text-primary",
                )}>
                <dt className={key === vehicleType ? "" : "text-muted"}>
                  {categoryLabel(key)}
                  {ownedTypes.includes(key as CarType) && <span className="ml-1.5 text-xs">(yours)</span>}
                </dt>
                <dd className={key === vehicleType ? "" : "font-medium text-ink"}>{formatMoney(value)}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </div>

      {/* Sticky action — the tab bar is hidden here, so this sits at the bottom edge. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 sm:px-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{plan.name}</p>
            <p className="text-xs text-muted">
              {formatMoney(price)}/month{vehicleType ? ` · ${categoryLabel(vehicleType)}` : ""}
            </p>
          </div>
          {isCurrent ? (
            <Button variant="outline" className="min-h-12 shrink-0" onClick={() => navigate("/app/plans")}>
              Manage my plan
            </Button>
          ) : (
            <Button className="min-h-12 shrink-0" onClick={choose}>
              {isGuest ? `Log in to choose` : `Choose ${plan.name}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
