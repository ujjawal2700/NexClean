import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { SmoothScroll } from "@shared/motion/SmoothScroll";
import { Grain } from "@shared/components/visual/Grain";
import { RouteScrollReset } from "@shared/components/RouteScrollReset";
import { queryClient } from "@shared/lib/queryClient";
import { AppRoutes } from "@/routes";

/**
 * Root application shell: server-state provider + router + smooth scrolling.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SmoothScroll>
          <Grain />
          <RouteScrollReset />
          <AppRoutes />
        </SmoothScroll>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
