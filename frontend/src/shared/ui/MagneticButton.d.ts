import { type ButtonProps } from "./Button";
/**
 * Button with the magnetic cursor-follow micro-interaction applied.
 * Drop-in replacement for <Button> where extra delight is wanted (CTAs).
 */
export declare function MagneticButton({ strength, ...props }: ButtonProps & {
    strength?: number;
}): import("react").JSX.Element;
