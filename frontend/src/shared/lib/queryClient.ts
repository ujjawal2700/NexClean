import { QueryClient } from "@tanstack/react-query";

/** App-wide React Query client with sensible defaults for this app. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
