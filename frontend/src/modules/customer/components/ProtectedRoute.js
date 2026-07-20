import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { useMe } from "../api/queries";
/** Redirects to the customer login when there's no auth token, role is invalid, or token expired. */
export function ProtectedRoute({ children }) {
    const token = useSessionStore((s) => s.token);
    const clear = useSessionStore((s) => s.clear);
    const location = useLocation();
    const { data: me, isError, error } = useMe();
    useEffect(() => {
        if ((isError && error?.status === 401) || (me && (me.role === "agent" || me.role === "cleaner"))) {
            clear();
        }
    }, [me, isError, error, clear]);
    if (!token || (me && (me.role === "agent" || me.role === "cleaner")) || (isError && error?.status === 401)) {
        return _jsx(Navigate, { to: "/app/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(_Fragment, { children: children });
}
