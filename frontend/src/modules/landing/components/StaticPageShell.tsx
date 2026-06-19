import { type ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Container } from "@shared/components/layout/Container";
import { Badge } from "@shared/ui/Badge";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";

type StaticPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** Shared chrome for marketing/legal content pages — Navbar + hero header + prose + Footer. */
export function StaticPageShell({ eyebrow, title, subtitle, children }: StaticPageShellProps) {
  return (
    <>
      <Navbar />
      <main className="pt-40 pb-24">
        <Container className="max-w-3xl">
          <Reveal>
            <Badge>{eyebrow}</Badge>
          </Reveal>
          <SplitReveal as="h1" text={title} className="mt-5 text-4xl text-ink sm:text-5xl" />
          {subtitle && (
            <Reveal delay={0.1}>
              <p className="mt-5 text-lg text-muted">{subtitle}</p>
            </Reveal>
          )}
          <Reveal delay={0.15}>
            <div
              className={[
                "mt-12 space-y-6 text-ink-soft",
                "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink",
                "[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink",
                "[&_p]:leading-relaxed",
                "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
                "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
              ].join(" ")}
            >
              {children}
            </div>
          </Reveal>
        </Container>
      </main>
      <Footer />
    </>
  );
}
