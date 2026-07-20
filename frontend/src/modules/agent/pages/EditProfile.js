import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Check, X, ArrowLeft, ShieldCheck, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgentMe, useUpdateName } from "../api/agent.api";
export function EditProfile() {
    const navigate = useNavigate();
    const { data: me } = useAgentMe();
    const updateName = useUpdateName();
    const [displayName, setDisplayName] = useState("");
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        if (me?.name) {
            setDisplayName(me.name);
        }
    }, [me]);
    const save = () => {
        updateName.mutate(displayName.trim() || "Specialist", {
            onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            },
        });
    };
    const cancel = () => {
        if (me?.name) {
            setDisplayName(me.name);
        }
        navigate("/agent/profile");
    };
    return (_jsxs("div", { className: "mx-auto max-w-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Edit Profile" })] }), _jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-3", children: [_jsx(User, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Personal Details" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Input, { name: "name", label: "Full name", leading: _jsx(User, { className: "size-4" }), value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "Rohit Kumar" }), _jsx(Input, { name: "phone", label: "Mobile number", leading: _jsx(Phone, { className: "size-4" }), value: me?.phone ?? "", disabled: true })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 pt-2", children: [_jsx(Button, { size: "sm", onClick: save, disabled: updateName.isPending, children: saved ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "size-4" }), " Saved"] })) : ("Save changes") }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: cancel, children: [_jsx(X, { className: "size-4" }), " Cancel"] })] })] }), _jsxs(GlassCard, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-2", children: [_jsx(ShieldCheck, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Login Identity" })] }), _jsx("p", { className: "text-sm text-muted leading-relaxed", children: "Your phone number is verified during sign-up and KYC verification. To change your registered phone number, please contact support." })] })] }));
}
