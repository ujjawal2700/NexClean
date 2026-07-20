import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { User, Phone, MapPin, CreditCard, Camera, Check, ArrowRight, ArrowLeft, BadgeCheck, Loader2, } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import { useAgentSignup, useSendOtp, useVerifyOtp, meKey } from "../api/agent.api";
function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
/**
 * Phone camera photos are often 3-8MB; base64-inflated that can blow past the
 * upload limit and crawl on mobile data. Downscale + re-encode as JPEG first.
 * Falls back to the raw file if the canvas pipeline isn't available.
 */
async function fileToCompressedDataUri(file, maxDim = 1600, quality = 0.8) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const width = Math.round(bitmap.width * scale);
        const height = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw new Error("Canvas unavailable");
        ctx.drawImage(bitmap, 0, 0, width, height);
        return canvas.toDataURL("image/jpeg", quality);
    }
    catch {
        return fileToDataUri(file);
    }
}
export function Signup() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const token = useAgentSession((s) => s.token);
    const setToken = useAgentSession((s) => s.setToken);
    const signup = useAgentSignup();
    const sendOtp = useSendOtp();
    const verifyOtp = useVerifyOtp();
    const [step, setStep] = useState("details");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [area, setArea] = useState("");
    const [aadharNumber, setAadharNumber] = useState("");
    const [aadharFront, setAadharFront] = useState("");
    const [aadharBack, setAadharBack] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const phoneRef = useRef(phone);
    // Already logged in — redirect to dashboard. Must come after every hook
    // call above (Rules of Hooks): this becomes true mid-session right after a
    // successful signup (see the otp step below), and an earlier return here
    // would make this component render fewer hooks than its previous pass.
    if (token)
        return _jsx(Navigate, { to: "/agent", replace: true });
    const goToKyc = () => {
        if (name.trim().length < 2)
            return setError("Enter your full name");
        if (!/^\d{10}$/.test(phone))
            return setError("Enter a valid 10-digit number");
        if (area.trim().length < 2)
            return setError("Enter the area / society you'll operate in");
        setError("");
        phoneRef.current = phone;
        setStep("kyc");
    };
    const submitKyc = async () => {
        if (!/^\d{12}$/.test(aadharNumber))
            return setError("Aadhar number must be 12 digits");
        if (!aadharFront || !aadharBack)
            return setError("Upload both sides of your Aadhar card");
        setError("");
        try {
            await signup.mutateAsync({
                name: name.trim(),
                phone: phoneRef.current,
                area: area.trim(),
                aadharNumber,
                aadharFront,
                aadharBack,
            });
            setStep("otp");
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't submit application. Is the API running?");
        }
    };
    const resend = async () => {
        try {
            await sendOtp.mutateAsync(phoneRef.current);
        }
        catch {
            /* the demo code still works even if resend fails */
        }
    };
    const verify = async () => {
        if (otp.length !== 6)
            return setError("Enter the 6-digit code");
        setError("");
        try {
            const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
            setToken(token);
            qc.setQueryData(meKey, user);
            navigate("/agent", { replace: true });
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Verification failed");
        }
    };
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Link, { to: "/agent", children: _jsx(Logo, { variant: "full" }) }) }), _jsxs("div", { className: "glass rounded-card p-8 shadow-[var(--shadow-lift)]", children: [_jsx(Stepper, { steps: ["Details", "KYC", "Verify"], current: step === "details" ? 0 : step === "kyc" ? 1 : 2 }), step === "details" && (_jsxs(_Fragment, { children: [_jsx(Badge, { className: "mb-5", children: "Become a specialist" }), _jsx("h1", { className: "text-2xl text-ink", children: "Join as a cleaner" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Tell us about yourself. You'll submit your ID next for verification." }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "name", autoComplete: "name", label: "Full name", placeholder: "Rohit Kumar", leading: _jsx(User, { className: "size-4" }), value: name, onChange: (e) => setName(e.target.value) }), _jsx(Input, { name: "phone", type: "tel", autoComplete: "tel", label: "Mobile number", inputMode: "numeric", maxLength: 10, placeholder: "90000 00000", leading: _jsx(Phone, { className: "size-4" }), value: phone, onChange: (e) => setPhone(e.target.value.replace(/\D/g, "")) }), _jsx(Input, { name: "area", autoComplete: "address-level2", label: "Area / society you'll operate in", placeholder: "Green Valley Society", leading: _jsx(MapPin, { className: "size-4" }), value: area, onChange: (e) => setArea(e.target.value), onKeyDown: (e) => e.key === "Enter" && goToKyc() }), error && _jsx("p", { className: "rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500", children: error }), _jsxs(Button, { className: "w-full", onClick: goToKyc, children: ["Continue ", _jsx(ArrowRight, { className: "size-4" })] })] })] })), step === "kyc" && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => {
                                            setStep("details");
                                            setError("");
                                        }, className: "mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back"] }), _jsx("h1", { className: "text-2xl text-ink", children: "Identity verification" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Submit your Aadhar for KYC. Our team reviews this before you can go live." }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "aadhar", autoComplete: "off", label: "Aadhar number", inputMode: "numeric", maxLength: 12, placeholder: "XXXX XXXX XXXX", leading: _jsx(CreditCard, { className: "size-4" }), value: aadharNumber, onChange: (e) => setAadharNumber(e.target.value.replace(/\D/g, "")) }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(KycTile, { label: "Aadhar front", value: aadharFront, onPick: setAadharFront }), _jsx(KycTile, { label: "Aadhar back", value: aadharBack, onPick: setAadharBack })] }), error && _jsx("p", { className: "rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500", children: error }), _jsx(Button, { className: "w-full", onClick: submitKyc, disabled: signup.isPending, children: signup.isPending ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsxs(_Fragment, { children: ["Submit application ", _jsx(ArrowRight, { className: "size-4" })] })) })] })] })), step === "otp" && (_jsxs(_Fragment, { children: [_jsx("h1", { className: "text-2xl text-ink", children: "Verify your number" }), _jsxs("p", { className: "mt-2 text-sm text-muted", children: ["Enter the 6-digit code sent to ", _jsxs("span", { className: "font-medium text-ink", children: ["+91 ", phoneRef.current] }), "."] }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "otp", autoComplete: "one-time-code", label: "One-time code", inputMode: "numeric", maxLength: 6, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", className: "tracking-[0.5em]", value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, "")), onKeyDown: (e) => e.key === "Enter" && verify(), hint: "Demo code: 123456", error: error }), _jsx(Button, { className: "w-full", onClick: verify, disabled: verifyOtp.isPending, children: verifyOtp.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsxs(_Fragment, { children: ["Verify & continue ", _jsx(ArrowRight, { className: "size-4" })] }) }), _jsx("button", { onClick: resend, className: "w-full text-center text-xs text-muted hover:text-primary", children: "Resend code" })] })] })), _jsxs("p", { className: "mt-6 flex items-center justify-center gap-2 text-xs text-muted", children: [_jsx(BadgeCheck, { className: "size-3.5 text-primary" }), " KYC reviewed by our operations team"] })] }), _jsxs("p", { className: "mt-6 text-center text-sm text-muted", children: ["Already registered?", " ", _jsx(Link, { to: "/agent/login", className: "font-medium text-primary hover:underline", children: "Agent login" })] })] })] }));
}
function KycTile({ label, value, onPick, }) {
    const ref = useRef(null);
    const [busy, setBusy] = useState(false);
    const done = value.length > 0;
    const handleFile = async (file) => {
        if (!file)
            return;
        setBusy(true);
        try {
            const dataUri = await fileToCompressedDataUri(file);
            onPick(dataUri);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("button", { type: "button", onClick: () => ref.current?.click(), disabled: busy, "aria-label": done ? `${label} uploaded, tap to replace` : `Upload ${label}`, className: cn("relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors", done ? "border-primary/40 bg-primary/5" : "border-line bg-surface hover:border-primary/40", busy && "opacity-70"), children: [busy ? (_jsx(Loader2, { className: "size-6 animate-spin text-primary" })) : done ? (_jsx("img", { src: value, alt: `${label} preview`, className: "absolute inset-0 size-full object-cover" })) : (_jsxs("div", { className: "text-center text-muted", children: [_jsx(Camera, { className: "mx-auto size-6" }), _jsx("p", { className: "mt-1 text-xs font-medium", children: label })] })), done && !busy && (_jsx("span", { className: "absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white", children: _jsx(Check, { className: "size-3.5" }) })), _jsx("input", { ref: ref, type: "file", accept: "image/*", capture: "environment", className: "hidden", onChange: (e) => handleFile(e.target.files?.[0]) })] }));
}
