import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@shared/lib/api";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListChecks, Wallet, User, Bell } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { LiquidTabBar } from "@shared/components/LiquidTabBar";
import { Logo } from "@shared/components/brand/Logo";
import { getPushToken } from "@shared/lib/push";
import {
  meKey,
  useAgentMe,
  useHeartbeat,
  useRegisterToken,
  useAgentNotifications,
} from "../api/agent.api";
import { useAgentDispatch } from "../hooks/useAgentDispatch";
import { useOnlineSwitch } from "../hooks/useOnlineSwitch";
import { RescheduledJobDialog } from "./RescheduledJobDialog";
import { OfferOverlay } from "./OfferOverlay";
import { useAgentSession } from "../store/sessionStore";
import { BookingCancelledDialog } from "@shared/components/BookingCancelledDialog";
import { AnimatePresence } from "motion/react";

const HEARTBEAT_INTERVAL_MS = 25_000;

/** Registers this device for push once per session so offers ping when backgrounded. */
function useRegisterPushToken() {
  const registerToken = useRegisterToken();
  const registered = useRef(false);
  const qc = useQueryClient();

  // A token the store app hands over later (via the push bridge) changes
  // whether offers can reach a closed app — refresh what the screens show.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: meKey });
    window.addEventListener("nexclean:push-registered", refresh);
    return () => window.removeEventListener("nexclean:push-registered", refresh);
  }, [qc]);

  useEffect(() => {
    let inFlight = false;
    let disposed = false;
    const register = async () => {
      if (registered.current || inFlight || disposed) return;
      inFlight = true;
      // Ask the store app to resend its native token after sign-in/resume.
      window.dispatchEvent(new Event("nexclean:push-bridge-ready"));
      try {
        const token = await getPushToken();
        if (disposed || token.startsWith("web-")) return;
        await registerToken.mutateAsync(token);
        registered.current = true;
        void qc.invalidateQueries({ queryKey: meKey });
      } catch {
        // Retry on the next resume/network recovery rather than marking a
        // failed first attempt as registered for the entire session.
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void register();
    };
    void register();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", register);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", register);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Keeps the agent's "live" status fresh on the server for as long as this layout is mounted. */
function useAgentHeartbeat() {
  const heartbeat = useHeartbeat();
  const qc = useQueryClient();

  // A 401 here means this session was ended elsewhere (signed in on another
  // phone, suspended). Re-reading the profile lets the route guard log out.
  useEffect(() => {
    if (heartbeat.error instanceof ApiError && heartbeat.error.status === 401) {
      qc.invalidateQueries({ queryKey: meKey });
    }
  }, [heartbeat.error, qc]);

  useEffect(() => {
    heartbeat.mutate();
    const interval = setInterval(() => heartbeat.mutate(), HEARTBEAT_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") heartbeat.mutate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const NAV = [
  { to: "/agent", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/agent/jobs", label: "Jobs", icon: ListChecks, end: false },
  { to: "/agent/earnings", label: "Earnings", icon: Wallet, end: false },
  { to: "/agent/profile", label: "Profile", icon: User, end: false },
];

export function OnlineToggle() {
  const { data: me } = useAgentMe();
  const { online, pending, toggle } = useOnlineSwitch();
  const isUnverified = me?.agentStatus !== "verified";
  return (
    <button
      onClick={() => void toggle()}
      disabled={pending || isUnverified}
      data-testid="online-toggle"
      className={cn(
        "flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
        isUnverified
          ? "opacity-50 cursor-not-allowed border-line bg-surface text-muted"
          : online
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border-line bg-surface text-muted",
      )}
      aria-pressed={online}
    >
      <span className={cn("relative flex size-2.5", !online && "opacity-50")}>
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={cn("relative inline-flex size-2.5 rounded-full", online ? "bg-emerald-500" : "bg-muted")} />
      </span>
      {pending ? "Updating…" : online ? "Online" : "Offline"}
    </button>
  );
}

/** Inbox entry point, with a count of what hasn't been read. */
function NotificationBell() {
  const { data: items = [] } = useAgentNotifications();
  const unread = items.filter((n) => !n.read).length;

  return (
    <NavLink
      to="/agent/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className={({ isActive }) =>
        cn(
          "relative grid size-9 place-items-center rounded-xl border border-line bg-surface transition-colors",
          isActive ? "text-primary" : "text-ink-soft hover:text-primary",
        )
      }
      data-testid="agent-notifications-bell"
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-white"
          data-testid="agent-unread-count"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </NavLink>
  );
}

export function AgentLayout({ children }: { children: ReactNode }) {
  // "Add to Home Screen" from the partner app should open the partner app.
  // index.html links the customer manifest; swap it while this layout is up.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const previous = link.href;
    link.href = "/agent.webmanifest";
    return () => {
      link.href = previous;
    };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  useAgentHeartbeat();
  useRegisterPushToken();
  const dispatch = useAgentDispatch();
  const availability = useOnlineSwitch();
  const clearSession = useAgentSession((s) => s.clear);

  // The tab bar belongs only to the four top-level destinations. Keeping it
  // off detail/settings screens prevents it competing with those pages' back
  // navigation and primary actions.
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const showMobileNav = ["/agent", "/agent/jobs", "/agent/earnings", "/agent/profile"].includes(normalizedPath);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      {/* Incoming-offer popup — rendered above everything, on every page. */}
      {!dispatch.sessionReplaced && <OfferOverlay dispatch={dispatch} />}
      {!dispatch.sessionReplaced && !dispatch.cancelledJobId && <RescheduledJobDialog />}

      {/* This account was signed in on another phone — takes priority over everything. */}
      {dispatch.sessionReplaced ? (
        <BookingCancelledDialog
          title="Logged out"
          description="Your account was just logged in on another phone, so you've been logged out here. Log in again to use this phone instead."
          onConfirm={() => {
            clearSession();
            navigate("/agent/login", { replace: true });
          }}
        />
      ) : dispatch.cancelledJobId && (
        <BookingCancelledDialog
          title="Job cancelled"
          description="This job has been cancelled. You don't need to go — you're free to take new jobs."
          onConfirm={() => {
            dispatch.dismissCancelled();
            navigate("/agent", { replace: true });
          }}
        />
      )}

      {/* Header top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-surface/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <button onClick={() => navigate("/agent")} className="flex items-center gap-2 text-[1.05rem] cursor-pointer" aria-label="Dashboard">
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

          <div className="flex items-center gap-3">
            <NotificationBell />
            <OnlineToggle />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-5xl px-4 pt-6 sm:px-5 sm:pt-8",
          showMobileNav ? "mobile-content-with-nav" : "pb-8",
        )}>
        {availability.error && <p role="alert" className="mb-4 text-sm text-red-600">{availability.error}</p>}
        {children}
      </main>

      <AnimatePresence>
        {showMobileNav && (
          <LiquidTabBar
            key="agent-mobile-nav"
            testId="agent-mobile-nav"
            ariaLabel="Agent navigation"
            tabs={NAV}
            slideTransition
          />
        )}
      </AnimatePresence>
    </div>
  );
}
