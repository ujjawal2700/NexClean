import { type InputHTMLAttributes, type ReactNode } from "react";
/**
 * Themed text input with optional label, leading element, hint and error.
 * Reused across all forms (auth, address, profile) in every module.
 */
export declare const Input: import("react").ForwardRefExoticComponent<InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    hint?: string;
    error?: string;
    /** icon or element rendered at the left inside the field */
    leading?: ReactNode;
    /** icon or element rendered at the right inside the field */
    trailing?: ReactNode;
} & import("react").RefAttributes<HTMLInputElement>>;
