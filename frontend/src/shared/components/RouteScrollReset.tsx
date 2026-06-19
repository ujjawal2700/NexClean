import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Jumps to the top on every route change, unless the new URL carries a hash (anchor nav handles that). */
export function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}
