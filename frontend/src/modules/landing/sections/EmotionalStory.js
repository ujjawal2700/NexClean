import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { ImageSlot } from "@shared/components/visual/ImageSlot";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import emotionalStoryArt from "@/assets/emotional-story.webp";
export function EmotionalStory() {
    const { emotionalStory: c } = useSiteContent().landing;
    return (_jsx(Section, { id: "story", className: "overflow-hidden", children: _jsxs("div", { className: "grid items-center gap-14 lg:grid-cols-2", children: [_jsx(Reveal, { children: _jsxs("div", { className: "relative", children: [_jsx("div", { className: "aspect-[4/5] w-full", children: _jsx(ImageSlot, { src: emotionalStoryArt, alt: "Soft indigo and cyan light, like a reflection caught on a freshly cleaned car", label: "Lifestyle photo \u00B7 owner with their car", className: "h-full" }) }), _jsx("div", { className: "glass absolute -bottom-6 -right-4 max-w-[15rem] rounded-card p-5 shadow-(--shadow-lift) sm:right-6", children: _jsx("p", { className: "text-sm leading-relaxed text-ink", children: c.caption }) })] }) }), _jsxs("div", { className: "lg:pl-6", children: [_jsx(Reveal, { children: _jsx(Badge, { children: c.badge }) }), _jsx(SplitReveal, { onScroll: true, as: "h2", text: c.title, className: "mt-5 max-w-[16ch] text-4xl text-ink sm:text-5xl" }), _jsx(Reveal, { delay: 0.1, children: _jsx("p", { className: "mt-6 max-w-md text-lg text-muted", children: c.body }) }), _jsx(Reveal, { delay: 0.2, children: _jsx("div", { className: "mt-8 flex flex-wrap gap-2.5", children: c.moments.map((m) => (_jsx("span", { className: "rounded-pill border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink-soft", children: m }, m))) }) })] })] }) }));
}
