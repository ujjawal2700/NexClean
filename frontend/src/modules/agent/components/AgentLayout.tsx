import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListChecks, Wallet, User, MapPinOff, Bell } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { getPushToken, saveDeviceToken } from "@shared/lib/push";
import {
  useAgentMe,
  useToggleOnline,
  useHeartbeat,
  useRegisterToken,
  useAgentNotifications,
} from "../api/agent.api";
import { useAgentDispatch } from "../hooks/useAgentDispatch";
import { OfferOverlay } from "./OfferOverlay";

const HEARTBEAT_INTERVAL_MS = 25_000;

/** Registers this device for push once per session so offers ping when backgrounded. */
function useRegisterPushToken() {
  const registerToken = useRegisterToken();
  const registered = useRef(false);
  useEffect(() => {
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
  }, []);
}

/** Keeps the agent's "live" status fresh on the server for as long as this layout is mounted. */
function useAgentHeartbeat() {
  const heartbeat = useHeartbeat();

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
  const toggle = useToggleOnline();
  const online = me?.online ?? false;
  const isUnverified = me?.agentStatus !== "verified";
  return (
    <button
      onClick={() => toggle.mutate(!online)}
      disabled={toggle.isPending || isUnverified}
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
      {online ? "Online" : "Offline"}
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
  const navigate = useNavigate();
  const { data: me } = useAgentMe();
  useAgentHeartbeat();
  useRegisterPushToken();
  const dispatch = useAgentDispatch();

  const showLocationNudge = (me?.online ?? false) && !dispatch.locating;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg">
      {/* Incoming-offer popup — rendered above everything, on every page. */}
      <OfferOverlay dispatch={dispatch} />

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

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-5 sm:pt-8 md:pb-16">
        {showLocationNudge && (
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            <MapPinOff className="size-4 shrink-0" />
            <span>Turn on location access to receive nearby job requests while you're online.</span>
          </div>
        )}
        {children}
      </main>

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
