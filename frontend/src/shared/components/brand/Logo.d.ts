type LogoProps = {
    /** "full" = the full lockup, "mark" = small square crop for tight spaces */
    variant?: "full" | "mark" | "wordmark";
    className?: string;
};
/** NexClean brand mark. Single source image at /public/logo.png, swap there to rebrand. */
export declare function Logo({ variant, className }: LogoProps): import("react").JSX.Element;
export {};
