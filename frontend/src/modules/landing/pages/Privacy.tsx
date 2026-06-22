import { StaticPageShell } from "../components/StaticPageShell";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";

export function Privacy() {
  const { pages } = useSiteContent();
  const page = pages.privacy;
  return (
    <StaticPageShell eyebrow={page.eyebrow} title={page.title} subtitle={page.subtitle}>
      <Markdown>{page.body}</Markdown>
    </StaticPageShell>
  );
}
