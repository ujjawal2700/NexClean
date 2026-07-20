import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/**
 * Merge conditional class names while resolving Tailwind conflicts.
 * Used by every shared UI primitive.
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
