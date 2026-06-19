import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";

/** Redirects to the customer login when there's no auth token. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useSessionStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
