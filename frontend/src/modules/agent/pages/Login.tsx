import { useState, useRef } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Phone, ArrowRight, ArrowLeft, Loader2, BadgeCheck, UserX, Mail, MapPin, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { GlassCard } from "@shared/ui/GlassCard";
import { ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import { meKey, useSendOtp, useVerifyOtp } from "../api/agent.api";
import { Stepper } from "@shared/ui/Stepper";


export function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setToken = useAgentSession((s) => s.setToken);
  const authenticated = useAgentSession((s) => s.authenticated);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
  const phoneRef = useRef("");

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  if (authenticated) return <Navigate to="/agent" replace />;

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
      if (user.role !== "agent" && user.role !== "cleaner") {
        setError("This number isn't registered as an agent.");
        return;
      }
      setToken(token);
      qc.setQueryData(meKey, user);
      navigate("/agent", { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (msg.includes("ACCOUNT_DEACTIVATED") || msg.includes("deactivated") || msg.includes("suspended")) {
        setShowDeactivatedModal(true);
        setError("Your agent account has been deactivated.");
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
          <Link to="/agent">
            <Logo variant="full" />
          </Link>
        </div>

        <div className="glass rounded-card p-5 sm:p-8 shadow-[var(--shadow-lift)]">
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
      </div>

      {/* Deactivated Account Support Modal */}
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
                Your agent profile has been deactivated. Only an administrator can reactivate your account. Please contact customer support for assistance.
              </p>
            </div>

            {/* Support Details Card */}
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
    </main>
  );
}
