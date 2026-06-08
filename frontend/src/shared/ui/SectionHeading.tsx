import { type ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { Badge } from "./Badge";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

/**
 * Consistent section header — eyebrow badge + split-text title + subtitle.
 * Reused by every landing section to keep rhythm consistent.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "max-w-2xl",
        centered && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <Badge>{eyebrow}</Badge>
        </Reveal>
      )}
      <SplitReveal
        onScroll
        as="h2"
        text={title}
        className="mt-5 text-balance text-4xl text-ink sm:text-5xl"
      />
      {subtitle && (
        <Reveal delay={0.1}>
          <p className={cn("mt-5 text-lg text-muted", centered && "mx-auto")}>{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}
