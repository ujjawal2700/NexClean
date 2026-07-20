import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from "react";
import { cn } from "@shared/lib/utils";
import { Badge } from "./Badge";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
/**
 * Consistent section header — eyebrow badge + split-text title + subtitle.
 * Reused by every landing section to keep rhythm consistent.
 */
export function SectionHeading({ eyebrow, title, subtitle, align = "left", className, }) {
    const centered = align === "center";
    return (_jsxs("div", { className: cn("max-w-2xl", centered && "mx-auto text-center", className), children: [eyebrow && (_jsx(Reveal, { children: _jsx(Badge, { children: eyebrow }) })), _jsx(SplitReveal, { onScroll: true, as: "h2", text: title, className: "mt-5 text-balance text-4xl text-ink sm:text-5xl" }), subtitle && (_jsx(Reveal, { delay: 0.1, children: _jsx("p", { className: cn("mt-5 text-lg text-muted", centered && "mx-auto"), children: subtitle }) }))] }));
}
