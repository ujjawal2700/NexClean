import { motion } from "motion/react";
import { X, Check, Clock, Car, UserX, AlertTriangle, Zap, MapPin, ShieldCheck, Bell } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { easing } from "@shared/theme/tokens";

const PROBLEMS = [
  { icon: Clock, text: "Long waiting queues at the wash" },
  { icon: Car, text: "Driving across town to a center" },
  { icon: UserX, text: "Unprofessional, untrained cleaners" },
  { icon: AlertTriangle, text: "Inconsistent, unreliable quality" },
];

const SOLUTIONS = [
  { icon: Zap, text: "Book in 30 seconds, anytime" },
  { icon: MapPin, text: "A specialist arrives at your location" },
  { icon: ShieldCheck, text: "Verified, certified professionals" },
  { icon: Bell, text: "Real-time updates, every step" },
];

export function ProblemSolution() {
  return (
    <Section id="why" className="border-t border-line/60 bg-surface-muted/40">
      <SectionHeading
        align="center"
        eyebrow="The Old Way vs NexClean"
        title="Car care, finally done right."
        subtitle="Everything frustrating about a traditional car wash — solved by bringing the service to you."
      />

      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        {/* Problems */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, ease: easing.outExpo }}
          className="rounded-card border border-line bg-surface/70 p-8"
        >
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">The old way</p>
          <ul className="mt-6 space-y-4">
            {PROBLEMS.map((p) => (
              <li key={p.text} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink/5 text-muted">
                  <p.icon className="size-5" />
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
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/80">
            The NexClean way
          </p>
          <ul className="mt-6 space-y-4">
            {SOLUTIONS.map((s) => (
              <li key={s.text} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <s.icon className="size-5" />
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
