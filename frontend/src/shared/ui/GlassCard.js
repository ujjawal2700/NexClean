import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { cn } from "@shared/lib/utils";
/**
 * Frosted surface card — the workhorse container across all modules.
 */
export const GlassCard = forwardRef(({ className, interactive = false, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("glass rounded-card p-6 shadow-[var(--shadow-soft)]", interactive &&
        "transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] " +
            "hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]", className), ...props })));
GlassCard.displayName = "GlassCard";
