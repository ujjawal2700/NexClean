import { type ReactNode } from "react";
type ScrollTarget = string | HTMLElement | number;
/** Smoothly scroll to an element/selector/offset, falling back to native. */
export declare function useSmoothScroll(): {
    scrollTo: (target: ScrollTarget) => void;
};
/**
 * App-wide smooth scrolling via Lenis, synced to GSAP ScrollTrigger so
 * scroll-driven animations stay in lockstep. Exposes scrollTo for anchor nav.
 * Respects prefers-reduced-motion (disables smoothing).
 */
export declare function SmoothScroll({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export {};
