import { useState, useRef } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, ArrowRight, ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import { useSendOtp, useVerifyOtp, meKey } from "../api/agent.api";

export function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = useAgentSession((s) => s.token);
  const setToken = useAgentSession((s) => s.setToken);
  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  // Already logged in — skip the login form entirely
  if (token) return <Navigate to="/agent" replace />;

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const phoneRef = useRef(phone);

  const send = async () => {
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    setError("");
    phoneRef.current = phone;
    try {
      await sendOtp.mutateAsync(phone);
      setStep("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send OTP. Is the API running?");
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
      if (user.role !== "agent") {
        setError("This number isn't registered as an agent.");
        return;
      }
      setToken(token);
      qc.setQueryData(meKey, user);
      navigate("/agent", { replace: true });
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
          <Stepper steps={["Number", "Verify"]} current={step === "phone" ? 0 : 1} />
          {step === "phone" ? (
            <>
              <Badge className="mb-5">Agent Login</Badge>
              <h1 className="text-2xl text-ink">Welcome, specialist</h1>
              <p className="mt-2 text-sm text-muted">Sign in to see today's jobs and start earning.</p>
              <div className="mt-6 space-y-4">
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  label="Registered mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="90000 00001"
                  leading={<Phone className="size-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  hint="Demo agent: 9000000001"
                  error={error}
                />
                <Button className="w-full" onClick={send} disabled={sendOtp.isPending}>
                  {sendOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Send OTP <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("phone"); setError(""); }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Change number
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
                  hint="Demo code: 123456"
                  error={error}
                />
                <Button className="w-full" onClick={verify} disabled={verifyOtp.isPending}>
                  {verifyOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Verify &amp; continue <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <BadgeCheck className="size-3.5 text-primary" /> Verified specialists only
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          New cleaner?{" "}
          <Link to="/agent/signup" className="font-medium text-primary hover:underline">
            Apply to join
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          Looking to book a wash?{" "}
          <Link to="/app" className="font-medium text-primary hover:underline">Customer app</Link>
        </p>
      </div>
    </main>
  );
}
