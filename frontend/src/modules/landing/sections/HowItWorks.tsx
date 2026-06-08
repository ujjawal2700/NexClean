import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Car, Package, CalendarClock, UserCheck, Home, Sparkles } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";

const STEPS = [
  { icon: Car, title: "Choose vehicle", body: "Pick your car type in a tap." },
  { icon: Package, title: "Select package", body: "From quick wash to full detail." },
  { icon: CalendarClock, title: "Pick date & time", body: "Whenever suits your day." },
  { icon: UserCheck, title: "Cleaner assigned", body: "A verified specialist is matched." },
  { icon: Home, title: "We come to you", body: "They arrive right at your doorstep." },
  { icon: Sparkles, title: "Enjoy the shine", body: "Sit back. We handle the rest." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const lineWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section id="how-it-works">
      <SectionHeading
        align="center"
        eyebrow="How NexClean Works"
        title="Sparkling clean in six simple steps."
        subtitle="From booking to brilliance — the whole journey takes seconds to start."
      />

      <div ref={ref} className="relative mt-20">
        {/* connecting line (desktop) */}
        <div className="absolute left-0 right-0 top-7 hidden h-0.5 bg-line lg:block">
          <motion.div
            style={{ width: lineWidth }}
            className="h-full bg-gradient-to-r from-primary to-accent"
          />
        </div>

        <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-6">
          {STEPS.map((step, i) => (
            <RevealItem key={step.title} className="relative text-center">
              <div className="relative z-10 mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-[var(--shadow-soft)]">
                <step.icon className="size-6 text-primary" />
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
