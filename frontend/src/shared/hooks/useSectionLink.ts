import { useNavigate, useLocation } from "react-router-dom";
import { useSmoothScroll } from "@shared/motion/SmoothScroll";

/**
 * Navigates to a landing-page section (e.g. "#plans") whether the user is
 * already on "/" (smooth-scrolls in place) or on another route (routes home
 * first, then HomeHashScroll picks up the hash once the section mounts).
 */
export function useSectionLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scrollTo } = useSmoothScroll();

  return (hash: string) => {
    if (location.pathname === "/") {
      scrollTo(hash);
    } else {
      navigate(`/${hash}`);
    }
  };
}
