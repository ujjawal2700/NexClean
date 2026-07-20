import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, Check, X, Loader2, ArrowLeft, ShieldCheck, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useMe } from "../api/queries";
import { useUpdateProfile, useRequestPhoneChange, useConfirmPhoneChange } from "../api/mutations";
export function EditProfile() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const updateProfile = useUpdateProfile();
    const requestPhoneChange = useRequestPhoneChange();
    const confirmPhoneChange = useConfirmPhoneChange();
    const [saved, setSaved] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    // phone-change sub-flow: idle (just show current phone) -> enter (new number) -> otp (verify)
    const [phoneStep, setPhoneStep] = useState("idle");
    const [newPhone, setNewPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [phoneError, setPhoneError] = useState("");
    // Init fields
    useEffect(() => {
        if (me) {
            setName(me.name || "");
            setEmail(me.email || "");
        }
    }, [me]);
    const saveDetails = () => {
        if (!name.trim() || !email.trim())
            return;
        updateProfile.mutate({ name: name.trim(), email: email.trim() }, {
            onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            },
        });
    };
    const cancelEditing = () => {
        if (me) {
            setName(me.name || "");
            setEmail(me.email || "");
        }
        navigate("/app/profile");
    };
    const sendPhoneOtp = () => {
        if (!newPhone.trim() || newPhone.length !== 10) {
            return setPhoneError("Please enter a valid 10-digit number.");
        }
        setPhoneError("");
        requestPhoneChange.mutate(newPhone, {
            onSuccess: () => setPhoneStep("otp"),
            onError: (err) => setPhoneError(err?.message || "Failed to send OTP."),
        });
    };
    const verifyPhoneOtp = () => {
        if (!otp || otp.length !== 6)
            return;
        confirmPhoneChange.mutate({ phone: newPhone, code: otp }, {
            onSuccess: () => {
                setPhoneStep("idle");
                setNewPhone("");
                setOtp("");
                setPhoneError("");
            },
            onError: (err) => setPhoneError(err?.message || "Invalid or expired OTP."),
        });
    };
    return (_jsxs("div", { className: "mx-auto max-w-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Edit Profile" })] }), _jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-3", children: [_jsx(User, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Personal Details" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Input, { name: "name", label: "Full name", leading: _jsx(User, { className: "size-4" }), value: name, onChange: (e) => setName(e.target.value), placeholder: "Your name" }), _jsx(Input, { name: "email", label: "Email", type: "email", leading: _jsx(Mail, { className: "size-4" }), value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 pt-2", children: [_jsx(Button, { size: "sm", onClick: saveDetails, disabled: updateProfile.isPending, children: saved ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "size-4" }), " Saved"] })) : ("Save changes") }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: cancelEditing, children: [_jsx(X, { className: "size-4" }), " Cancel"] })] })] }), _jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-3", children: [_jsx(ShieldCheck, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Login Identity" })] }), _jsxs("div", { className: "rounded-2xl border border-line bg-surface-muted/45 p-5", children: [_jsx("p", { className: "mb-2 text-sm font-semibold text-ink", children: "Current Mobile Number" }), phoneStep === "idle" && (_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("span", { className: "font-display text-lg font-medium text-ink", children: ["+91 ", me?.phone] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPhoneStep("enter"), children: "Change number" })] })), phoneStep === "enter" && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-muted leading-relaxed", children: "Enter your new number. We'll send a 6-digit one-time passcode to verify ownership before updating your login identifier." }), _jsx(Input, { name: "newPhone", type: "tel", inputMode: "numeric", maxLength: 10, leading: _jsx(Phone, { className: "size-4" }), placeholder: "98765 43210", value: newPhone, onChange: (e) => setNewPhone(e.target.value.replace(/\D/g, "")), error: phoneError }), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { size: "sm", onClick: sendPhoneOtp, disabled: requestPhoneChange.isPending, children: requestPhoneChange.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : "Send OTP" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                    setPhoneStep("idle");
                                                    setNewPhone("");
                                                    setPhoneError("");
                                                }, children: "Cancel" })] })] })), phoneStep === "otp" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("p", { className: "text-xs text-muted leading-relaxed", children: ["Enter the 6-digit verification code sent to ", _jsxs("span", { className: "font-medium text-ink", children: ["+91 ", newPhone] }), "."] }), _jsx(Input, { name: "phoneOtp", inputMode: "numeric", maxLength: 6, className: "tracking-[0.5em] text-center", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, "")), error: phoneError }), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { size: "sm", onClick: verifyPhoneOtp, disabled: confirmPhoneChange.isPending, children: confirmPhoneChange.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : "Verify & Save" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                    setPhoneStep("enter");
                                                    setOtp("");
                                                    setPhoneError("");
                                                }, children: "Back" })] })] }))] })] })] }));
}
