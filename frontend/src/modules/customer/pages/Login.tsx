import { useState, useRef } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, ArrowRight, ArrowLeft, ShieldCheck, Loader2, Compass } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { ApiError } from "@shared/lib/api";
import { Stepper } from "@shared/ui/Stepper";
import { useSendLoginOtp, useVerifyOtp } from "../api/mutations";
import { meKey } from "../api/queries";
import { useSessionStore } from "../store/sessionStore";
import { AccountDeactivatedDialog } from "@shared/components/AccountDeactivatedDialog";
import { AccountNotFoundDialog } from "@shared/components/AccountNotFoundDialog";



export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const authenticated = useSessionStore((s) => s.authenticated);
  const setToken = useSessionStore((s) => s.setToken);
  const startGuest = useSessionStore((s) => s.startGuest);

  // Where to land after a successful login: the screen a guest was bounced
  // from, otherwise the dashboard.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/app";
  const sendLoginOtp = useSendLoginOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const phoneRef = useRef("");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  if (authenticated) return <Navigate to={redirectTo} replace />;

  const send = async () => {
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit number");
      return;
    }
    setError("");
    phoneRef.current = phone;
    try {
      await sendLoginOtp.mutateAsync(phone);
      setStep("otp");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (msg.includes("NOT_REGISTERED") || msg.toLowerCase().includes("not registered")) {
        setShowNotRegisteredModal(true);
      } else if (msg.includes("ACCOUNT_DEACTIVATED") || msg.includes("deactivated") || msg.includes("suspended")) {
        setShowDeactivatedModal(true);
        setError("Your account has been deactivated.");
      } else {
        setError(msg || "Couldn't send the verification code. Please try again.");
      }
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
      if (!user) {
        setError("This number may belong to an agent account. Please use Agent Login, or try again with your customer number.");
        return;
      }
      if (user.role === "agent" || user.role === "cleaner") {
        setError("Agent accounts cannot log in to the customer app.");
        return;
      }
      setToken(token);
      qc.setQueryData(meKey, user);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (msg.includes("NOT_REGISTERED") || msg.toLowerCase().includes("not registered")) {
        setShowNotRegisteredModal(true);
      } else if (msg.includes("ACCOUNT_DEACTIVATED") || msg.includes("deactivated") || msg.includes("suspended")) {
        setShowDeactivatedModal(true);
        setError("Your account has been deactivated.");
      } else {
        setError(msg || "Verification failed");
      }
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/app">
            <Logo variant="full" />
          </Link>
        </div>

        <div className="glass rounded-card p-5 sm:p-8 shadow-[var(--shadow-lift)]">
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
                  ref={phoneInputRef}
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
                <Button className="w-full" onClick={send} disabled={sendLoginOtp.isPending}>
                  {sendLoginOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Send OTP <ArrowRight className="size-4" /></>}
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

                  error={error}
                />
                <Button className="w-full" onClick={verify} disabled={verifyOtp.isPending}>
                  {verifyOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Verify &amp; continue <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Secure sign-in with a one-time code
          </p>

          {step === "phone" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] uppercase tracking-wider text-muted">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startGuest();
                  navigate("/app", { replace: true });
                }}
              >
                <Compass className="size-4" /> Skip for now, just browse
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted">
                You can view the dashboard and plans. Booking, your bookings and profile need an account.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          New to NexClean?{" "}
          <Link to="/app/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {showDeactivatedModal && (
        <AccountDeactivatedDialog onClose={() => setShowDeactivatedModal(false)} />
      )}

      {showNotRegisteredModal && (
        <AccountNotFoundDialog
          phone={phoneRef.current || phone}
          onClose={() => {
            setShowNotRegisteredModal(false);
            window.requestAnimationFrame(() => phoneInputRef.current?.focus());
          }}
          onSignUp={() => {
            const targetPhone = phoneRef.current || phone;
            setShowNotRegisteredModal(false);
            navigate(`/app/signup?phone=${targetPhone}`);
          }}
        />
      )}
    </main>
  );
}
