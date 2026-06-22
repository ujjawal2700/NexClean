import { motion, useReducedMotion } from "motion/react";
import { Car, Bell, MapPin } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";

// Nearby cars that "light up" when the specialist enters the area
const CARS = [
  { top: "22%", left: "24%", delay: 0.6 },
  { top: "30%", left: "70%", delay: 1.0 },
  { top: "62%", left: "30%", delay: 1.4 },
  { top: "70%", left: "66%", delay: 1.8 },
  { top: "48%", left: "82%", delay: 2.2 },
];

function MapStage() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-gradient-to-br from-surface to-surface-muted shadow-[var(--shadow-lift)]">
      {/* map grid + roads */}
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 top-[38%] h-3 bg-line/70" />
        <div className="absolute left-0 right-0 top-[72%] h-3 bg-line/70" />
        <div className="absolute bottom-0 top-0 left-[30%] w-3 bg-line/70" />
        <div className="absolute bottom-0 top-0 left-[68%] w-3 bg-line/70" />
      </div>

      {/* society label */}
      <span className="glass absolute left-4 top-4 rounded-pill px-3 py-1.5 text-xs font-medium text-ink">
        <MapPin className="mr-1 inline size-3.5 text-primary" />
        Green Valley Society
      </span>

      {/* expanding radius rings from the specialist */}
      {!reduceMotion &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border-2 border-primary/40"
            style={{ translateX: "-50%", translateY: "-50%" }}
            animate={{ width: ["0px", "92%"], height: ["0px", "92%"], opacity: [0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 1.5, ease: "easeOut" }}
          />
        ))}
      {/* radius fill */}
      <div
        className="absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(79,124,255,0.16), transparent 70%)" }}
      />

      {/* nearby cars lighting up */}
      {CARS.map((c, i) => (
        <motion.div
          key={i}
          className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl"
          style={{ top: c.top, left: c.left }}
          initial={{ opacity: 0.45 }}
          animate={
            reduceMotion
              ? { opacity: 1, backgroundColor: "#4F7CFF", color: "#ffffff" }
              : {
                  opacity: [0.45, 1, 0.45],
                  scale: [1, 1.12, 1],
                  backgroundColor: ["#eef2fb", "#4F7CFF", "#eef2fb"],
                  color: ["#70798B", "#ffffff", "#70798B"],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0.3 }
              : { duration: 2.4, repeat: Infinity, delay: c.delay, ease: "easeInOut" }
          }
        >
          <Car className="size-4" />
        </motion.div>
      ))}

      {/* the specialist (center) */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <span className="relative grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
          <MapPin className="relative size-5" />
        </span>
      </div>
    </div>
  );
}

function PushCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.3 }}
      className="glass absolute -bottom-6 left-1/2 w-[88%] max-w-sm -translate-x-1/2 rounded-card p-4 shadow-[var(--shadow-lift)] sm:-right-8 sm:left-auto sm:bottom-10 sm:translate-x-0"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
          <Bell className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">🚗 NexClean Nearby</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            A cleaning specialist is servicing vehicles in Green Valley Society. Book within 30 minutes
            for priority service.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-8 px-3 text-xs">Book now</Button>
            <Button size="sm" variant="ghost" className="h-8 px-3 text-xs">Remind me later</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SmartAreaAlert() {
  const { smartAreaAlert: c } = useSiteContent();
  return (
    <Section id="nearby" className="relative overflow-hidden border-t border-line/60">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(110,168,255,0.12), transparent 60%)" }}
      />
      <div className="relative grid items-center gap-16 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <Reveal>
            <Badge>
              <span className="size-1.5 rounded-full bg-accent" />
              {c.badge}
            </Badge>
          </Reveal>
          <SplitReveal
            onScroll
            as="h2"
            text={c.title}
            className="mt-5 max-w-[16ch] text-4xl text-ink sm:text-5xl"
          />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg text-muted">{c.body}</p>
          </Reveal>

          <Reveal delay={0.2}>
            <ul className="mt-8 space-y-3">
              {c.features.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink-soft">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gradient-to-r from-primary to-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Animated map */}
        <Reveal>
          <div className="relative mx-auto w-full max-w-md pb-10 sm:pb-0">
            <MapStage />
            <PushCard />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
