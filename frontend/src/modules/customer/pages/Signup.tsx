import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
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

const DEMO_OTP = "123456";

export function Signup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setToken = useSessionStore((s) => s.setToken);
  const signup = useCustomerSignup();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const phoneRef = useRef(phone);

  const submitDetails = async () => {
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    setError("");
    phoneRef.current = phone;
    try {
      await signup.mutateAsync({ name: name.trim(), phone, email: email.trim() || undefined });
      setStep("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create account. Is the API running?");
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
      setToken(token);
      qc.setQueryData(meKey, user);
      navigate("/app", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed");
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo variant="full" />
          </Link>
        </div>

        <div className="glass rounded-card p-8 shadow-[var(--shadow-lift)]">
          <Stepper steps={["Details", "Verify"]} current={step === "details" ? 0 : 1} />
          {step === "details" ? (
            <>
              <Badge className="mb-5">Create account</Badge>
              <h1 className="text-2xl text-ink">Join NexClean</h1>
              <p className="mt-2 text-sm text-muted">A few details and we'll get your garage set up.</p>

              <div className="mt-6 space-y-4">
                <Input
                  name="name"
                  autoComplete="name"
                  label="Full name"
                  placeholder="Aisha Sharma"
                  leading={<User className="size-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  name="email"
                  autoComplete="email"
                  label="Email (optional)"
                  type="email"
                  placeholder="you@example.com"
                  leading={<Mail className="size-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  label="Mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  leading={<Phone className="size-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && submitDetails()}
                />
                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
                <Button className="w-full" onClick={submitDetails} disabled={signup.isPending}>
                  {signup.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Create account <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep("details");
                  setError("");
                }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Edit details
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
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  hint={`Demo code: ${DEMO_OTP}`}
                  error={error}
                />
                <Button className="w-full" onClick={verify} disabled={verifyOtp.isPending}>
                  {verifyOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Verify &amp; continue <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Secured with end-to-end verification
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link to="/app/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
