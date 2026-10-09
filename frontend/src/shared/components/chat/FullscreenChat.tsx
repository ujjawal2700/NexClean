import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Portal escapes page padding, glass transforms and the app navigation. */
export function FullscreenChat({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      document.body.style.overflow = previous;
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return createPortal(<div data-testid="support-chat" style={{ height: viewport.height, top: viewport.top }} className="fixed inset-x-0 z-[100] flex min-h-0 flex-col bg-surface pt-[env(safe-area-inset-top)]">{children}</div>, document.body);
}
