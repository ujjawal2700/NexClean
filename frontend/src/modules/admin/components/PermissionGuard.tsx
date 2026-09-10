import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminSession } from "../store/sessionStore";

const NAV_PERMISSIONS = [
  { to: "/admin", permission: "dashboard" },
  { to: "/admin/bookings", permission: "bookings" },
  { to: "/admin/dispatch", permission: "bookings" },
  { to: "/admin/off-peak-hours", permission: "off-peak-hours" },
  { to: "/admin/customers", permission: "customers" },
  { to: "/admin/agents", permission: "agents" },
  { to: "/admin/agent-verification", permission: "agents" },
  { to: "/admin/leads", permission: "leads" },
  { to: "/admin/payments", permission: "payments" },
  { to: "/admin/pricing", permission: "pricing" },
  { to: "/admin/area-alerts", permission: "area-alerts" },
  { to: "/admin/notifications", permission: "notifications" },
  { to: "/admin/plans", permission: "plans" },
  { to: "/admin/locations", permission: "locations" },
  { to: "/admin/vehicle-categories", permission: "vehicle-categories" },
  { to: "/admin/vehicle-brands", permission: "vehicle-brands" },
  { to: "/admin/promotions", permission: "promotions" },
  { to: "/admin/special-coupons", permission: "special-coupons" },
  { to: "/admin/referrals", permission: "referrals" },
  { to: "/admin/content", permission: "content" },
  { to: "/admin/reports", permission: "reports" },
  { to: "/admin/roles", permission: "roles" },
  { to: "/admin/support", permission: "chat" },
];

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const permissions = useAdminSession((s) => s.permissions) || [];
  const location = useLocation();

  const hasAccess = permissions.includes("*") || permissions.includes(permission);

  if (!hasAccess) {
    // Find the first navigation route the user actually has access to
    const firstAllowed = NAV_PERMISSIONS.find((item) =>
      permissions.includes("*") || permissions.includes(item.permission)
    );

    if (firstAllowed) {
      // Avoid infinite loop if we're redirecting to where we already are
      if (location.pathname === firstAllowed.to) {
        return (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8 glass rounded-2xl max-w-xl mx-auto my-12">
            <div className="size-16 rounded-full bg-red-500/10 grid place-items-center mb-6">
              <span className="text-red-500 text-3xl font-semibold">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">Section Access Denied</h1>
            <p className="text-muted text-sm max-w-md mb-6">
              Your account role does not have permission to view this section. Please ask a Super Admin to adjust your role's permissions.
            </p>
          </div>
        );
      }
      return <Navigate to={firstAllowed.to} replace />;
    }

    // If they have no permissions at all, show the Access Denied screen
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8 glass rounded-2xl max-w-xl mx-auto my-12">
        <div className="size-16 rounded-full bg-red-500/10 grid place-items-center mb-6">
          <span className="text-red-500 text-3xl font-semibold">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Access Denied</h1>
        <p className="text-muted text-sm max-w-md">
          Your account does not have any assigned roles or permissions. Please contact a Super Admin to grant you access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
