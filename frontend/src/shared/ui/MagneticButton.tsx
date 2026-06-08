import { useMagnetic } from "@shared/hooks/useMagnetic";
import { Button, type ButtonProps } from "./Button";

/**
 * Button with the magnetic cursor-follow micro-interaction applied.
 * Drop-in replacement for <Button> where extra delight is wanted (CTAs).
 */
export function MagneticButton({ strength = 0.4, ...props }: ButtonProps & { strength?: number }) {
  const { ref, onMouseMove, onMouseLeave } = useMagnetic<HTMLButtonElement>(strength);
  return (
    <Button
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ transition: "transform 0.4s var(--ease-spring), box-shadow 0.3s, background-color 0.3s" }}
      {...props}
    />
  );
}
