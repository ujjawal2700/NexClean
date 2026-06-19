import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  User,
  Phone,
  MapPin,
  CreditCard,
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Loader2,
} from "lucide-react";
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

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Phone camera photos are often 3-8MB; base64-inflated that can blow past the
 * upload limit and crawl on mobile data. Downscale + re-encode as JPEG first.
 * Falls back to the raw file if the canvas pipeline isn't available.
 */
async function fileToCompressedDataUri(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return fileToDataUri(file);
  }
}

type Step = "details" | "kyc" | "otp";

export function Signup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setToken = useAgentSession((s) => s.setToken);
  const signup = useAgentSignup();
  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharFront, setAadharFront] = useState("");
  const [aadharBack, setAadharBack] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const phoneRef = useRef(phone);

  const goToKyc = () => {
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    if (area.trim().length < 2) return setError("Enter the area / society you'll operate in");
    setError("");
    phoneRef.current = phone;
    setStep("kyc");
  };

  const submitKyc = async () => {
    if (!/^\d{12}$/.test(aadharNumber)) return setError("Aadhar number must be 12 digits");
    if (!aadharFront || !aadharBack) return setError("Upload both sides of your Aadhar card");
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't submit application. Is the API running?");
    }
  };

  const resend = async () => {
    try {
      await sendOtp.mutateAsync(phoneRef.current);
    } catch {
      /* the demo code still works even if resend fails */
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
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
          <Stepper steps={["Details", "KYC", "Verify"]} current={step === "details" ? 0 : step === "kyc" ? 1 : 2} />
          {step === "details" && (
            <>
              <Badge className="mb-5">Become a specialist</Badge>
              <h1 className="text-2xl text-ink">Join as a cleaner</h1>
              <p className="mt-2 text-sm text-muted">
                Tell us about yourself. You'll submit your ID next for verification.
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
                <Input
                  name="area"
                  autoComplete="address-level2"
                  label="Area / society you'll operate in"
                  placeholder="Green Valley Society"
                  leading={<MapPin className="size-4" />}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goToKyc()}
                />
                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
                <Button className="w-full" onClick={goToKyc}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </>
          )}

          {step === "kyc" && (
            <>
              <button
                onClick={() => {
                  setStep("details");
                  setError("");
                }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
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

          {step === "otp" && (
            <>
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
                <button onClick={resend} className="w-full text-center text-xs text-muted hover:text-primary">
                  Resend code
                </button>
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
