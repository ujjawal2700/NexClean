import { jsx as _jsx } from "react/jsx-runtime";
import { StaticPageShell } from "../components/StaticPageShell";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";
export function Careers() {
    const { pages } = useSiteContent();
    const page = pages.careers;
    return (_jsx(StaticPageShell, { eyebrow: page.eyebrow, title: page.title, subtitle: page.subtitle, children: _jsx(Markdown, { children: page.body }) }));
}
