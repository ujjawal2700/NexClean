import { type HTMLAttributes } from "react";
type SectionProps = HTMLAttributes<HTMLElement> & {
    /** render without the inner Container (for full-bleed sections) */
    bleed?: boolean;
    containerClassName?: string;
};
/**
 * Vertical rhythm wrapper for page sections. Generous spacing by default.
 */
export declare function Section({ className, children, bleed, containerClassName, ...props }: SectionProps): import("react").JSX.Element;
export {};
