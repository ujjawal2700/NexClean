import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  User,
  Phone,
  CreditCard,
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { useAgentSession } from "../store/sessionStore";
import { useAgentSignup, useSendSignupOtp, useVerifyOtpCodeOnly, meKey, useAgentSignupBasic, useAgentMe } from "../api/agent.api";
import { usePublicCities, usePublicZones } from "@modules/customer/api/public";
import { LocationPicker } from "../components/LocationPicker";
import { fileToCompressedDataUri } from "@shared/lib/imageUtils";

type Step = "details" | "otp" | "kyc";

export function Signup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const authenticated = useAgentSession((s) => s.authenticated);
  const setToken = useAgentSession((s) => s.setToken);
  const signup = useAgentSignup();
  const signupBasic = useAgentSignupBasic();
  const sendSignupOtp = useSendSignupOtp();
  const verifyOtpCodeOnly = useVerifyOtpCodeOnly();
  const { data: me, isLoading: isLoadingMe } = useAgentMe();
  const { data: cities = [], isLoading: citiesLoading } = usePublicCities();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // City and area come from the admin-managed Locations list. This used to be a
  // free-text "area / society" box, which produced spellings that matched
  // nothing — area alerts and the admin's own filters compare on this string.
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharFront, setAadharFront] = useState("");
  const [aadharBack, setAadharBack] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const [resendSuccess, setResendSuccess] = useState("");
  const phoneRef = useRef(phone);

  // The zone endpoint is keyed by city id, but the name is what gets stored on
  // the account, so resolve one from the other.
  const selectedCityId = cities.find((c) => c.name === city)?.id ?? null;
  const { data: zones = [], isLoading: zonesLoading } = usePublicZones(selectedCityId);

  useEffect(() => {
    if (step !== "otp" || resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  // A signed-in agent who hasn't submitted KYC yet belongs on the KYC step.
  // "unverified" is the state agentSignupBasic() creates, and the backend's
  // KYC endpoint accepts *only* that state — so this is the one status that
  // must land here, not just "pending" (a resubmission after review).
  const needsKyc = me?.agentStatus === "unverified" || me?.agentStatus === "pending";

  useEffect(() => {
    if (authenticated && me && needsKyc) {
      setStep("kyc");
      setName(me.name || "");
      setPhone(me.phone || "");
      setCity(me.city || "");
      setArea(me.area || "");
      phoneRef.current = me.phone || "";
    }
  }, [authenticated, me, needsKyc]);

  if (authenticated && isLoadingMe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authenticated && me && !needsKyc) {
    return <Navigate to="/agent" replace />;
  }

  const submitDetails = async () => {
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    if (!city.trim()) return setError("Choose the city you'll work in");
    // Only insist on an area when the admin has actually listed some for that
    // city — otherwise a newly added city would block signups entirely.
    if (zones.length > 0 && !area.trim()) return setError("Choose the area you'll operate in");
    setError("");
    setToast("");
    phoneRef.current = phone;

    try {
      await sendSignupOtp.mutateAsync(phone);
      setResendTimer(30);
      setResendSuccess("");
      setStep("otp");
    } catch (e: any) {
      const msg = e?.message || "Couldn't send OTP. Is the API running?";
      setError(msg);
      if (msg.toLowerCase().includes("already exist") || msg.toLowerCase().includes("exists")) {
        setToast("User already exists with this number");
      }
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError("");
    setResendSuccess("");
    try {
      await sendSignupOtp.mutateAsync(phoneRef.current);
      setResendTimer(30);
      setResendSuccess("New verification code sent!");
    } catch (e: any) {
      setError(e?.message || "Couldn't resend code");
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const res = await signupBasic.mutateAsync({
        name: name.trim(),
        phone: phoneRef.current,
        city: city.trim(),
        area: area.trim(),
        code: otp,
      });
      if (res.token && res.user) {
        setToken(res.token);
        qc.setQueryData(meKey, res.user);
        setStep("kyc");
      }
    } catch (e: any) {
      setError(e?.message || "Incorrect code");
    }
  };

  const submitKyc = async () => {
    if (!/^\d{12}$/.test(aadharNumber)) return setError("Aadhar number must be 12 digits");
    if (!aadharFront || !aadharBack) return setError("Upload both sides of your Aadhar card");
    setError("");
    try {
      const res = await signup.mutateAsync({
        name: name.trim(),
        phone: phoneRef.current,
        city: city.trim(),
        area: area.trim(),
        aadharNumber,
        aadharFront,
        aadharBack,
      });
      if (res.token && res.user) {
        setToken(res.token);
        qc.setQueryData(meKey, res.user);
        navigate("/agent", { replace: true });
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't submit application. Is the API running?");
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/agent">
            <Logo variant="full" />
          </Link>
        </div>

        {toast && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-red-500/15 border border-red-500/30 p-4 text-sm font-medium text-red-600 dark:text-red-400 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-5 shrink-0" />
              <span>{toast}</span>
            </div>
            <button type="button" onClick={() => setToast("")} className="text-red-500 hover:text-red-700">
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="glass rounded-card p-5 sm:p-8 shadow-[var(--shadow-lift)]">
          <Stepper steps={["Details", "Verify", "KYC"]} current={step === "details" ? 0 : step === "otp" ? 1 : 2} />
          {step === "details" && (
            <>
              <Badge className="mb-5">Become a specialist</Badge>
              <h1 className="text-2xl text-ink">Join as a cleaner</h1>
              <p className="mt-2 text-sm text-muted">
                Tell us about yourself. You'll verify your mobile number next.
              </p>

              <div className="mt-6 space-y-4">
                <Input
                  name="name"
                  autoComplete="name"
                  label="Full name"
                  placeholder="Rohit Kumar"
                  leading={<User className="size-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  label="Mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="90000 00000"
                  leading={<Phone className="size-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
                <LocationPicker
                  cities={cities}
                  zones={zones}
                  citiesLoading={citiesLoading}
                  zonesLoading={zonesLoading}
                  city={city}
                  area={area}
                  onCity={(next) => {
                    setCity(next);
                    setArea(""); // the previous area belongs to the previous city
                  }}
                  onArea={setArea}
                />
                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
                <Button className="w-full" onClick={submitDetails} disabled={sendSignupOtp.isPending}>
                  {sendSignupOtp.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>Continue <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setStep("details");
                  setError("");
                  setToast("");
                }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Back to details
              </button>
              <h1 className="text-2xl text-ink">Verify your number</h1>
              <p className="mt-2 text-sm text-muted">
                Enter the 6-digit code sent to <span className="font-medium text-ink">+91 {phoneRef.current}</span>.
              </p>

              <div className="mt-6 space-y-4">
                <Input
                  name="otp"
                  autoComplete="one-time-code"
                  label="One-time code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  className="tracking-[0.5em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                  hint="Demo code: 123456"
                  error={error}
                />
                {resendSuccess && (
                  <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                    {resendSuccess}
                  </p>
                )}
                <Button className="w-full" onClick={verifyOtp} disabled={verifyOtpCodeOnly.isPending}>
                  {verifyOtpCodeOnly.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>Verify &amp; continue <ArrowRight className="size-4" /></>
                  )}
                </Button>
                <button
                  type="button"
                  disabled={resendTimer > 0 || sendSignupOtp.isPending}
                  onClick={handleResend}
                  className="w-full text-center text-xs font-medium text-muted hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendSignupOtp.isPending
                    ? "Sending..."
                    : resendTimer > 0
                    ? `Resend code in ${resendTimer}s`
                    : "Resend code"}
                </button>
              </div>
            </>
          )}

          {step === "kyc" && (
            <>

              <h1 className="text-2xl text-ink">Identity verification</h1>
              <p className="mt-2 text-sm text-muted">
                Submit your Aadhar for KYC. Our team reviews this before you can go live.
              </p>

              <div className="mt-6 space-y-4">
                <Input
                  name="aadhar"
                  autoComplete="off"
                  label="Aadhar number"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="XXXX XXXX XXXX"
                  leading={<CreditCard className="size-4" />}
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value.replace(/\D/g, ""))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <KycTile label="Aadhar front" value={aadharFront} onPick={setAadharFront} />
                  <KycTile label="Aadhar back" value={aadharBack} onPick={setAadharBack} />
                </div>
                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
                <Button className="w-full" onClick={submitKyc} disabled={signup.isPending}>
                  {signup.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>Submit application <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <BadgeCheck className="size-3.5 text-primary" /> KYC reviewed by our operations team
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{" "}
          <Link to="/agent/login" className="font-medium text-primary hover:underline">
            Agent login
          </Link>
        </p>
      </div>
    </main>
  );
}

function KycTile({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (dataUri: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const done = value.length > 0;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUri = await fileToCompressedDataUri(file);
      onPick(dataUri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      disabled={busy}
      aria-label={done ? `${label} uploaded, tap to replace` : `Upload ${label}`}
      className={cn(
        "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
        done ? "border-primary/40 bg-primary/5" : "border-line bg-surface hover:border-primary/40",
        busy && "opacity-70",
      )}
    >
      {busy ? (
        <Loader2 className="size-6 animate-spin text-primary" />
      ) : done ? (
        <img src={value} alt={`${label} preview`} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="text-center text-muted">
          <Camera className="mx-auto size-6" />
          <p className="mt-1 text-xs font-medium">{label}</p>
        </div>
      )}
      {done && !busy && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white">
          <Check className="size-3.5" />
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </button>
  );
}
