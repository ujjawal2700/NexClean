import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Play, MapPin, Car, ShieldCheck, Star } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { MagneticButton } from "@shared/ui/MagneticButton";
import { Button } from "@shared/ui/Button";
import { Container } from "@shared/components/layout/Container";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { easing } from "@shared/theme/tokens";
import { useSectionLink } from "@shared/hooks/useSectionLink";
import { useSiteContent } from "@shared/hooks/useSiteContent";

const VEHICLES = ["Hatchback", "Sedan", "SUV", "Luxury"];
const TRUST_ICONS = [ShieldCheck, Star, MapPin];

export function Hero() {
  const navigate = useNavigate();
  const goToSection = useSectionLink();
  const { hero } = useSiteContent().landing;

  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden pt-28 pb-16">
      <Aurora />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      <Container className="relative z-10 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy */}
        <div>
          <Reveal>
            <Badge>
              <span className="size-1.5 rounded-full bg-accent" />
              {hero.badge}
            </Badge>
          </Reveal>

          <SplitReveal
            as="h1"
            text={hero.title}
            className="mt-6 max-w-[14ch] text-5xl leading-[1.02] text-ink sm:text-6xl lg:text-7xl"
          />

          <Reveal delay={0.5}>
            <p className="mt-7 max-w-md text-lg text-muted">{hero.subtitle}</p>
          </Reveal>

          <Reveal delay={0.65}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <MagneticButton size="lg" onClick={() => navigate("/app/book")}>
                {hero.primaryCta}
              </MagneticButton>
              <Button variant="outline" size="lg" onClick={() => goToSection("#how-it-works")}>
                <Play className="size-4 fill-current" />
                {hero.secondaryCta}
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.8}>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted">
              {hero.trust.map((item, i) => {
                const Icon = TRUST_ICONS[i] ?? ShieldCheck;
                return (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Icon className="size-4 text-primary" /> {item}
                  </span>
                );
              })}
            </div>
          </Reveal>
        </div>

        {/* Floating booking card */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: easing.outExpo }}
          className="relative mx-auto w-full max-w-sm [perspective:1200px]"
        >
          <div style={{ animation: "float-y 6s ease-in-out infinite" }}>
            <div className="glass rounded-card p-6 shadow-[var(--shadow-lift)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Book in 30 seconds</p>
                <span className="rounded-pill bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Doorstep
                </span>
              </div>

              <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                Your vehicle
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {VEHICLES.map((v, i) => (
                  <span
                    key={v}
                    className={
                      "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm " +
                      (i === 1
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-line bg-surface/60 text-ink-soft")
                    }
                  >
                    <Car className="size-3.5" /> {v}
                  </span>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <Row label="Package" value="Premium Detail" />
                <Row label="When" value="Tomorrow · 9:00 AM" />
                <Row label="Where" value="Green Valley Society" />
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                <div>
                  <p className="text-xs text-muted">Total</p>
                  <p className="font-display text-2xl font-semibold text-ink">₹399</p>
                </div>
                <Button>Confirm booking</Button>
              </div>
            </div>

            {/* live tracking chip */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 1.1, ease: easing.outExpo }}
              className="glass absolute -left-6 bottom-16 flex items-center gap-3 rounded-pill px-4 py-2.5 shadow-[var(--shadow-soft)]"
            >
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
              <span className="text-xs font-medium text-ink">Booking confirmed · Tomorrow 9:00 AM</span>
            </motion.div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
