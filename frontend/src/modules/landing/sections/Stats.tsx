import { Section } from "@shared/components/layout/Section";
import { Container } from "@shared/components/layout/Container";
import { useCountUp } from "@shared/hooks/useCountUp";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import type { StatItem as Stat } from "@shared/types/content";

function StatItem({ stat }: { stat: Stat }) {
  const factor = stat.decimals ? 10 ** stat.decimals : 1;
  const { ref, value } = useCountUp(Math.round(stat.value * factor));
  const display = stat.decimals
    ? (value / factor).toFixed(stat.decimals)
    : value.toLocaleString("en-IN");

  return (
    <div className="text-center">
      <p className="font-display text-5xl font-semibold text-white sm:text-6xl">
        <span ref={ref}>{display}</span>
        <span className="text-accent">{stat.suffix}</span>
      </p>
      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-white/60">{stat.label}</p>
    </div>
  );
}

export function Stats() {
  const { stats } = useSiteContent().landing;
  return (
    <Section bleed className="py-0">
      <div className="relative overflow-hidden bg-ink">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(79,124,255,0.35), transparent 60%)" }}
        />
        <Container className="relative grid grid-cols-2 gap-y-12 py-20 lg:grid-cols-4">
          {stats.items.map((s) => (
            <StatItem key={s.label} stat={s} />
          ))}
        </Container>
      </div>
    </Section>
  );
}
