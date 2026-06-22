import { Star, Quote } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { GlassCard } from "@shared/ui/GlassCard";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";

export function Testimonials() {
  const { testimonials: c } = useSiteContent().landing;
  return (
    <Section id="reviews" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading align="center" eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3">
        {c.reviews.map((r) => (
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
