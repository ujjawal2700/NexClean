import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names while resolving Tailwind conflicts.
 * Used by every shared UI primitive.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
