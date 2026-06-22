import { motion } from "motion/react";
import { X, Check, Clock, Car, UserX, AlertTriangle, Zap, MapPin, ShieldCheck, Bell } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { easing } from "@shared/theme/tokens";
import { useSiteContent } from "@shared/hooks/useSiteContent";

const PROBLEM_ICONS = [Clock, Car, UserX, AlertTriangle];
const SOLUTION_ICONS = [Zap, MapPin, ShieldCheck, Bell];

export function ProblemSolution() {
  const { problemSolution: c } = useSiteContent().landing;
  const problems = c.problems.map((text, i) => ({ text, Icon: PROBLEM_ICONS[i] ?? Clock }));
  const solutions = c.solutions.map((text, i) => ({ text, Icon: SOLUTION_ICONS[i] ?? Check }));

  return (
    <Section id="why" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading align="center" eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        {/* Problems */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, ease: easing.outExpo }}
          className="rounded-card border border-line bg-surface/70 p-8"
        >
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{c.oldWayLabel}</p>
          <ul className="mt-6 space-y-4">
            {problems.map((p) => (
              <li key={p.text} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink/5 text-muted">
                  <p.Icon className="size-5" />
                </span>
                <span className="text-ink-soft">{p.text}</span>
                <X className="ml-auto size-4 text-muted/60" />
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Solutions */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, ease: easing.outExpo }}
          className="relative overflow-hidden rounded-card border border-primary/20 bg-gradient-to-br from-primary to-primary-soft p-8 text-white shadow-[var(--shadow-glow)]"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle, #00C2FF, transparent 70%)" }}
          />
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/80">{c.newWayLabel}</p>
          <ul className="mt-6 space-y-4">
            {solutions.map((s) => (
              <li key={s.text} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <s.Icon className="size-5" />
                </span>
                <span className="font-medium">{s.text}</span>
                <Check className="ml-auto size-4 text-white" />
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </Section>
  );
}
