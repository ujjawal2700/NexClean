import { ChevronDown } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";
import { useSiteContent } from "@shared/hooks/useSiteContent";

export function Help() {
  const { help } = useSiteContent();
  return (
    <StaticPageShell eyebrow={help.eyebrow} title={help.title} subtitle={help.subtitle}>
      <div className="space-y-3">
        {help.faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-card border border-line bg-surface/60 p-5 open:bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
              {f.q}
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </StaticPageShell>
  );
}
