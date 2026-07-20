import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAgentSession } from "../store/sessionStore";
import { useAgentMe } from "../api/agent.api";
/** Redirects to the agent login when there's no auth token, role is invalid, or token expired. */
export function ProtectedRoute({ children }) {
    const token = useAgentSession((s) => s.token);
    const clear = useAgentSession((s) => s.clear);
    const location = useLocation();
    const { data: me, isError, error } = useAgentMe();
    useEffect(() => {
        if ((isError && error?.status === 401) || (me && me.role !== "agent" && me.role !== "cleaner")) {
            clear();
        }
    }, [me, isError, error, clear]);
    if (!token || (me && me.role !== "agent" && me.role !== "cleaner") || (isError && error?.status === 401)) {
        return _jsx(Navigate, { to: "/agent/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(_Fragment, { children: children });
}
