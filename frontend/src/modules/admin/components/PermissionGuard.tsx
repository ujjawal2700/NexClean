import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminSession } from "../store/sessionStore";

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const permissions = useAdminSession((s) => s.permissions) || [];

  // If superadmin (has "*"), allow everything.
  // Otherwise, require the specific permission key.
  const hasAccess = permissions.includes("*") || permissions.includes(permission);

  if (!hasAccess) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
