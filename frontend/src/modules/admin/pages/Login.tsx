import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
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

  const [email, setEmail] = useState("admin@nexclean.com");
  const [password, setPassword] = useState("");
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
            <Logo variant="full" />
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
              type="password"
              label="Password"
              leading={<Lock className="size-4" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              hint="Demo: admin@nexclean.com / admin123"
              error={error}
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
