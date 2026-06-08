import { BrowserRouter } from "react-router-dom";
import { SmoothScroll } from "@shared/motion/SmoothScroll";
import { Grain } from "@shared/components/visual/Grain";
import { AppRoutes } from "@/routes";

/**
 * Root application shell: router + app-wide smooth scrolling + grain overlay.
 * Global providers (query client, auth, store) get added here in later phases.
 */
export function App() {
  return (
    <BrowserRouter>
      <SmoothScroll>
        <Grain />
        <AppRoutes />
      </SmoothScroll>
    </BrowserRouter>
  );
}
