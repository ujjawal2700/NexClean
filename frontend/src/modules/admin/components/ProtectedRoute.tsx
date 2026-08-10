import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminSession } from "../store/sessionStore";

/** Redirects to the admin login when there's no auth token. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const authenticated = useAdminSession((s) => s.authenticated);
  const location = useLocation();

  if (!authenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
