import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from "react";
import { cn } from "@shared/lib/utils";
/**
 * Themed text input with optional label, leading element, hint and error.
 * Reused across all forms (auth, address, profile) in every module.
 */
export const Input = forwardRef(({ className, label, hint, error, leading, trailing, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (_jsxs("div", { className: "w-full", children: [label && (_jsx("label", { htmlFor: inputId, className: "mb-1.5 block text-sm font-medium text-ink", children: label })), _jsxs("div", { className: cn("flex items-center gap-2.5 rounded-2xl border bg-surface px-4 transition-colors", "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15", error ? "border-red-400" : "border-line"), children: [leading && _jsx("span", { className: "text-muted flex-shrink-0", children: leading }), _jsx("input", { ref: ref, id: inputId, className: cn("h-12 w-full bg-transparent text-ink outline-none placeholder:text-muted/70", className), ...props }), trailing && _jsx("span", { className: "text-muted flex-shrink-0 flex items-center", children: trailing })] }), error ? (_jsx("p", { className: "mt-1.5 text-xs text-red-500", children: error })) : (hint && _jsx("p", { className: "mt-1.5 text-xs text-muted", children: hint }))] }));
});
Input.displayName = "Input";
