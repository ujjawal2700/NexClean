import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Check,
  X,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useMe } from "../api/queries";
import { useUpdateProfile, useRequestPhoneChange, useConfirmPhoneChange } from "../api/mutations";

export function EditProfile() {
  const navigate = useNavigate();
  const { data: me } = useMe();

  const updateProfile = useUpdateProfile();
  const requestPhoneChange = useRequestPhoneChange();
  const confirmPhoneChange = useConfirmPhoneChange();

  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // phone-change sub-flow: idle (just show current phone) -> enter (new number) -> otp (verify)
  const [phoneStep, setPhoneStep] = useState<"idle" | "enter" | "otp">("idle");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Init fields
  useEffect(() => {
    if (me) {
      setName(me.name || "");
      setEmail(me.email || "");
    }
  }, [me]);

  const saveDetails = () => {
    if (!name.trim() || !email.trim()) return;
    updateProfile.mutate(
      { name: name.trim(), email: email.trim() },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  const cancelEditing = () => {
    if (me) {
      setName(me.name || "");
      setEmail(me.email || "");
    }
    navigate("/app/profile");
  };

  const sendPhoneOtp = () => {
    if (!newPhone.trim() || newPhone.length !== 10) {
      return setPhoneError("Please enter a valid 10-digit number.");
    }
    setPhoneError("");
    requestPhoneChange.mutate(newPhone, {
      onSuccess: () => setPhoneStep("otp"),
      onError: (err: any) => setPhoneError(err?.message || "Failed to send OTP."),
    });
  };

  const verifyPhoneOtp = () => {
    if (!otp || otp.length !== 6) return;
    confirmPhoneChange.mutate(
      { phone: newPhone, code: otp },
      {
        onSuccess: () => {
          setPhoneStep("idle");
          setNewPhone("");
          setOtp("");
          setPhoneError("");
        },
        onError: (err: any) => setPhoneError(err?.message || "Invalid or expired OTP."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Edit Profile</h1>
      </div>

      {/* Profile Details Card */}
      <GlassCard className="space-y-5">
        <div className="flex items-center gap-2 border-b border-line/50 pb-3">
          <User className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Personal Details</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="name"
            label="Full name"
            leading={<User className="size-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            name="email"
            label="Email"
            type="email"
            leading={<Mail className="size-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="sm" onClick={saveDetails} disabled={updateProfile.isPending}>
            {saved ? (
              <>
                <Check className="size-4" /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancelEditing}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </GlassCard>

      {/* Phone Number Update Card */}
      <GlassCard className="space-y-5">
        <div className="flex items-center gap-2 border-b border-line/50 pb-3">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Login Identity</h2>
        </div>

        <div className="rounded-2xl border border-line bg-surface-muted/45 p-5">
          <p className="mb-2 text-sm font-semibold text-ink">Current Mobile Number</p>

          {phoneStep === "idle" && (
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg font-medium text-ink">+91 {me?.phone}</span>
              <Button variant="outline" size="sm" onClick={() => setPhoneStep("enter")}>
                Change number
              </Button>
            </div>
          )}

          {phoneStep === "enter" && (
            <div className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Enter your new number. We'll send a 6-digit one-time passcode to verify ownership before updating your login identifier.
              </p>
              <Input
                name="newPhone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                leading={<Phone className="size-4" />}
                placeholder="98765 43210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                error={phoneError}
              />
              <div className="flex gap-3">
                <Button size="sm" onClick={sendPhoneOtp} disabled={requestPhoneChange.isPending}>
                  {requestPhoneChange.isPending ? <Loader2 className="size-4 animate-spin" /> : "Send OTP"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhoneStep("idle");
                    setNewPhone("");
                    setPhoneError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {phoneStep === "otp" && (
            <div className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Enter the 6-digit verification code sent to <span className="font-medium text-ink">+91 {newPhone}</span>.
              </p>
              <Input
                name="phoneOtp"
                inputMode="numeric"
                maxLength={6}
                className="tracking-[0.5em] text-center"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                error={phoneError}
              />
              <div className="flex gap-3">
                <Button size="sm" onClick={verifyPhoneOtp} disabled={confirmPhoneChange.isPending}>
                  {confirmPhoneChange.isPending ? <Loader2 className="size-4 animate-spin" /> : "Verify & Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhoneStep("enter");
                    setOtp("");
                    setPhoneError("");
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
