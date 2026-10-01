import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarPlus, ClipboardList, CreditCard, User, Bell, LogIn, Lock } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { LiquidTabBar } from "@shared/components/LiquidTabBar";
import { Button } from "@shared/ui/Button";
import { getPushToken, saveDeviceToken } from "@shared/lib/push";
import { useMe, useNotifications } from "../api/queries";
import { useRegisterToken } from "../api/mutations";
import { useSessionStore, useIsGuest } from "../store/sessionStore";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, authRequired: false },
  { to: "/app/book", label: "Book", icon: CalendarPlus, end: false, authRequired: true },
  { to: "/app/bookings", label: "Bookings", icon: ClipboardList, end: false, authRequired: true },
  { to: "/app/plans", label: "Plans", icon: CreditCard, end: false, authRequired: false },
  { to: "/app/profile", label: "Profile", icon: User, end: false, authRequired: true },
];

export function CustomerLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: notifications = [] } = useNotifications();
  const registerToken = useRegisterToken();
  const registered = useRef(false);
  const authenticated = useSessionStore((s) => s.authenticated);
  const isGuest = useIsGuest();

  const unread = notifications.filter((n) => !n.read).length;

  // The tab bar belongs to the five top-level tabs only. Nested screens
  // (edit profile, refer & earn, vehicles, wallet, notifications, help…) have
  // their own back button, and the bar there only competed with it.
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const showMobileNav = NAV.some((item) => item.to === path);

  /** Guests never reach a locked screen: the tap goes straight to the login. */
  const goToLogin = (from?: string) => navigate("/app/login", { state: from ? { from } : undefined });

  // Register this device for push once per session so the customer can
  // receive Smart Area Alerts and booking updates.
  useEffect(() => {
    if (!authenticated) return;
    if (registered.current) return;
    registered.current = true;
    // No requestPermission here on purpose: prompting on page load is how you
    // get permanently denied. This only picks up a real token when the user has
    // already granted permission; the Notifications screen does the asking.
    getPushToken()
      .then((t) => {
        saveDeviceToken(t);
        registerToken.mutate(t);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);


  // Live refreshes (bookings/notifications) come from the single customer
  // socket in CustomerApp's CustomerCompletionListener.

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg">
      {/* top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-surface/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
          <button onClick={() => navigate("/app")} className="text-[1.1rem] cursor-pointer" aria-label="Dashboard">
            <Logo variant="full" />
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const locked = isGuest && item.authRequired;
              const className =
                "flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors";
              return locked ? (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => goToLogin(item.to)}
                  className={cn(className, "text-ink-soft hover:text-primary")}
                  aria-label={`${item.label} — login required`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  <Lock className="size-3 text-muted" />
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(className, isActive ? "bg-primary/10 text-primary" : "text-ink-soft hover:text-primary")
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isGuest ? (
              <Button size="sm" onClick={() => goToLogin(location.pathname)}>
                <LogIn className="size-4" /> Log in
              </Button>
            ) : (
              <>
                <Link
                  to="/app/notifications"
                  className="relative grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-primary"
                  aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
                >
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <span className="hidden text-sm text-muted sm:inline">{me?.name || "Member"}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* guest notice */}
      {isGuest && (
        <div className="border-b border-line/70 bg-primary/5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-ink-soft sm:text-sm">
              You're browsing as a guest. Log in to book a wash, track orders and manage your profile.
            </p>
            <button
              type="button"
              onClick={() => goToLogin(location.pathname)}
              className="text-xs font-semibold text-primary hover:underline sm:text-sm"
            >
              Log in or sign up
            </button>
          </div>
        </div>
      )}

      {/* content */}
      <main
        className={cn(
          "mx-auto max-w-6xl px-4 pt-6 sm:px-5 sm:pt-8",
          showMobileNav ? "mobile-content-with-nav" : "pb-8",
        )}
      >
        {children}
      </main>

      {/* mobile tab bar */}
      {showMobileNav && (
        <LiquidTabBar
          testId="customer-mobile-nav"
          ariaLabel="Customer navigation"
          tabs={NAV.map((item) => ({ ...item, locked: isGuest && item.authRequired }))}
          onLockedPress={goToLogin}
        />
      )}
    </div>
  );
}
