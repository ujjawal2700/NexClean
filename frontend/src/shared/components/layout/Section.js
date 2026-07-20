import { jsx as _jsx } from "react/jsx-runtime";
import {} from "react";
import { cn } from "@shared/lib/utils";
import { Container } from "./Container";
/**
 * Vertical rhythm wrapper for page sections. Generous spacing by default.
 */
export function Section({ className, children, bleed = false, containerClassName, ...props }) {
    return (_jsx("section", { className: cn("relative py-24 md:py-32", className), ...props, children: bleed ? children : _jsx(Container, { className: containerClassName, children: children }) }));
}
