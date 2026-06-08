import { Check } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useBookingsStore } from "../store/bookingsStore";
import type { PlanId } from "../types";

type Plan = {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "₹999",
    tagline: "For the weekend driver.",
    features: ["4 washes / month", "Exterior + interior", "Doorstep service", "Free rescheduling"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "₹1,799",
    tagline: "Our most popular plan.",
    features: ["8 washes / month", "Priority scheduling", "Premium products", "10% off add-ons"],
    featured: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "₹2,999",
    tagline: "Nothing but the best.",
    features: ["Unlimited washes", "Same-day guaranteed", "Top specialists", "Concierge support"],
  },
];

export function Subscriptions() {
  const { activePlan, setPlan } = useBookingsStore();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">Subscription plans</h1>
        <p className="mt-2 text-muted">Subscribe once, save on every wash. Cancel anytime.</p>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const active = activePlan === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-card border p-7 transition-transform",
                plan.featured
                  ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-3"
                  : "border-line bg-surface/70 shadow-[var(--shadow-soft)]",
              )}
            >
              {plan.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  Popular
                </span>
              )}
              <h2 className={cn("font-display text-2xl font-semibold", plan.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h2>
              <p className={cn("mt-1 text-sm", plan.featured ? "text-white/80" : "text-muted")}>
                {plan.tagline}
              </p>
              <div className="mt-5 flex items-end gap-1">
                <span className="font-display text-4xl font-semibold">{plan.price}</span>
                <span className={cn("pb-1 text-sm", plan.featured ? "text-white/80" : "text-muted")}>
                  /month
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        plan.featured ? "bg-white/20" : "bg-primary/10",
                      )}
                    >
                      <Check className={cn("size-3", plan.featured ? "text-white" : "text-primary")} />
                    </span>
                    <span className={plan.featured ? "text-white/95" : "text-ink-soft"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                {active ? (
                  <Button
                    variant={plan.featured ? "glass" : "outline"}
                    className={cn("w-full", plan.featured && "bg-white/20 text-white")}
                    onClick={() => setPlan(null)}
                  >
                    Cancel plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.featured ? "glass" : "primary"}
                    className={cn("w-full", plan.featured && "bg-white text-primary hover:bg-white")}
                    onClick={() => setPlan(plan.id)}
                  >
                    Choose {plan.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activePlan && (
        <GlassCard className="mt-6 text-center text-sm text-muted">
          You're on the <span className="font-medium text-ink capitalize">{activePlan}</span> plan.
          Subscription billing connects when the backend (Razorpay) is live.
        </GlassCard>
      )}
    </div>
  );
}
