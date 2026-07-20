import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Phone, ArrowRight, ArrowLeft, Loader2, BadgeCheck, UserX, Mail, MapPin, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { GlassCard } from "@shared/ui/GlassCard";
import { ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import { meKey, useSendOtp, useVerifyOtp } from "../api/agent.api";
import { Stepper } from "@shared/ui/Stepper";
export function Login() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const setToken = useAgentSession((s) => s.setToken);
    const token = useAgentSession((s) => s.token);
    const [step, setStep] = useState("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
    const phoneRef = useRef("");
    const sendOtp = useSendOtp();
    const verifyOtp = useVerifyOtp();
    if (token)
        return _jsx(Navigate, { to: "/agent", replace: true });
    const send = async () => {
        if (!/^\d{10}$/.test(phone))
            return setError("Enter a valid 10-digit number");
        setError("");
        phoneRef.current = phone;
        try {
            await sendOtp.mutateAsync(phone);
            setStep("otp");
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't send OTP. Is the API running?");
        }
    };
    const verify = async () => {
        if (otp.length !== 6)
            return setError("Enter the 6-digit code");
        setError("");
        try {
            const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
            if (user.role !== "agent" && user.role !== "cleaner") {
                setError("This number isn't registered as an agent.");
                return;
            }
            setToken(token);
            qc.setQueryData(meKey, user);
            navigate("/agent", { replace: true });
        }
        catch (e) {
            const msg = e instanceof ApiError ? e.message : String(e);
            if (msg.includes("ACCOUNT_DEACTIVATED") || msg.includes("deactivated") || msg.includes("suspended")) {
                setShowDeactivatedModal(true);
                setError("Your agent account has been deactivated.");
            }
            else {
                setError(msg || "Verification failed");
            }
        }
    };
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Link, { to: "/agent", children: _jsx(Logo, { variant: "full" }) }) }), _jsxs("div", { className: "glass rounded-card p-8 shadow-[var(--shadow-lift)]", children: [_jsx(Stepper, { steps: ["Number", "Verify"], current: step === "phone" ? 0 : 1 }), step === "phone" ? (_jsxs(_Fragment, { children: [_jsx(Badge, { className: "mb-5", children: "Agent Login" }), _jsx("h1", { className: "text-2xl text-ink", children: "Welcome, specialist" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Sign in to see today's jobs and start earning." }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "phone", type: "tel", autoComplete: "tel", label: "Registered mobile number", inputMode: "numeric", maxLength: 10, placeholder: "90000 00001", leading: _jsx(Phone, { className: "size-4" }), value: phone, onChange: (e) => setPhone(e.target.value.replace(/\D/g, "")), onKeyDown: (e) => e.key === "Enter" && send(), hint: "Demo agent: 9000000001", error: error }), _jsx(Button, { className: "w-full", onClick: send, disabled: sendOtp.isPending, children: sendOtp.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsxs(_Fragment, { children: ["Send OTP ", _jsx(ArrowRight, { className: "size-4" })] }) })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => { setStep("phone"); setError(""); }, className: "mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary", children: [_jsx(ArrowLeft, { className: "size-4" }), " Change number"] }), _jsx("h1", { className: "text-2xl text-ink", children: "Verify your number" }), _jsxs("p", { className: "mt-2 text-sm text-muted", children: ["Enter the 6-digit code sent to ", _jsxs("span", { className: "font-medium text-ink", children: ["+91 ", phoneRef.current] }), "."] }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "otp", autoComplete: "one-time-code", label: "One-time code", inputMode: "numeric", maxLength: 6, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", className: "tracking-[0.5em]", value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, "")), onKeyDown: (e) => e.key === "Enter" && verify(), hint: "Demo code: 123456", error: error }), _jsx(Button, { className: "w-full", onClick: verify, disabled: verifyOtp.isPending, children: verifyOtp.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsxs(_Fragment, { children: ["Verify & continue ", _jsx(ArrowRight, { className: "size-4" })] }) })] })] })), _jsxs("p", { className: "mt-6 flex items-center justify-center gap-2 text-xs text-muted", children: [_jsx(BadgeCheck, { className: "size-3.5 text-primary" }), " Verified specialists only"] })] }), _jsxs("p", { className: "mt-6 text-center text-sm text-muted", children: ["New cleaner?", " ", _jsx(Link, { to: "/agent/signup", className: "font-medium text-primary hover:underline", children: "Apply to join" })] })] }), showDeactivatedModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in", children: _jsxs(GlassCard, { className: "w-full max-w-md space-y-6 bg-surface p-6 shadow-2xl border border-line relative", children: [_jsx("button", { onClick: () => setShowDeactivatedModal(false), className: "absolute top-4 right-4 text-muted hover:text-ink p-1 rounded-lg transition-colors", children: _jsx(X, { className: "size-5" }) }), _jsxs("div", { className: "space-y-3 text-center pt-2", children: [_jsx("div", { className: "mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600", children: _jsx(UserX, { className: "size-7" }) }), _jsx("h3", { className: "font-display text-2xl font-bold text-ink", children: "Account Deactivated" }), _jsx("p", { className: "text-sm text-muted leading-relaxed", children: "Your agent profile has been deactivated. Only an administrator can reactivate your account. Please contact customer support for assistance." })] }), _jsxs("div", { className: "space-y-3 rounded-2xl border border-line bg-surface-muted/50 p-4 text-left text-xs", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Phone, { className: "size-4 text-primary shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-muted font-medium", children: "Customer Support Phone" }), _jsx("p", { className: "font-bold text-ink text-sm", children: "+91 98765 43210" })] })] }), _jsxs("div", { className: "flex items-center gap-3 border-t border-line/40 pt-2.5", children: [_jsx(Mail, { className: "size-4 text-primary shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-muted font-medium", children: "Support Email" }), _jsx("p", { className: "font-bold text-ink text-sm", children: "support@nexclean.in" })] })] }), _jsxs("div", { className: "flex items-center gap-3 border-t border-line/40 pt-2.5", children: [_jsx(MapPin, { className: "size-4 text-primary shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-muted font-medium", children: "Office Address" }), _jsx("p", { className: "font-medium text-ink", children: "NexClean HQ, 102 Sector 5, HSR Layout, Bengaluru 560102" })] })] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [_jsx("a", { href: "tel:+919876543210", className: "flex-1", children: _jsx(Button, { className: "w-full rounded-xl", children: "Call Support" }) }), _jsx(Button, { variant: "outline", onClick: () => setShowDeactivatedModal(false), className: "flex-1 rounded-xl", children: "Close" })] })] }) }))] }));
}
