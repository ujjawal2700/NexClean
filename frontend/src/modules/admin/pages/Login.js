import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { ApiError } from "@shared/lib/api";
import { useAdminSession } from "../store/sessionStore";
import { useAdminLogin } from "../api/admin.api";
export function Login() {
    const navigate = useNavigate();
    const token = useAdminSession((s) => s.token);
    const setSession = useAdminSession((s) => s.setSession);
    const login = useAdminLogin();
    const [email, setEmail] = useState("superadmin@gmail.com");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    // Already logged in — skip the login form entirely. Must come after every
    // hook call above (Rules of Hooks): this becomes true mid-session right
    // after a successful login, and an earlier return here would make this
    // component render fewer hooks than its previous pass.
    if (token)
        return _jsx(Navigate, { to: "/admin", replace: true });
    const submit = async () => {
        if (!/^\S+@\S+\.\S+$/.test(email))
            return setError("Enter a valid email");
        if (password.length < 1)
            return setError("Enter your password");
        setError("");
        try {
            const { token, user } = await login.mutateAsync({ email, password });
            setSession(token, user.name, user.permissions || []);
            navigate("/admin", { replace: true });
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Login failed. Is the API running?");
        }
    };
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Link, { to: "/admin", children: _jsx(Logo, { variant: "full", className: "h-20 md:h-24" }) }) }), _jsxs("div", { className: "glass rounded-card p-8 shadow-[var(--shadow-lift)]", children: [_jsx(Badge, { className: "mb-5", children: "Admin Console" }), _jsx("h1", { className: "text-2xl text-ink", children: "Sign in to manage NexClean" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Operations, agents, pricing & campaigns." }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "email", type: "email", label: "Email", leading: _jsx(Mail, { className: "size-4" }), value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(Input, { name: "password", type: showPassword ? "text" : "password", label: "Password", leading: _jsx(Lock, { className: "size-4" }), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit(), hint: "Demo: superadmin@gmail.com / password123", error: error, trailing: _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), className: "text-muted hover:text-ink transition-colors focus:outline-none cursor-pointer", "aria-label": showPassword ? "Hide password" : "Show password", children: showPassword ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) }) }), _jsx(Button, { className: "w-full", onClick: submit, disabled: login.isPending, children: login.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsxs(_Fragment, { children: ["Sign in ", _jsx(ArrowRight, { className: "size-4" })] }) })] }), _jsxs("p", { className: "mt-6 flex items-center justify-center gap-2 text-xs text-muted", children: [_jsx(ShieldCheck, { className: "size-3.5 text-primary" }), " Restricted access \u00B7 authorized staff only"] })] })] })] }));
}
