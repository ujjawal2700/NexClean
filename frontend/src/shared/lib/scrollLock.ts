import { useEffect } from "react";

/**
 * Freeze the page behind a popup.
 *
 * `body { overflow: hidden }` alone wasn't enough here: the app scrolls through
 * Lenis (smooth scroll), which keeps moving the page on wheel/trackpad, and iOS
 * Safari ignores body overflow for touch scrolling. So: pause Lenis, and pin the
 * body in place at the current offset, restoring the exact position on close.
 * Counted, so a popup opened over another popup doesn't unlock too early.
 */
type Pausable = { stop: () => void; start: () => void };

let smoothScroller: Pausable | null = null;
let locks = 0;
let savedY = 0;
let saved: { htmlOverflow: string; bodyOverflow: string; position: string; top: string; width: string } | null = null;

/** Called by SmoothScroll so locks can pause it. */
export function registerSmoothScroller(instance: Pausable | null): void {
  smoothScroller = instance;
}

export function lockScroll(): void {
  locks += 1;
  if (locks > 1 || typeof document === "undefined") return;
  const { documentElement: html, body } = document;
  savedY = window.scrollY;
  saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
  };
  smoothScroller?.stop();
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${savedY}px`;
  body.style.width = "100%";
}

export function unlockScroll(): void {
  if (locks === 0) return;
  locks -= 1;
  if (locks > 0 || typeof document === "undefined" || !saved) return;
  const { documentElement: html, body } = document;
  html.style.overflow = saved.htmlOverflow;
  body.style.overflow = saved.bodyOverflow;
  body.style.position = saved.position;
  body.style.top = saved.top;
  body.style.width = saved.width;
  window.scrollTo(0, savedY);
  smoothScroller?.start();
  saved = null;
}

/** Lock page scroll while `active` (default: while the component is mounted). */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
