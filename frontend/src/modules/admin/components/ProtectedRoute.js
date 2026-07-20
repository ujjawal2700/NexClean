import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import {} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminSession } from "../store/sessionStore";
/** Redirects to the admin login when there's no auth token. */
export function ProtectedRoute({ children }) {
    const token = useAdminSession((s) => s.token);
    const location = useLocation();
    if (!token) {
        return _jsx(Navigate, { to: "/admin/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(_Fragment, { children: children });
}
