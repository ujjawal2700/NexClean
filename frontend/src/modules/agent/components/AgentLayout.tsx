import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ListChecks, Wallet, User, LogOut } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useAgentSession } from "../store/sessionStore";
import { useAgentMe, useToggleOnline } from "../api/agent.api";

const NAV = [
  { to: "/agent", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/agent/jobs", label: "Jobs", icon: ListChecks, end: false },
  { to: "/agent/earnings", label: "Earnings", icon: Wallet, end: false },
  { to: "/agent/profile", label: "Profile", icon: User, end: false },
];

export function OnlineToggle() {
  const { data: me } = useAgentMe();
  const toggle = useToggleOnline();
  const online = me?.online ?? false;
  return (
    <button
      onClick={() => toggle.mutate(!online)}
      disabled={toggle.isPending}
      className={cn(
        "flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
        online ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-line bg-surface text-muted",
      )}
      aria-pressed={online}
    >
      <span className={cn("relative flex size-2.5", !online && "opacity-50")}>
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={cn("relative inline-flex size-2.5 rounded-full", online ? "bg-emerald-500" : "bg-muted")} />
      </span>
      {online ? "Online" : "Offline"}
    </button>
  );
}

export function AgentLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useAgentSession((s) => s.clear);

  const onLogout = () => {
    clear();
    qc.clear();
    navigate("/agent/login");
  };

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <button onClick={() => navigate("/agent")} className="flex items-center gap-2 text-[1.05rem]">
            <Logo variant="full" />
            <span className="hidden rounded-pill bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:inline">
              Agent
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-ink-soft hover:text-primary",
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <OnlineToggle />
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-28 pt-8 md:pb-16">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
