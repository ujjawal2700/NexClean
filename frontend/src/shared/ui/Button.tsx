import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium " +
    "transition-[transform,box-shadow,background-color,color] duration-300 ease-[var(--ease-out-expo)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] " +
          "hover:shadow-[0_28px_80px_-18px_rgba(79,124,255,0.6)] hover:-translate-y-0.5",
        accent:
          "bg-gradient-to-r from-accent to-primary text-white shadow-[var(--shadow-glow)] hover:-translate-y-0.5",
        outline:
          "border border-line bg-surface/60 text-ink backdrop-blur hover:border-primary/40 hover:text-primary",
        ghost: "text-ink hover:bg-surface-muted",
        glass: "glass text-ink hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[0.95rem]",
        lg: "h-14 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** render as the child element (e.g. a <Link>) instead of a <button> */
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
