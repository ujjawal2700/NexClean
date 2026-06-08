import {
  BadgeCheck,
  Clock,
  Leaf,
  Home,
  Lock,
  CalendarClock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { GlassCard } from "@shared/ui/GlassCard";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";

const REASONS = [
  { icon: BadgeCheck, title: "Verified Professionals", body: "Background-checked, trained specialists." },
  { icon: Clock, title: "On-Time, Every Time", body: "Punctual service that respects your day." },
  { icon: Leaf, title: "Eco-Friendly Products", body: "Safe for your car and the planet." },
  { icon: Home, title: "Doorstep Service", body: "Home, office, or society — we come to you." },
  { icon: Lock, title: "Secure Payments", body: "UPI, cards, wallets — fully protected." },
  { icon: CalendarClock, title: "Flexible Scheduling", body: "Book any slot that fits your day." },
  { icon: Sparkles, title: "Premium Standards", body: "Showroom-grade finish, every time." },
  { icon: ShieldCheck, title: "Insured Staff", body: "Complete peace of mind, guaranteed." },
];

export function WhyChoose() {
  return (
    <Section id="benefits" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading
        align="center"
        eyebrow="Why NexClean"
        title="Premium care, total peace of mind."
        subtitle="Every detail engineered around trust, quality, and your convenience."
      />
      <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((r) => (
          <RevealItem key={r.title}>
            <GlassCard interactive className="h-full">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]">
                <r.icon className="size-6" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{r.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{r.body}</p>
            </GlassCard>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
