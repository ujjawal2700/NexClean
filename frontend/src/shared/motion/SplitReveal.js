import { useEffect, useRef, createElement } from "react";
import SplitType from "split-type";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
/**
 * Word-by-word headline reveal using SplitType + GSAP.
 * The signature premium text animation for hero & section titles.
 */
export function SplitReveal({ text, as = "h2", className, onScroll = false, delay = 0, }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced)
            return;
        const split = new SplitType(el, { types: "lines,words", lineClass: "split-line" });
        // keep each line clipping its words for a clean wipe
        el.querySelectorAll(".split-line").forEach((line) => {
            line.style.overflow = "hidden";
            line.style.paddingBottom = "0.08em";
        });
        const tween = gsap.from(split.words, {
            yPercent: 115,
            opacity: 0,
            duration: 1,
            ease: "expo.out",
            stagger: 0.045,
            delay,
            ...(onScroll
                ? { scrollTrigger: { trigger: el, start: "top 82%", once: true } }
                : {}),
        });
        return () => {
            tween.scrollTrigger?.kill();
            tween.kill();
            split.revert();
        };
    }, [text, onScroll, delay]);
    return createElement(as, { ref, className }, text);
}
