import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ScrollTarget = string | HTMLElement | number;
const LenisContext = createContext<{ scrollTo: (target: ScrollTarget) => void }>({
  scrollTo: () => {},
});

/** Smoothly scroll to an element/selector/offset, falling back to native. */
export function useSmoothScroll() {
  return useContext(LenisContext);
}

/**
 * App-wide smooth scrolling via Lenis, synced to GSAP ScrollTrigger so
 * scroll-driven animations stay in lockstep. Exposes scrollTo for anchor nav.
 * Respects prefers-reduced-motion (disables smoothing).
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const instance = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    setLenis(instance);

    instance.on("scroll", ScrollTrigger.update);

    const onRaf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onRaf);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  const scrollTo = useCallback(
    (target: ScrollTarget) => {
      if (lenis) {
        lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      } else if (typeof target === "string") {
        document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
      }
    },
    [lenis],
  );

  return <LenisContext.Provider value={{ scrollTo }}>{children}</LenisContext.Provider>;
}
