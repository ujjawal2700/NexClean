import { type ReactNode } from "react";
type StaticPageShellProps = {
    eyebrow: string;
    title: string;
    subtitle?: string;
    children: ReactNode;
};
/** Shared chrome for marketing/legal content pages — Navbar + hero header + prose + Footer. */
export declare function StaticPageShell({ eyebrow, title, subtitle, children }: StaticPageShellProps): import("react").JSX.Element;
export {};
