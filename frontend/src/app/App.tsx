import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { SmoothScroll } from "@shared/motion/SmoothScroll";
import { Grain } from "@shared/components/visual/Grain";
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
          <AppRoutes />
        </SmoothScroll>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
