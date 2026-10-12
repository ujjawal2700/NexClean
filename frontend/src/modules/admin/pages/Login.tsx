import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { ApiError } from "@shared/lib/api";
import { useAdminSession } from "../store/sessionStore";
import { useAdminLogin, useRequestAdminPasswordReset, useResetAdminPassword } from "../api/admin.api";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = useAdminSession((s) => s.authenticated);
  const setSession = useAdminSession((s) => s.setSession);
  const login = useAdminLogin();
  const requestReset = useRequestAdminPasswordReset();
  const resetPassword = useResetAdminPassword();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(() => {
    const changed =
      (location.state as { passwordChanged?: boolean } | null)?.passwordChanged ||
      sessionStorage.getItem("nexclean-admin-password-changed") === "1";
    if (changed) sessionStorage.removeItem("nexclean-admin-password-changed");
    return changed ? "Password updated. Sign in with your new password." : "";
  });

  // Already logged in — skip the login form entirely. Must come after every
  // hook call above (Rules of Hooks): this becomes true mid-session right
  // after a successful login, and an earlier return here would make this
  // component render fewer hooks than its previous pass.
  if (authenticated) return <Navigate to="/admin" replace />;

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email");
    if (password.length < 1) return setError("Enter your password");
    setError("");
    try {
      const { token, user } = await login.mutateAsync({ email, password });
      setSession(token, user.name, (user as any).permissions || []);
      navigate("/admin", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't sign you in. Please try again.");
    }
  };

  const sendResetCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email");
    setError("");
    setSuccess("");
    try {
      await requestReset.mutateAsync(email);
      setResetSent(true);
      setSuccess("If this email belongs to an active admin account, a 6-digit reset code has been sent.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send the reset code.");
    }
  };

  const confirmReset = async () => {
    if (!/^\d{6}$/.test(resetCode)) return setError("Enter the 6-digit reset code");
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return setError("Use 8+ characters with uppercase, lowercase, and a number");
    }
    if (newPassword !== confirmPassword) return setError("New passwords do not match");
    setError("");
    try {
      await resetPassword.mutateAsync({ email, code: resetCode, newPassword });
      setMode("login");
      setResetSent(false);
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setSuccess("Password reset successfully. Sign in with your new password.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset the password.");
    }
  };

  const backToLogin = () => {
    setMode("login");
    setResetSent(false);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/admin">
            <Logo variant="full" className="h-20 md:h-24" />
          </Link>
        </div>

        <div className="glass rounded-card p-8 shadow-[var(--shadow-lift)]">
          <Badge className="mb-5">Admin Console</Badge>
          <h1 className="text-2xl text-ink">{mode === "login" ? "Sign in to manage NexClean" : "Reset admin password"}</h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "login" ? "Operations, agents, pricing & campaigns." : "We’ll email a short-lived security code to your admin address."}
          </p>

          {success && (
            <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {success}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Input name="email" type="email" label="Email" leading={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode === "login" ? (
              <>
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  leading={<Lock className="size-4" />}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  error={error}
                  trailing={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="cursor-pointer text-muted transition-colors hover:text-ink focus:outline-none" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                <button type="button" onClick={() => { setMode("reset"); setError(""); setSuccess(""); }} className="ml-auto block text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </button>
                <Button className="w-full" onClick={submit} disabled={login.isPending}>
                  {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Sign in <ArrowRight className="size-4" /></>}
                </Button>
              </>
            ) : !resetSent ? (
              <>
                {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
                <Button className="w-full" onClick={sendResetCode} disabled={requestReset.isPending}>
                  {requestReset.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Mail className="size-4" /> Send reset code</>}
                </Button>
              </>
            ) : (
              <>
                <Input name="resetCode" label="6-digit reset code" inputMode="numeric" maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))} />
                <Input name="newPassword" type={showPassword ? "text" : "password"} label="New password" leading={<Lock className="size-4" />} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="8+ characters with upper, lower, and a number" />
                <Input name="confirmPassword" type={showPassword ? "text" : "password"} label="Confirm new password" leading={<Lock className="size-4" />} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={error} />
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                  <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="size-4 rounded border-line text-primary" /> Show passwords
                </label>
                <Button className="w-full" onClick={confirmReset} disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? <Loader2 className="size-4 animate-spin" /> : <><ShieldCheck className="size-4" /> Reset password</>}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { setResetSent(false); setError(""); setSuccess(""); }}>
                  Send another code
                </Button>
              </>
            )}

            {mode === "reset" && (
              <button type="button" onClick={backToLogin} className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                <ArrowLeft className="size-4" /> Back to sign in
              </button>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Restricted access · authorized staff only
          </p>
        </div>
      </div>
    </main>
  );
}
