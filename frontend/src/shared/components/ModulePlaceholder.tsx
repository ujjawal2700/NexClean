import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Logo } from "@shared/components/brand/Logo";

type ModulePlaceholderProps = {
  module: string;
  phase: string;
  description: string;
};

/**
 * Temporary landing surface for modules not yet built (customer/agent/admin).
 * Keeps routing wired and the design system visible until each phase begins.
 */
export function ModulePlaceholder({ module, phase, description }: ModulePlaceholderProps) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <Aurora />
      <div className="relative z-10 max-w-xl text-center">
        <div className="mb-8 flex justify-center">
          <Logo variant="full" />
        </div>
        <Badge className="mb-6">{phase}</Badge>
        <h1 className="text-balance text-4xl md:text-5xl">
          {module} <span className="text-gradient">module</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-pretty text-muted">{description}</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back to landing
        </Link>
      </div>
    </main>
  );
}
