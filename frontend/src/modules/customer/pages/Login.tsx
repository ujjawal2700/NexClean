import { useState, useRef } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, ArrowRight, ArrowLeft, ShieldCheck, Loader2, UserX, Mail, MapPin, X, Compass } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { GlassCard } from "@shared/ui/GlassCard";
import { ApiError } from "@shared/lib/api";
import { Stepper } from "@shared/ui/Stepper";
import { useSendLoginOtp, useVerifyOtp } from "../api/mutations";
import { meKey } from "../api/queries";
import { useSessionStore } from "../store/sessionStore";


const DEMO_OTP = "123456";

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
        setError(msg || "Couldn't send OTP. Is the API running?");
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in">
          <GlassCard className="w-full max-w-md space-y-6 bg-surface p-6 shadow-2xl border border-line relative">
            <button
              onClick={() => setShowDeactivatedModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-ink p-1 rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-3 text-center pt-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
                <UserX className="size-7" />
              </div>
              <h3 className="font-display text-2xl font-bold text-ink">Account Deactivated</h3>
              <p className="text-sm text-muted leading-relaxed">
                Your profile has been deactivated. Only an administrator can reactivate your account. Please contact customer support for assistance.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-surface-muted/50 p-4 text-left text-xs">
              <div className="flex items-center gap-3">
                <Phone className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-muted font-medium">Customer Support Phone</p>
                  <p className="font-bold text-ink text-sm">+91 98765 43210</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-line/40 pt-2.5">
                <Mail className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-muted font-medium">Support Email</p>
                  <p className="font-bold text-ink text-sm">support@nexclean.in</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-line/40 pt-2.5">
                <MapPin className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-muted font-medium">Office Address</p>
                  <p className="font-medium text-ink">NexClean HQ, 102 Sector 5, HSR Layout, Bengaluru 560102</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="tel:+919876543210" className="flex-1">
                <Button className="w-full rounded-xl">Call Support</Button>
              </a>
              <Button
                variant="outline"
                onClick={() => setShowDeactivatedModal(false)}
                className="flex-1 rounded-xl"
              >
                Close
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {showNotRegisteredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in">
          <GlassCard className="w-full max-w-md space-y-6 bg-surface p-6 shadow-2xl border border-line relative">
            <button
              onClick={() => setShowNotRegisteredModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-ink p-1 rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-3 text-center pt-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                <UserX className="size-7" />
              </div>
              <h3 className="font-display text-2xl font-bold text-ink">Account Not Registered</h3>
              <p className="text-sm text-muted leading-relaxed">
                The mobile number <span className="font-semibold text-ink">+91 {phoneRef.current || phone}</span> is not registered with NexClean.
              </p>
              <p className="text-xs text-ink-soft bg-surface-muted/60 rounded-xl p-3 border border-line/40">
                Kindly sign up first to create your profile, choose your service location, and get started!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setShowNotRegisteredModal(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const targetPhone = phoneRef.current || phone;
                  setShowNotRegisteredModal(false);
                  navigate(`/app/signup?phone=${targetPhone}`);
                }}
                className="flex-1 rounded-xl bg-primary text-white"
              >
                Sign Up <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </main>
  );
}
