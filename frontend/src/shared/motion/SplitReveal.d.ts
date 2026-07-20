import { type ElementType } from "react";
type SplitRevealProps = {
    text: string;
    as?: ElementType;
    className?: string;
    /** animate when scrolled into view instead of on mount */
    onScroll?: boolean;
    delay?: number;
};
/**
 * Word-by-word headline reveal using SplitType + GSAP.
 * The signature premium text animation for hero & section titles.
 */
export declare function SplitReveal({ text, as, className, onScroll, delay, }: SplitRevealProps): import("react").ReactElement<any, string | import("react").JSXElementConstructor<any>>;
export {};
