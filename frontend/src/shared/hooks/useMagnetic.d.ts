/**
 * Magnetic hover effect — the element gently follows the cursor and springs
 * back on leave. Returns a ref + handlers to spread on any element.
 */
export declare function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength?: number): {
    ref: import("react").RefObject<T | null>;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
};
