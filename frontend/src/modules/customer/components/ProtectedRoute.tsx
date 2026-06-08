import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/** Redirects to the customer login when not authenticated. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
