import { StaticPageShell } from "../components/StaticPageShell";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";

export function Careers() {
  const { pages } = useSiteContent();
  const page = pages.careers;
  return (
    <StaticPageShell eyebrow={page.eyebrow} title={page.title} subtitle={page.subtitle}>
      <Markdown>{page.body}</Markdown>
    </StaticPageShell>
  );
}
