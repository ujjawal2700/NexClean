import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import {} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Hourglass, Ban, LogOut } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useAgentSession } from "../store/sessionStore";
import { useAgentMe } from "../api/agent.api";
/**
 * Sits between auth and the full agent dashboard. New signups land in
 * "pending" until admin approves their KYC; suspended agents are locked out
 * of jobs entirely. Both get a status screen instead of the dashboard chrome.
 */
export function KycGate({ children }) {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const clear = useAgentSession((s) => s.clear);
    const { data: me, isLoading } = useAgentMe();
    const onLogout = () => {
        clear();
        qc.clear();
        navigate("/agent/login");
    };
    if (isLoading || !me)
        return null;
    if (me.agentStatus === "pending" || me.agentStatus === "suspended") {
        const pending = me.agentStatus === "pending";
        return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md text-center", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Logo, { variant: "full" }) }), _jsxs("div", { className: "glass rounded-card p-8 shadow-[var(--shadow-lift)]", children: [_jsx("span", { className: "mx-auto grid size-14 place-items-center rounded-full " +
                                        (pending ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"), children: pending ? _jsx(Hourglass, { className: "size-6" }) : _jsx(Ban, { className: "size-6" }) }), _jsx("h1", { className: "mt-5 text-2xl text-ink", children: pending ? "Application under review" : "Account suspended" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: pending
                                        ? "Thanks for applying, " +
                                            me.name +
                                            ". Our team is verifying your KYC documents. You'll be able to go online and receive jobs once approved."
                                        : "Your account has been suspended by NexClean operations. Contact support if you believe this is a mistake." }), _jsxs(Button, { variant: "outline", className: "mt-6 w-full", onClick: onLogout, children: [_jsx(LogOut, { className: "size-4" }), " Log out"] })] })] })] }));
    }
    return _jsx(_Fragment, { children: children });
}
