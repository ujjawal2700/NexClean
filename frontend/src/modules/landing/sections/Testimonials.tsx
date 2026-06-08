import { Star, Quote } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { GlassCard } from "@shared/ui/GlassCard";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";

const REVIEWS = [
  {
    name: "Aarav Mehta",
    role: "BMW 5 Series owner",
    initials: "AM",
    quote:
      "It feels like valet service for my car. They arrived on time, and the finish was genuinely showroom quality.",
  },
  {
    name: "Priya Sharma",
    role: "Hyundai Creta owner",
    initials: "PS",
    quote:
      "I got the NexClean Nearby alert while working from home and booked in seconds. Absolute game-changer.",
  },
  {
    name: "Rohan Verma",
    role: "Mahindra Thar owner",
    initials: "RV",
    quote:
      "Tracking the specialist live, eco-friendly products, spotless results. I've moved my whole family to the Elite plan.",
  },
];

export function Testimonials() {
  return (
    <Section id="reviews" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading
        align="center"
        eyebrow="Loved By Owners"
        title="Trusted by people who love their cars."
        subtitle="Join thousands who've made doorstep care their new normal."
      />

      <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3">
        {REVIEWS.map((r) => (
          <RevealItem key={r.name}>
            <GlassCard className="flex h-full flex-col">
              <Quote className="size-8 text-primary/30" />
              <div className="mt-3 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-ink-soft">“{r.quote}”</p>
              <div className="mt-6 flex items-center gap-3 border-t border-line/70 pt-5">
                <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-semibold text-white">
                  {r.initials}
                </span>
                <div>
                  <p className="font-semibold text-ink">{r.name}</p>
                  <p className="text-sm text-muted">{r.role}</p>
                </div>
              </div>
            </GlassCard>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
