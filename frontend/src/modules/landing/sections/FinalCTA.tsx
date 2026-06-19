import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { MagneticButton } from "@shared/ui/MagneticButton";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSectionLink } from "@shared/hooks/useSectionLink";

export function FinalCTA() {
  const navigate = useNavigate();
  const goToSection = useSectionLink();

  return (
    <Section bleed className="px-6 py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a2a6c] via-primary to-[#0a1f5c] px-8 py-20 text-center shadow-[var(--shadow-lift)] sm:px-16">
        {/* atmosphere */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, #00C2FF, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #6EA8FF, transparent 70%)" }}
        />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-10" />

        <div className="relative">
          <SplitReveal
            onScroll
            as="h2"
            text="Give your vehicle the care it deserves."
            className="mx-auto max-w-[18ch] text-balance text-4xl text-white sm:text-5xl lg:text-6xl"
          />
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-md text-lg text-white/80">
              Book in 30 seconds. A certified specialist comes to you. It's that simple.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <MagneticButton
                size="lg"
                className="bg-none bg-white text-primary hover:bg-white"
                onClick={() => navigate("/app/book")}
              >
                Book your cleaning <ArrowRight className="size-5" />
              </MagneticButton>
              <Button size="lg" variant="glass" className="text-white" onClick={() => goToSection("#plans")}>
                View plans
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
