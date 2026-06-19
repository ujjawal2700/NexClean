import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAgentSession } from "../store/sessionStore";

/** Redirects to the agent login when there's no auth token. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAgentSession((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/agent/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
