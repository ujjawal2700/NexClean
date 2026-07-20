import { jsx as _jsx } from "react/jsx-runtime";
import {} from "react";
import { cn } from "@shared/lib/utils";
/**
 * Small pill label — used for eyebrows, tags, and status chips.
 */
export function Badge({ className, ...props }) {
    return (_jsx("span", { className: cn("inline-flex items-center gap-2 rounded-pill border border-primary/15 bg-primary/8 " +
            "px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-primary", className), ...props }));
}
