import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { ApiError } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useSendOtp, useVerifyOtp } from "../api/mutations";
import { meKey } from "../api/queries";

const DEMO_OTP = "123456";

export function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setToken = useSessionStore((s) => s.setToken);
  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const phoneRef = useRef(phone);

  const send = async () => {
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit number");
      return;
    }
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
    if (otp.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
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
          <Stepper steps={["Number", "Verify"]} current={step === "phone" ? 0 : 1} />
          {step === "phone" ? (
            <>
              <Badge className="mb-5">Customer Login</Badge>
              <h1 className="text-2xl text-ink">Welcome back</h1>
              <p className="mt-2 text-sm text-muted">
                Enter your mobile number to continue. We'll send a one-time code.
              </p>

              <div className="mt-6 space-y-4">
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
                  onKeyDown={(e) => e.key === "Enter" && send()}
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
                onClick={() => {
                  setStep("phone");
                  setError("");
                }}
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
          New to NexClean?{" "}
          <Link to="/app/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          Are you a cleaner?{" "}
          <Link to="/agent" className="font-medium text-primary hover:underline">
            Agent login
          </Link>
        </p>
      </div>
    </main>
  );
}
