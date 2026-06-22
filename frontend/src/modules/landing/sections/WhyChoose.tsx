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
import { useSiteContent } from "@shared/hooks/useSiteContent";

const REASON_ICONS = [BadgeCheck, Clock, Leaf, Home, Lock, CalendarClock, Sparkles, ShieldCheck];

export function WhyChoose() {
  const { whyChoose: c } = useSiteContent();
  const reasons = c.reasons.map((r, i) => ({ ...r, Icon: REASON_ICONS[i] ?? BadgeCheck }));

  return (
    <Section id="benefits" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading align="center" eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
      <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((r) => (
          <RevealItem key={r.title}>
            <GlassCard interactive className="h-full">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]">
                <r.Icon className="size-6" />
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
