/**
 * Animate a number from 0 → target once it scrolls into view.
 * Returns the current value and a ref to attach to the element.
 */
export declare function useCountUp(target: number, duration?: number): {
    ref: import("react").RefObject<HTMLSpanElement | null>;
    value: number;
};
