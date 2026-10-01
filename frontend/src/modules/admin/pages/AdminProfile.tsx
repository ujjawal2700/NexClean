import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  useAdminMe,
  useChangeAdminEmail,
  useChangeAdminPassword,
  useUpdateAdminProfile,
} from "../api/admin.api";
import { useAdminSession } from "../store/sessionStore";
import { ApiError } from "@shared/lib/api";
import { GlassCard } from "@shared/ui/GlassCard";
import { Skeleton } from "@shared/ui/Skeleton";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";

const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u;
const passwordProblem = (value: string) => {
  if (value.length < 8) return "Use at least 8 characters";
  if (!/[a-z]/.test(value)) return "Add a lowercase letter";
  if (!/[A-Z]/.test(value)) return "Add an uppercase letter";
  if (!/\d/.test(value)) return "Add a number";
  return "";
};
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function Notice({ kind, children }: { kind: "success" | "error"; children: string }) {
  const success = kind === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        success
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
          : "border-red-500/25 bg-red-500/10 text-red-600"
      }`}>
      {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function AdminProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading, error, refetch } = useAdminMe();
  const updateProfile = useUpdateAdminProfile();
  const changeEmail = useChangeAdminEmail();
  const changePassword = useChangeAdminPassword();
  const setSessionName = useAdminSession((state) => state.setName);
  const clearSession = useAdminSession((state) => state.clear);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setEmail(me.email ?? "");
  }, [me?.id, me?.name, me?.email]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-sm font-medium text-red-500">Failed to load admin profile details.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          <RefreshCw className="size-4" /> Retry loading
        </Button>
      </div>
    );
  }

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    const trimmed = name.trim();
    if (trimmed.length < 2 || !NAME_PATTERN.test(trimmed)) {
      setProfileError("Enter a valid name using letters only.");
      return;
    }
    try {
      const updated = await updateProfile.mutateAsync(trimmed);
      setName(updated.name);
      setSessionName(updated.name);
      await qc.invalidateQueries({ queryKey: ["admin", "me"] });
      setProfileMessage("Profile name updated successfully.");
    } catch (requestError) {
      setProfileError(errorMessage(requestError, "Could not update your profile."));
    }
  };

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailError("");
    setEmailMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!emailPassword) {
      setEmailError("Enter your current password to change the login email.");
      return;
    }
    try {
      const updated = await changeEmail.mutateAsync({ email: email.trim(), currentPassword: emailPassword });
      setEmail(updated.email);
      setEmailPassword("");
      await qc.invalidateQueries({ queryKey: ["admin", "me"] });
      setEmailMessage("Login email updated. Use this address the next time you sign in.");
    } catch (requestError) {
      setEmailError(errorMessage(requestError, "Could not update your login email."));
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (!currentPassword) return setPasswordError("Enter your current password.");
    const problem = passwordProblem(newPassword);
    if (problem) return setPasswordError(problem);
    if (newPassword !== confirmPassword) return setPasswordError("New passwords do not match.");
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      sessionStorage.setItem("nexclean-admin-password-changed", "1");
      clearSession();
      navigate("/admin/login", { replace: true });
    } catch (requestError) {
      setPasswordError(errorMessage(requestError, "Could not update your password."));
    }
  };

  const initial = (name.trim()[0] || "A").toUpperCase();
  const roleLabel = me.permissions?.includes("*") ? "Super Admin" : "Staff Member";

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Account &amp; Security</h1>
        <p className="mt-1 text-sm text-muted">Manage your admin identity and login credentials.</p>
      </div>

      <GlassCard className="flex items-center gap-4 overflow-hidden bg-gradient-to-br from-primary/[0.1] via-surface to-surface p-5 sm:p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shadow-md sm:size-16 sm:text-2xl">{initial}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-display text-xl font-bold text-ink [overflow-wrap:anywhere] sm:text-2xl">{me.name}</h2>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{roleLabel}</span>
          </div>
          <p className="mt-1 min-w-0 text-sm text-muted [overflow-wrap:anywhere]">{me.email}</p>
        </div>
      </GlassCard>

      <GlassCard className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <User className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Personal information</h2>
        </div>
        {profileMessage && <Notice kind="success">{profileMessage}</Notice>}
        {profileError && <Notice kind="error">{profileError}</Notice>}
        <form onSubmit={saveName} className="space-y-4">
          <Input name="adminName" label="Display name" leading={<User className="size-4" />} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <Button type="submit" size="sm" disabled={updateProfile.isPending} className="w-full sm:w-auto">
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save name
          </Button>
        </form>
      </GlassCard>

      <GlassCard className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Mail className="size-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Login email</h2>
            <p className="text-xs text-muted">Your current password is required to protect this change.</p>
          </div>
        </div>
        {emailMessage && <Notice kind="success">{emailMessage}</Notice>}
        {emailError && <Notice kind="error">{emailError}</Notice>}
        <form onSubmit={saveEmail} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="adminEmail" type="email" label="Email address" leading={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input name="emailCurrentPassword" type="password" label="Current password" leading={<KeyRound className="size-4" />} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" size="sm" disabled={changeEmail.isPending} className="w-full sm:w-auto">
            {changeEmail.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Update login email
          </Button>
        </form>
      </GlassCard>

      <GlassCard className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
            <p className="text-xs text-muted">Changing it securely signs out every active admin session.</p>
          </div>
        </div>
        {passwordError && <Notice kind="error">{passwordError}</Notice>}
        <form onSubmit={savePassword} className="space-y-4">
          <Input name="currentPassword" type={showPasswords ? "text" : "password"} label="Current password" leading={<KeyRound className="size-4" />} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="newPassword" type={showPasswords ? "text" : "password"} label="New password" leading={<KeyRound className="size-4" />} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" hint="8+ characters with upper, lower, and a number" />
            <Input name="confirmPassword" type={showPasswords ? "text" : "password"} label="Confirm new password" leading={<KeyRound className="size-4" />} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
            <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} className="size-4 rounded border-line text-primary" />
            {showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />} Show passwords
          </label>
          <div>
            <Button type="submit" size="sm" disabled={changePassword.isPending} className="w-full sm:w-auto">
              {changePassword.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Change password
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
