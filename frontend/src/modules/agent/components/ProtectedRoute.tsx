import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAgentSession } from "../store/sessionStore";
import { useAgentMe } from "../api/agent.api";

/** Redirects to the agent login when there's no auth token, role is invalid, or token expired. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const authenticated = useAgentSession((s) => s.authenticated);
  const clear = useAgentSession((s) => s.clear);
  const location = useLocation();
  const { data: me, isError, error } = useAgentMe();

  useEffect(() => {
    if ((isError && (error as any)?.status === 401) || (me && me.role !== "agent" && me.role !== "cleaner")) {
      clear();
    }
  }, [me, isError, error, clear]);

  if (!authenticated || (me && me.role !== "agent" && me.role !== "cleaner") || (isError && (error as any)?.status === 401)) {
    return <Navigate to="/agent/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}


