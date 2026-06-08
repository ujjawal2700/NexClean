import { useRef, useCallback } from "react";

/**
 * Magnetic hover effect — the element gently follows the cursor and springs
 * back on leave. Returns a ref + handlers to spread on any element.
 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 0.35) {
  const ref = useRef<T>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    },
    [strength],
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
