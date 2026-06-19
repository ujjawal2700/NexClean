import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { Button } from "@shared/ui/Button";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { cn } from "@shared/lib/utils";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Basic",
    price: "₹999",
    cadence: "/month",
    tagline: "Perfect for the weekend driver.",
    features: ["4 washes / month", "Exterior + interior clean", "Doorstep service", "Free rescheduling"],
  },
  {
    name: "Premium",
    price: "₹1,799",
    cadence: "/month",
    tagline: "Our most popular plan.",
    features: [
      "8 washes / month",
      "Priority scheduling",
      "Premium detailing products",
      "Dedicated support",
      "10% off add-ons",
    ],
    featured: true,
  },
  {
    name: "Elite",
    price: "₹2,999",
    cadence: "/month",
    tagline: "For those who expect the best.",
    features: [
      "Unlimited priority washes",
      "Same-day booking guaranteed",
      "Top-rated specialists",
      "Complimentary interior detail",
      "Concierge support",
    ],
  },
];

export function Subscriptions() {
  const navigate = useNavigate();

  return (
    <Section id="plans" className="border-t border-line/60">
      <SectionHeading
        align="center"
        eyebrow="Subscription Plans"
        title="Care that keeps your car its best."
        subtitle="Switch from one-off washes to effortless, recurring care — and always save more."
      />

      <RevealGroup className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <RevealItem key={plan.name}>
            <div
              className={cn(
                "relative flex h-full flex-col rounded-card border p-8 transition-transform duration-300",
                plan.featured
                  ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-4"
                  : "border-line bg-surface/70 shadow-[var(--shadow-soft)]",
              )}
            >
              {plan.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  Most popular
                </span>
              )}
              <h3 className={cn("font-display text-2xl font-semibold", plan.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h3>
              <p className={cn("mt-1 text-sm", plan.featured ? "text-white/80" : "text-muted")}>
                {plan.tagline}
              </p>
              <div className="mt-6 flex items-end gap-1">
                <span className="font-display text-4xl font-semibold">{plan.price}</span>
                <span className={cn("pb-1 text-sm", plan.featured ? "text-white/80" : "text-muted")}>
                  {plan.cadence}
                </span>
              </div>

              <ul className="mt-7 space-y-3">
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

              <div className="mt-auto pt-8">
                <Button
                  variant={plan.featured ? "glass" : "primary"}
                  className={cn("w-full", plan.featured && "bg-none bg-white text-primary hover:bg-white")}
                  onClick={() => navigate("/app/plans")}
                >
                  Choose {plan.name}
                </Button>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <p className="mt-8 text-center text-sm text-muted">
        Prices are indicative and configurable by the admin. Cancel anytime.
      </p>
    </Section>
  );
}
