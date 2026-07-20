import { type ReactNode } from "react";
type SectionHeadingProps = {
    eyebrow?: string;
    title: string;
    subtitle?: ReactNode;
    align?: "left" | "center";
    className?: string;
};
/**
 * Consistent section header — eyebrow badge + split-text title + subtitle.
 * Reused by every landing section to keep rhythm consistent.
 */
export declare function SectionHeading({ eyebrow, title, subtitle, align, className, }: SectionHeadingProps): import("react").JSX.Element;
export {};
