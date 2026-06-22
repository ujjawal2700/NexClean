import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Car, Package, CalendarClock, UserCheck, Home, Sparkles } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";

const STEP_ICONS = [Car, Package, CalendarClock, UserCheck, Home, Sparkles];

export function HowItWorks() {
  const { howItWorks: c } = useSiteContent();
  const steps = c.steps.map((step, i) => ({ ...step, Icon: STEP_ICONS[i] ?? Sparkles }));

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const lineWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section id="how-it-works">
      <SectionHeading align="center" eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <div ref={ref} className="relative mt-20">
        {/* connecting line (desktop) */}
        <div className="absolute left-0 right-0 top-7 hidden h-0.5 bg-line lg:block">
          <motion.div
            style={{ width: lineWidth }}
            className="h-full bg-gradient-to-r from-primary to-accent"
          />
        </div>

        <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, i) => (
            <RevealItem key={step.title} className="relative text-center">
              <div className="relative z-10 mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-[var(--shadow-soft)]">
                <step.Icon className="size-6 text-primary" />
                <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{step.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}
