import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, Gift, ArrowRight, ArrowLeft, ShieldCheck, Loader2, MapPin, Building2, Rocket, } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { ApiError } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useCustomerSignup, useVerifyOtp } from "../api/mutations";
import { meKey } from "../api/queries";
import { usePublicCities, usePublicZones, useSubmitLead } from "../api/public";
const DEMO_OTP = "123456";
export function Signup() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const qc = useQueryClient();
    const token = useSessionStore((s) => s.token);
    const setToken = useSessionStore((s) => s.setToken);
    const signup = useCustomerSignup();
    const verifyOtp = useVerifyOtp();
    const submitLead = useSubmitLead();
    // Step state
    const [step, setStep] = useState("details");
    // Step 1 — Details
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [referralCode, setReferralCode] = useState(searchParams.get("ref") ?? "");
    // Step 2 — Location
    const [selectedCityId, setSelectedCityId] = useState(null);
    const [selectedCityName, setSelectedCityName] = useState("");
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [customCity, setCustomCity] = useState("");
    const [customLocation, setCustomLocation] = useState("");
    const [isUnservicedCity, setIsUnservicedCity] = useState(false);
    // Step 3 — OTP
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const phoneRef = useRef(phone);
    const { data: cities = [], isLoading: citiesLoading } = usePublicCities();
    const { data: zones = [], isLoading: zonesLoading } = usePublicZones(selectedCityId);
    // Already logged in — redirect to dashboard. Must come after every hook
    // call above (Rules of Hooks): this becomes true mid-session right after a
    // successful signup (see the otp step below), and an earlier return here
    // would make this component render fewer hooks than its previous pass.
    if (token)
        return _jsx(Navigate, { to: "/app", replace: true });
    const stepIndex = { details: 0, location: 1, otp: 2 };
    /* ─── Step 1 submit ───────────────────────────────────────────────── */
    const submitDetails = () => {
        if (name.trim().length < 2)
            return setError("Enter your full name");
        if (!/^\d{10}$/.test(phone))
            return setError("Enter a valid 10-digit number");
        setError("");
        phoneRef.current = phone;
        setStep("location");
    };
    /* ─── Step 2 — City selection ─────────────────────────────────────── */
    const selectCity = (city) => {
        setSelectedCityId(city.id);
        setSelectedCityName(city.name);
        setSelectedZoneId(null);
        setIsUnservicedCity(false);
        setCustomCity("");
        setCustomLocation("");
    };
    const selectNotListed = () => {
        setSelectedCityId(null);
        setSelectedCityName("");
        setSelectedZoneId(null);
        setIsUnservicedCity(true);
    };
    const proceedFromLocation = async () => {
        setError("");
        if (!isUnservicedCity) {
            // Normal flow — city is serviceable
            if (!selectedCityId)
                return setError("Please select your city");
            if (zones.length > 0 && !selectedZoneId)
                return setError("Please select your society / zone");
            // Proceed to account creation + OTP
            try {
                await signup.mutateAsync({
                    name: name.trim(),
                    phone,
                    email: email.trim() || undefined,
                    referralCode: referralCode.trim() || undefined,
                });
                setStep("otp");
            }
            catch (e) {
                setError(e instanceof ApiError ? e.message : "Couldn't create account. Is the API running?");
            }
        }
        else {
            // Unserviced city — still create account, then capture lead
            if (!customCity.trim())
                return setError("Please enter your city name");
            if (!customLocation.trim())
                return setError("Please enter your area / locality");
            try {
                await signup.mutateAsync({
                    name: name.trim(),
                    phone,
                    email: email.trim() || undefined,
                    referralCode: referralCode.trim() || undefined,
                });
                setStep("otp");
            }
            catch (e) {
                setError(e instanceof ApiError ? e.message : "Couldn't create account. Is the API running?");
            }
        }
    };
    /* ─── Step 3 — OTP verify ─────────────────────────────────────────── */
    const verify = async () => {
        if (otp.length !== 6)
            return setError("Enter the 6-digit code");
        setError("");
        try {
            const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
            setToken(token);
            qc.setQueryData(meKey, user);
            if (isUnservicedCity) {
                // Save lead record, then redirect to coming-soon screen
                try {
                    await submitLead.mutateAsync({
                        name: name.trim(),
                        phone,
                        email: email.trim() || undefined,
                        city: customCity.trim(),
                        location: customLocation.trim(),
                    });
                }
                catch {
                    // Non-fatal — account was already created
                }
                navigate("/app/coming-soon", { replace: true });
            }
            else {
                navigate("/app", { replace: true });
            }
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Verification failed");
        }
    };
    /* ─── Render ───────────────────────────────────────────────────────── */
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Link, { to: "/app", children: _jsx(Logo, { variant: "full" }) }) }), _jsxs("div", { className: "glass rounded-card p-8 shadow-[var(--shadow-lift)]", children: [_jsx(Stepper, { steps: ["Details", "Location", "Verify"], current: stepIndex[step] }), step === "details" && (_jsxs(_Fragment, { children: [_jsx(Badge, { className: "mb-5", children: "Create account" }), _jsx("h1", { className: "text-2xl text-ink", children: "Join NexClean" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "A few details and we'll get your garage set up." }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "name", autoComplete: "name", label: "Full name", placeholder: "Aisha Sharma", leading: _jsx(User, { className: "size-4" }), value: name, onChange: (e) => setName(e.target.value) }), _jsx(Input, { name: "email", autoComplete: "email", label: "Email (optional)", type: "email", placeholder: "you@example.com", leading: _jsx(Mail, { className: "size-4" }), value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(Input, { name: "phone", type: "tel", autoComplete: "tel", label: "Mobile number", inputMode: "numeric", maxLength: 10, placeholder: "98765 43210", leading: _jsx(Phone, { className: "size-4" }), value: phone, onChange: (e) => setPhone(e.target.value.replace(/\D/g, "")), onKeyDown: (e) => e.key === "Enter" && submitDetails() }), _jsx(Input, { name: "referralCode", label: "Referral code (optional)", placeholder: "e.g. AISH4F2A", leading: _jsx(Gift, { className: "size-4" }), value: referralCode, onChange: (e) => setReferralCode(e.target.value.toUpperCase()), onKeyDown: (e) => e.key === "Enter" && submitDetails() }), error && _jsx("p", { className: "rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500", children: error }), _jsxs(Button, { className: "w-full", onClick: submitDetails, children: ["Continue ", _jsx(ArrowRight, { className: "size-4" })] })] })] })), step === "location" && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => { setStep("details"); setError(""); }, className: "mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back"] }), _jsx(Badge, { className: "mb-5", children: "Service area" }), _jsx("h1", { className: "text-2xl text-ink", children: "Select your city" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "We'll match you with the best agents near you." }), _jsxs("div", { className: "mt-5 space-y-3", children: [citiesLoading ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted", children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Loading cities\u2026"] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [cities.map((city) => (_jsxs("button", { onClick: () => selectCity(city), className: `flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${selectedCityId === city.id && !isUnservicedCity
                                                                    ? "border-primary bg-primary/10 text-primary"
                                                                    : "border-line bg-surface/60 text-ink hover:border-primary/50"}`, children: [_jsx(MapPin, { className: "size-3.5" }), " ", city.name] }, city.id))), _jsx("button", { onClick: selectNotListed, className: `flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${isUnservicedCity
                                                                    ? "border-amber-500 bg-amber-500/10 text-amber-600"
                                                                    : "border-line bg-surface/60 text-muted hover:border-amber-400/50"}`, children: "My city isn't listed" })] }), selectedCityId && !isUnservicedCity && (_jsxs("div", { className: "mt-1", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-muted", children: "Select your society / zone" }), zonesLoading ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted", children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Loading zones\u2026"] })) : zones.length === 0 ? (_jsxs("p", { className: "text-xs text-muted", children: ["No zones listed yet for ", selectedCityName, ". You can continue anyway."] })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: zones.map((zone) => (_jsxs("button", { onClick: () => setSelectedZoneId(zone.id), className: `flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${selectedZoneId === zone.id
                                                                        ? "border-primary bg-primary/10 text-primary"
                                                                        : "border-line bg-surface/60 text-ink hover:border-primary/50"}`, children: [_jsx(Building2, { className: "size-3.5" }), " ", zone.name] }, zone.id))) }))] })), isUnservicedCity && (_jsxs("div", { className: "rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10", children: _jsx(Rocket, { className: "size-4 text-amber-500" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: "We're not there yet!" }), _jsx("p", { className: "mt-0.5 text-xs text-muted", children: "NexClean is growing fast. Tell us your city and area \u2014 we'll notify you the moment we launch near you." })] })] }), _jsx(Input, { name: "customCity", label: "Your city", placeholder: "e.g. Pune, Mumbai, Delhi\u2026", leading: _jsx(MapPin, { className: "size-4" }), value: customCity, onChange: (e) => setCustomCity(e.target.value) }), _jsx(Input, { name: "customLocation", label: "Area / Locality", placeholder: "e.g. Koregaon Park, Bandra West\u2026", leading: _jsx(Building2, { className: "size-4" }), value: customLocation, onChange: (e) => setCustomLocation(e.target.value) })] }))] })), error && _jsx("p", { className: "rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500", children: error }), _jsx(Button, { className: "w-full", onClick: proceedFromLocation, disabled: signup.isPending || citiesLoading, children: signup.isPending ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : isUnservicedCity ? (_jsxs(_Fragment, { children: ["Save my spot & Continue ", _jsx(ArrowRight, { className: "size-4" })] })) : (_jsxs(_Fragment, { children: ["Continue ", _jsx(ArrowRight, { className: "size-4" })] })) })] })] })), step === "otp" && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => { setStep("location"); setError(""); }, className: "mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary", children: [_jsx(ArrowLeft, { className: "size-4" }), " Edit location"] }), _jsx("h1", { className: "text-2xl text-ink", children: "Verify your number" }), _jsxs("p", { className: "mt-2 text-sm text-muted", children: ["Enter the 6-digit code sent to ", _jsxs("span", { className: "font-medium text-ink", children: ["+91 ", phoneRef.current] }), "."] }), isUnservicedCity && (_jsxs("div", { className: "mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-2", children: [_jsx(Rocket, { className: "size-3.5 shrink-0 text-amber-500" }), _jsxs("p", { className: "text-xs text-amber-700", children: ["After verification, your spot in ", _jsx("strong", { children: customCity }), " will be saved."] })] })), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Input, { name: "otp", autoComplete: "one-time-code", label: "One-time code", inputMode: "numeric", maxLength: 6, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", className: "tracking-[0.5em]", value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, "")), onKeyDown: (e) => e.key === "Enter" && verify(), hint: `Demo code: ${DEMO_OTP}`, error: error }), _jsx(Button, { className: "w-full", onClick: verify, disabled: verifyOtp.isPending || submitLead.isPending, children: verifyOtp.isPending || submitLead.isPending ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsxs(_Fragment, { children: ["Verify & continue ", _jsx(ArrowRight, { className: "size-4" })] })) })] })] })), _jsxs("p", { className: "mt-6 flex items-center justify-center gap-2 text-xs text-muted", children: [_jsx(ShieldCheck, { className: "size-3.5 text-primary" }), " Secured with end-to-end verification"] })] }), _jsxs("p", { className: "mt-6 text-center text-sm text-muted", children: ["Already have an account?", " ", _jsx(Link, { to: "/app/login", className: "font-medium text-primary hover:underline", children: "Log in" })] })] })] }));
}
