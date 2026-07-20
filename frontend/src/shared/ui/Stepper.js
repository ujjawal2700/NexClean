import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@shared/lib/utils";
/** Progress indicator for multi-step auth/signup flows. `current` is 0-indexed. */
export function Stepper({ steps, current }) {
    return (_jsxs("div", { className: "mb-5", children: [_jsxs("p", { className: "text-xs font-medium text-muted", children: ["Step ", current + 1, " of ", steps.length, " \u00B7 ", steps[current]] }), _jsx("div", { className: "mt-2 flex gap-1.5", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": steps.length, "aria-valuenow": current + 1, "aria-valuetext": `Step ${current + 1} of ${steps.length}: ${steps[current]}`, children: steps.map((step, i) => (_jsx("span", { className: cn("h-1.5 flex-1 rounded-full transition-colors", i <= current ? "bg-primary" : "bg-line") }, step))) })] }));
}
