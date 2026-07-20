import { type VariantProps } from "class-variance-authority";
declare const buttonVariants: (props?: ({
    variant?: "primary" | "accent" | "outline" | "ghost" | "glass" | null | undefined;
    size?: "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
    /** render as the child element (e.g. a <Link>) instead of a <button> */
    asChild?: boolean;
};
export declare const Button: import("react").ForwardRefExoticComponent<import("react").ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<(props?: ({
    variant?: "primary" | "accent" | "outline" | "ghost" | "glass" | null | undefined;
    size?: "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string> & {
    /** render as the child element (e.g. a <Link>) instead of a <button> */
    asChild?: boolean;
} & import("react").RefAttributes<HTMLButtonElement>>;
export { buttonVariants };
