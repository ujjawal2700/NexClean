import { useState, useRef } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Phone, ArrowRight, ArrowLeft, Loader2, BadgeCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AccountDeactivatedDialog } from "@shared/components/AccountDeactivatedDialog";
import { AccountNotFoundDialog } from "@shared/components/AccountNotFoundDialog";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import { meKey, useSendOtp, useVerifyOtp, useConfirmDeviceSwitch, type AgentLoginResult } from "../api/agent.api";
import { DeviceSwitchDialog } from "../components/DeviceSwitchDialog";
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
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [switchTicket, setSwitchTicket] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState("");
  const phoneRef = useRef("");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();
  const confirmSwitch = useConfirmDeviceSwitch();

  if (authenticated) return <Navigate to="/agent" replace />;

  const send = async () => {
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    setError("");
    phoneRef.current = phone;
    try {
      await sendOtp.mutateAsync(phone);
      setStep("otp");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "";
      if (msg.includes("NOT_REGISTERED")) {
        setShowNotRegisteredModal(true);
      } else if (msg.includes("ACCOUNT_DEACTIVATED")) {
        setShowDeactivatedModal(true);
        setError("Your agent account has been deactivated.");
      } else if (msg.includes("NOT_AN_AGENT")) {
        setError("This number belongs to a customer account. Use a different number to join as an agent.");
      } else {
        setError(msg || "Couldn't send the verification code. Please try again.");
      }
    }
  };

  const finishLogin = ({ token, user }: AgentLoginResult) => {
    if (user.role !== "agent" && user.role !== "cleaner") {
      setError("This number isn't registered as an agent.");
      return;
    }
    setToken(token);
    qc.setQueryData(meKey, user);
    navigate("/agent", { replace: true });
  };

  const confirmDeviceSwitch = async () => {
    if (!switchTicket) return;
    setSwitchError("");
    try {
      const result = await confirmSwitch.mutateAsync(switchTicket);
      setSwitchTicket(null);
      finishLogin(result);
    } catch (e) {
      // The ticket lives five minutes; past that the cleaner needs a fresh code.
      setSwitchTicket(null);
      setOtp("");
      setStep("phone");
      setError(e instanceof ApiError ? e.message : "Couldn't log you in. Please try again.");
    }
  };

  const cancelDeviceSwitch = () => {
    setSwitchTicket(null);
    setOtp("");
    setStep("phone");
    setError("Login cancelled. You're still logged in on your other phone.");
  };

  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const result = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
      if ("deviceSwitchRequired" in result) {
        setSwitchError("");
        setSwitchTicket(result.switchTicket);
        return;
      }
      finishLogin(result);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (msg.includes("NOT_REGISTERED")) {
        setShowNotRegisteredModal(true);
      } else if (msg.includes("ACCOUNT_DEACTIVATED") || msg.includes("deactivated") || msg.includes("suspended")) {
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
                  ref={phoneInputRef}
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
        <AccountDeactivatedDialog onClose={() => setShowDeactivatedModal(false)} />
      )}

      {switchTicket && (
        <DeviceSwitchDialog
          pending={confirmSwitch.isPending}
          error={switchError}
          onCancel={cancelDeviceSwitch}
          onConfirm={() => void confirmDeviceSwitch()}
        />
      )}

      {showNotRegisteredModal && (
        <AccountNotFoundDialog
          audience="agent"
          phone={phoneRef.current || phone}
          onClose={() => {
            setShowNotRegisteredModal(false);
            window.requestAnimationFrame(() => phoneInputRef.current?.focus());
          }}
          onSignUp={() => {
            const targetPhone = phoneRef.current || phone;
            setShowNotRegisteredModal(false);
            navigate(`/agent/signup?phone=${targetPhone}`);
          }}
        />
      )}
    </main>
  );
}
