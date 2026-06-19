import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminSession } from "../store/sessionStore";

/** Redirects to the admin login when there's no auth token. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAdminSession((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
