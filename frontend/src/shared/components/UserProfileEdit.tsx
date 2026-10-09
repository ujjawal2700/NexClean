import { useState, useEffect, useRef } from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Send,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { apiFetch } from "@shared/lib/api";

// Letters from any script (\p{L}) plus the combining marks Indic vowel signs
// need (\p{M}), so names like "जॉन कुमार" and "José" are typeable. Must stay in
// step with the same rule in backend user.validation.ts.
const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u;
const NON_NAME_CHARS = /[^\p{L}\p{M}\s.'-]/gu;

type UserProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions?: string[];
};

export function UserProfileEdit({
  user,
  onProfileUpdated,
}: {
  user?: UserProfileData | null;
  onProfileUpdated?: () => void;
}) {
  // Profile info state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password reset state
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verified">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");


  /**
   * Seed the form once per account, not on every `user` change.
   *
   * This effect used to run for any new `user` object, including a routine
   * background refetch. A GET /auth/me that was already in flight when you hit
   * Save resolves *after* the PATCH updated the cache, carrying the old values —
   * and this effect then wrote them straight back over what you had just typed.
   * The save had succeeded; only the screen lied, which is the worse failure.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || seededFor.current === user.id) return;
    seededFor.current = user.id;
    // Strip numbers if legacy name had numbers or clean up phone
    setName((user.name || "").replace(NON_NAME_CHARS, ""));
    setEmail(user.email || "");
    const digits = (user.phone || "").replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
  }, [user]);

  // Derived role badge text
  const roleLabel =
    user?.role === "admin"
      ? user?.permissions?.includes("*")
        ? "Super Admin"
        : "Staff Member"
      : user?.role === "agent"
      ? "Agent"
      : "Customer";

  // Save Name, Email, Phone
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !NAME_PATTERN.test(trimmedName)) {
      setProfileError("Full Name must contain letters only (no numbers or special characters).");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setProfileError("Mobile number must be exactly 10 digits.");
      return;
    }

    setProfileSaving(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: { name: trimmedName, email: trimmedEmail, phone: trimmedPhone },
      });
      setProfileSuccess("Profile details saved successfully");
      onProfileUpdated?.();
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: any) {
      setProfileError(err?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  // Step 1: Send OTP to user's phone
  const handleSendOtp = async () => {
    if (!phone || phone.trim().length !== 10) {
      setOtpError("Please enter a valid 10-digit mobile number in your profile first.");
      return;
    }
    setOtpError("");
    setOtpSuccess("");
    setOtpSending(true);
    try {
      await apiFetch<{ sent: boolean }>("/auth/send-otp", {
        method: "POST",
        body: { phone: phone.trim() },
      });
      setOtpStep("sent");
      setOtpSuccess(`OTP sent to +91 ${phone.trim()}`);
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send OTP code");
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      setOtpError("Please enter the 6-digit OTP code");
      return;
    }
    setOtpError("");
    setOtpSuccess("");
    setOtpVerifying(true);
    try {
      await apiFetch("/auth/verify-otp-code", {
        method: "POST",
        body: { phone: phone.trim(), code: otpCode.trim() },
      });
      setOtpStep("verified");
      setOtpSuccess("Phone verified via OTP. You can now enter your new password below.");
    } catch (err: any) {
      setOtpError(err?.message || "Invalid or expired OTP code");
    } finally {
      setOtpVerifying(false);
    }
  };

  // Step 3: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      await apiFetch("/users/me/password", {
        method: "PATCH",
        body: { newPassword, code: otpCode.trim() },
      });
      setPasswordSuccess("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setOtpStep("idle");
      setOtpCode("");
      setTimeout(() => setPasswordSuccess(""), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const hasPhone = Boolean(phone && phone.trim().length === 10);
  const initialChar =
    name && typeof name === "string" && name.trim().length > 0
      ? name.trim().slice(0, 1).toUpperCase()
      : "U";

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* Header Profile Summary */}
      <GlassCard className="flex items-start gap-3 overflow-hidden bg-gradient-to-br from-primary/[0.08] via-surface to-surface p-4 sm:items-center sm:gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-white shadow-md sm:size-12 sm:text-xl">
          {initialChar}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-display text-xl font-bold text-ink [overflow-wrap:anywhere] sm:text-2xl">
              {name || "User Profile"}
            </h2>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary sm:px-3 sm:text-xs">
              {roleLabel}
            </span>
          </div>
          <div className="mt-2 grid min-w-0 gap-0.5 text-xs text-muted sm:text-sm">
            <p className="min-w-0 [overflow-wrap:anywhere]">{email || "No email set"}</p>
            <p>{hasPhone ? `+91 ${phone}` : "No valid 10-digit mobile number added"}</p>
          </div>
        </div>
      </GlassCard>

      {/* Section 1: Edit Profile Details */}
      <GlassCard className="space-y-3 p-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <UserIcon className="size-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-ink">Personal Information</h3>
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="name"
              label="Full Name"
              leading={<UserIcon className="size-4" />}
              value={name}
              onChange={(e) => setName(e.target.value.replace(NON_NAME_CHARS, ""))}
              placeholder="Full name (letters only)"
              required
            />
            <Input
              name="email"
              label="Email Address"
              type="email"
              leading={<Mail className="size-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <Input
              name="phone"
              label="Mobile Number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              leading={<Phone className="size-4" />}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Strict 10-digit mobile number"
              hint={!hasPhone ? "⚠️ A valid 10-digit mobile number is required to receive OTP for password resets." : undefined}
            />
          </div>

          <div className="pt-1 sm:pt-2">
            <Button type="submit" size="md" disabled={profileSaving} className="w-full sm:w-auto">
              {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Profile Changes
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* Section 2: Password Reset with OTP Verification */}
      <GlassCard className="space-y-3 p-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <ShieldCheck className="size-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-ink">Password &amp; Security</h3>
        </div>

        {/* Notice if no valid 10-digit phone number set */}
        {!hasPhone ? (
          <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 sm:p-5">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle className="size-5 text-amber-600" />
              <span>10-Digit Mobile Number Required</span>
            </div>
            <p className="text-sm">
              No valid 10-digit mobile number is set for your account. Please enter and save your 10-digit mobile number in the form above before changing your password.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Step 1 & 2: OTP Verification Card */}
            <div className="space-y-3 rounded-xl border border-line bg-surface-muted/40 p-3">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm">Security OTP Verification</p>
                  <p className="text-xs text-muted mt-0.5">
                    An OTP will be sent to <span className="font-medium text-ink">+91 {phone}</span> to confirm ownership before changing password.
                  </p>
                </div>
                {otpStep === "verified" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> OTP Verified
                  </span>
                )}
              </div>

              {otpError && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> {otpError}
                </p>
              )}
              {otpSuccess && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> {otpSuccess}
                </p>
              )}

              {otpStep === "idle" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="h-auto min-h-9 w-full whitespace-normal py-2.5 text-center sm:w-auto">
                  {otpSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Request OTP to Change Password
                </Button>
              )}

              {otpStep === "sent" && (
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <Input
                    name="otpCode"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="tracking-widest font-mono text-center"
                  />
                  <Button size="sm" onClick={handleVerifyOtp} disabled={otpVerifying || !otpCode} className="w-full sm:w-auto">
                    {otpVerifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Verify OTP
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleSendOtp} disabled={otpSending} className="w-full sm:w-auto">
                    Resend
                  </Button>
                </div>
              )}
            </div>

            {/* Step 3: Password Form (Unlocked when verified) */}
            <form onSubmit={handleChangePassword} className="space-y-3">
              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  name="newPassword"
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  leading={<KeyRound className="size-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="text-muted hover:text-ink transition-colors p-1 cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                  placeholder="Min 6 characters (any symbols)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={otpStep !== "verified"}
                  required
                />
                <Input
                  name="confirmPassword"
                  label="Confirm New Password"
                  type={showPassword ? "text" : "password"}
                  leading={<Lock className="size-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="text-muted hover:text-ink transition-colors p-1 cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={otpStep !== "verified"}
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    disabled={otpStep !== "verified"}
                    className="size-4 rounded border-line text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <span>Show password</span>
                </label>
              </div>

              <div className="pt-1">
                <Button type="submit" size="md" disabled={otpStep !== "verified" || passwordSaving} className="w-full sm:w-auto">
                  {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Update Password
                </Button>
                {otpStep !== "verified" && (
                  <p className="mt-2 text-xs text-muted">
                    🔒 Verify your phone via OTP above to unlock password update.
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
