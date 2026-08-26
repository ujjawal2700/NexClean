import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { useMe } from "../api/queries";

/**
 * Redirects to the customer login when there's no auth token, role is invalid, or token expired.
 *
 * `allowGuest` opens a screen to the "skip login" browse mode (dashboard and
 * plans). Everything else stays closed: a guest who lands on it is sent to the
 * login with `from` set, so they return to what they were after.
 */
export function ProtectedRoute({
  children,
  allowGuest = false,
}: {
  children: ReactNode;
  allowGuest?: boolean;
}) {
  const authenticated = useSessionStore((s) => s.authenticated);
  const guest = useSessionStore((s) => s.guest);
  const clear = useSessionStore((s) => s.clear);
  const location = useLocation();
  const { data: me, isError, error } = useMe();

  useEffect(() => {
    if ((isError && (error as any)?.status === 401) || (me && (me.role === "agent" || me.role === "cleaner"))) {
      clear();
    }
  }, [me, isError, error, clear]);

  if (!authenticated && allowGuest && guest) return <>{children}</>;

  if (!authenticated || (me && (me.role === "agent" || me.role === "cleaner")) || (isError && (error as any)?.status === 401)) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
