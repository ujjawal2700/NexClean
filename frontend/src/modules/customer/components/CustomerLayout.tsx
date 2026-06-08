import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarPlus, ClipboardList, CreditCard, User, LogOut } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useAuthStore } from "../store/authStore";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/book", label: "Book", icon: CalendarPlus, end: false },
  { to: "/app/bookings", label: "Bookings", icon: ClipboardList, end: false },
  { to: "/app/plans", label: "Plans", icon: CreditCard, end: false },
  { to: "/app/profile", label: "Profile", icon: User, end: false },
];

export function CustomerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { name, logout } = useAuthStore();

  const onLogout = () => {
    logout();
    navigate("/app/login");
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <button onClick={() => navigate("/app")} className="text-[1.1rem]" aria-label="Dashboard">
            <Logo variant="full" />
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

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{name || "Member"}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* content */}
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16">{children}</main>

      {/* mobile tab bar */}
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
