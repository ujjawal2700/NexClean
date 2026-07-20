import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check } from "lucide-react";
import { cn } from "@shared/lib/utils";
export const STEP_LABELS = ["Vehicle", "Package", "Schedule", "Address", "Payment"];
export function Stepper({ current }) {
    return (_jsx("ol", { className: "flex items-center gap-2", children: STEP_LABELS.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (_jsxs("li", { className: "flex flex-1 items-center gap-2 last:flex-none", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors", done && "bg-primary text-white", active && "bg-primary/10 text-primary ring-2 ring-primary/30", !done && !active && "bg-surface-muted text-muted"), children: done ? _jsx(Check, { className: "size-4" }) : i + 1 }), _jsx("span", { className: cn("hidden text-sm font-medium sm:inline", active ? "text-ink" : "text-muted"), children: label })] }), i < STEP_LABELS.length - 1 && (_jsx("span", { className: cn("h-0.5 flex-1 rounded-full transition-colors", done ? "bg-primary" : "bg-line") }))] }, label));
        }) }));
}
