import { type ReactNode } from "react";
type RevealProps = {
    children: ReactNode;
    className?: string;
    /** stagger delay in seconds */
    delay?: number;
    /** travel distance in px */
    y?: number;
    once?: boolean;
};
/**
 * Scroll-into-view reveal for any block. Fades + lifts on enter.
 * Use <RevealGroup> to stagger a set of children.
 */
export declare function Reveal({ children, className, delay, y, once }: RevealProps): import("react").JSX.Element;
export declare function RevealGroup({ children, className }: {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export declare function RevealItem({ children, className }: {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export {};
