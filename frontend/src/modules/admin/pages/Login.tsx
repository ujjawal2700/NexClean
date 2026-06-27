import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { ApiError } from "@shared/lib/api";
import { useAdminSession } from "../store/sessionStore";
import { useAdminLogin } from "../api/admin.api";

export function Login() {
  const navigate = useNavigate();
  const setSession = useAdminSession((s) => s.setSession);
  const login = useAdminLogin();

  const [email, setEmail] = useState("superadmin@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email");
    if (password.length < 1) return setError("Enter your password");
    setError("");
    try {
      const { token, user } = await login.mutateAsync({ email, password });
      setSession(token, user.name);
      navigate("/admin", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed. Is the API running?");
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo variant="full" className="h-20 md:h-24" />
          </Link>
        </div>

        <div className="glass rounded-card p-8 shadow-[var(--shadow-lift)]">
          <Badge className="mb-5">Admin Console</Badge>
          <h1 className="text-2xl text-ink">Sign in to manage NexClean</h1>
          <p className="mt-2 text-sm text-muted">Operations, agents, pricing &amp; campaigns.</p>

          <div className="mt-6 space-y-4">
            <Input name="email" type="email" label="Email" leading={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              leading={<Lock className="size-4" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              hint="Demo: superadmin@gmail.com / password123"
              error={error}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted hover:text-ink transition-colors focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
            <Button className="w-full" onClick={submit} disabled={login.isPending}>
              {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Sign in <ArrowRight className="size-4" /></>}
            </Button>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Restricted access · authorized staff only
          </p>
        </div>
      </div>
    </main>
  );
}
