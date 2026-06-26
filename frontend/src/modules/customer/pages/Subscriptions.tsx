import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useMe, usePlans, useCategoryLabel } from "../api/queries";
import { useSubscribe, useUnsubscribe } from "../api/mutations";
import type { CarType, CatalogPlan } from "../types";

/** Presentation copy that the catalog API doesn't carry (tagline, perks, highlight). */
type PlanMeta = { tagline: string; perks: string[]; featured?: boolean };
const PLAN_META: Record<string, PlanMeta> = {
  basic: {
    tagline: "For the weekend driver.",
    perks: ["Exterior + interior", "Doorstep service", "Free rescheduling"],
  },
  premium: {
    tagline: "Our most popular plan.",
    perks: ["Priority scheduling", "Premium products", "10% off add-ons"],
    featured: true,
  },
  elite: {
    tagline: "Nothing but the best.",
    perks: ["Same-day guaranteed", "Top specialists", "Concierge support"],
  },
};
const DEFAULT_META: PlanMeta = { tagline: "Subscribe and save on every wash.", perks: ["Doorstep service"] };

function washesLabel(washesPerMonth: number): string {
  return washesPerMonth < 0 ? "Unlimited washes" : `${washesPerMonth} washes / month`;
}

export function Subscriptions() {
  const { data: me } = useMe();
  const { data: plans = [], isLoading } = usePlans();
  const categoryLabel = useCategoryLabel();
  const subscribe = useSubscribe();
  const unsubscribe = useUnsubscribe();
  const busy = subscribe.isPending || unsubscribe.isPending;

  const activePlan = me?.activePlan ?? null;

  // The distinct vehicle types the customer owns; price previews follow the selected one.
  const ownedTypes = Array.from(new Set((me?.vehicles ?? []).map((v) => v.type)));
  const [selectedType, setSelectedType] = useState<CarType | null>(ownedTypes[0] ?? null);
  const vehicleType = selectedType ?? ownedTypes[0] ?? null;

  const priceFor = (plan: CatalogPlan) =>
    vehicleType ? plan.prices[vehicleType] : plan.price;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">Subscription plans</h1>
        <p className="mt-2 text-muted">Subscribe once, save on every wash. Cancel anytime.</p>
      </div>

      {/* Vehicle selector — pricing varies by vehicle type. */}
      {ownedTypes.length > 0 ? (
        ownedTypes.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Pricing for</span>
            {ownedTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
                  t === vehicleType
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-surface/70 text-ink-soft hover:border-primary/40",
                )}
              >
                {categoryLabel(t)}
              </button>
            ))}
          </div>
        )
      ) : (
        <p className="mb-6 text-sm text-muted">
          Add a vehicle in your profile to see its exact price — showing the lowest tier for now.
        </p>
      )}

      {isLoading && <p className="text-muted">Loading plans…</p>}

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const meta = PLAN_META[plan.id] ?? DEFAULT_META;
          const active = activePlan === plan.id;
          const features = [washesLabel(plan.washesPerMonth), ...meta.perks];
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-card border p-7 transition-transform",
                meta.featured
                  ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-3"
                  : "border-line bg-surface/70 shadow-[var(--shadow-soft)]",
              )}
            >
              {meta.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  Popular
                </span>
              )}
              <h2 className={cn("font-display text-2xl font-semibold", meta.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h2>
              <p className={cn("mt-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>{meta.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                {!vehicleType && (
                  <span className={cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>from</span>
                )}
                <span className="font-display text-4xl font-semibold">{formatMoney(priceFor(plan))}</span>
                <span className={cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted")}>/month</span>
              </div>
              {vehicleType && (
                <p className={cn("mt-1 text-xs", meta.featured ? "text-white/70" : "text-muted")}>
                  for your {categoryLabel(vehicleType)}
                </p>
              )}

              <ul className="mt-6 space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        meta.featured ? "bg-white/20" : "bg-primary/10",
                      )}
                    >
                      <Check className={cn("size-3", meta.featured ? "text-white" : "text-primary")} />
                    </span>
                    <span className={meta.featured ? "text-white/95" : "text-ink-soft"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                {active ? (
                  <Button
                    variant={meta.featured ? "glass" : "outline"}
                    className={cn("w-full", meta.featured && "bg-white/20 text-white")}
                    disabled={busy}
                    onClick={() => unsubscribe.mutate()}
                  >
                    Cancel plan
                  </Button>
                ) : (
                  <Button
                    variant={meta.featured ? "glass" : "primary"}
                    className={cn("w-full", meta.featured && "bg-white text-primary hover:bg-white")}
                    disabled={busy}
                    onClick={() => subscribe.mutate(plan.id)}
                  >
                    Choose {plan.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && plans.length === 0 && (
        <p className="text-muted">No plans available right now — please check back soon.</p>
      )}

      {activePlan && (
        <GlassCard className="mt-6 text-center text-sm text-muted">
          You're on the <span className="font-medium text-ink capitalize">{activePlan}</span> plan.
          Subscription billing connects when the backend (Razorpay) is live.
        </GlassCard>
      )}
    </div>
  );
}
