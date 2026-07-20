import { jsx as _jsx } from "react/jsx-runtime";
import {} from "react";
import { cn } from "@shared/lib/utils";
/**
 * Centered max-width content wrapper with responsive gutters.
 */
export function Container({ className, ...props }) {
    return (_jsx("div", { className: cn("mx-auto w-full max-w-[1200px] px-6 md:px-10", className), ...props }));
}
