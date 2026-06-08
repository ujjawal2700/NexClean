import { type HTMLAttributes } from "react";
import { cn } from "@shared/lib/utils";
import { Container } from "./Container";

type SectionProps = HTMLAttributes<HTMLElement> & {
  /** render without the inner Container (for full-bleed sections) */
  bleed?: boolean;
  containerClassName?: string;
};

/**
 * Vertical rhythm wrapper for page sections. Generous spacing by default.
 */
export function Section({
  className,
  children,
  bleed = false,
  containerClassName,
  ...props
}: SectionProps) {
  return (
    <section className={cn("relative py-24 md:py-32", className)} {...props}>
      {bleed ? children : <Container className={containerClassName}>{children}</Container>}
    </section>
  );
}
