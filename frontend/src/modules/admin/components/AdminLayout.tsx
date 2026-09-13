import { useState, useEffect, type ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Contact2,
  Wallet,
  Tag,
  Radar,
  Megaphone,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  MapPin,
  FileText,
  Car,
  Layers,
  Ticket,
  BadgeCheck,
  Rocket,
  Gift,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  Radio,
  Search,
  HandCoins,
  ChevronDown,
  Clock,
  Banknote,
  Undo2,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useAdminSession } from "../store/sessionStore";
import { useAgents, useLeads, useAdminMe } from "../api/admin.api";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; permission: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

/**
 * Grouped by what an admin is trying to *do*, rather than one flat list of
 * twenty-odd links. Order within a group runs from the screen used daily to the
 * one touched occasionally.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, permission: "dashboard" },
      { to: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/admin/bookings", label: "Bookings", icon: CalendarRange, permission: "bookings" },
      { to: "/admin/dispatch", label: "Dispatch", icon: Radio, permission: "bookings" },
      { to: "/admin/off-peak-hours", label: "Off-Peak Hours", icon: Clock, permission: "off-peak-hours" },
      { to: "/admin/area-alerts", label: "Area Alerts", icon: Radar, permission: "area-alerts" },
      { to: "/admin/support", label: "Support Chat", icon: MessageSquare, permission: "chat" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { to: "/admin/customers", label: "Customers", icon: Contact2, permission: "customers" },
      { to: "/admin/agents", label: "Agents", icon: Users, permission: "agents" },
      { to: "/admin/agent-verification", label: "Agent Verification", icon: BadgeCheck, permission: "agents" },
      { to: "/admin/leads", label: "Leads", icon: Rocket, permission: "leads" },
    ],
  },
  {
    // Every money-related screen lives here — payments, the refunds queue,
    // agent payouts, and pricing/plans — so tracking the app's finances end
    // to end never means hopping to a different part of the sidebar.
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/payments", label: "Payments", icon: Wallet, permission: "payments" },
      { to: "/admin/refunds", label: "Refunds", icon: Undo2, permission: "payments" },
      { to: "/admin/agent-payouts", label: "Agent Payouts", icon: HandCoins, permission: "agent-payouts" },
      { to: "/admin/payout-requests", label: "Payout Requests", icon: Banknote, permission: "payout-requests" },
      { to: "/admin/pricing", label: "Pricing", icon: Tag, permission: "pricing" },
      { to: "/admin/plans", label: "Plans", icon: CreditCard, permission: "plans" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { to: "/admin/vehicle-categories", label: "Vehicle Categories", icon: Layers, permission: "vehicle-categories" },
      { to: "/admin/vehicle-brands", label: "Vehicle Brands", icon: Car, permission: "vehicle-brands" },
      { to: "/admin/locations", label: "Locations", icon: MapPin, permission: "locations" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { to: "/admin/promotions", label: "Coupon & Promotions", icon: Ticket, permission: "promotions" },
      { to: "/admin/special-coupons", label: "Special Coupons", icon: Sparkles, permission: "special-coupons" },
      { to: "/admin/referrals", label: "Referrals", icon: Gift, permission: "referrals" },
      { to: "/admin/notifications", label: "Notifications", icon: Megaphone, permission: "notifications" },
      { to: "/admin/content", label: "Content", icon: FileText, permission: "content" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ to: "/admin/roles", label: "Role Management", icon: ShieldCheck, permission: "roles" }],
  },
];

const COLLAPSED_KEY = "nexclean-admin-nav-collapsed";

/** Groups the admin has folded away, remembered between visits. */
function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}


function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsed);
  const { pathname } = useLocation();
  const { data: agents = [] } = useAgents();
  const { data: leads = [] } = useLeads();
  const permissions = useAdminSession((s) => s.permissions) || [];
  const pendingCount = agents.filter((a) => a.status === "pending").length;
  const leadCount = leads.filter((l) => (l.status ?? "new") === "new").length;

  const query = search.trim().toLowerCase();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const hasPermission = permissions.includes("*") || permissions.includes(item.permission);
      if (!hasPermission) return false;
      // Searching matches the group name too, so "money" surfaces everything
      // filed under it without the admin having to recall each screen's name.
      return !query || item.label.toLowerCase().includes(query) || group.label.toLowerCase().includes(query);
    }),
    // A group whose every screen is off-limits to this role disappears entirely
    // rather than leaving an empty heading behind.
  })).filter((group) => group.items.length > 0);

  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* private mode / storage blocked — the fold just won't persist */
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative px-0.5">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections..."
          className="h-9 w-full rounded-xl border border-line bg-surface/60 pl-8 pr-7 text-xs text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-3">
        {groups.map((group) => {
          // While searching, show every match; and never hide the group holding
          // the page you're currently on, or the sidebar loses its "you are
          // here" marker the moment that group is folded.
          const holdsActive = group.items.some((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
          const isOpen = !!query || holdsActive || !collapsed.includes(group.id);

          return (
            <div key={group.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className="flex items-center justify-between px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
              >
                <span>{group.label}</span>
                <ChevronDown className={cn("size-3 transition-transform", !isOpen && "-rotate-90")} />
              </button>

              {isOpen &&
                group.items.map((item) => {
                  const isVerification = item.to === "/admin/agent-verification";
                  const isLeads = item.to === "/admin/leads";
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                        )
                      }
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="size-[18px]" />
                        <span>{item.label}</span>
                      </span>
                      {isVerification && pendingCount > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-orange-500 font-display text-[10px] font-semibold text-white">
                          {pendingCount}
                        </span>
                      )}
                      {isLeads && leadCount > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-500 font-display text-[10px] font-semibold text-white">
                          {leadCount > 99 ? "99+" : leadCount}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
            </div>
          );
        })}
        {totalItems === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted">No sections match "{search}"</p>
        )}
      </nav>
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { token, name, clear, permissions = [], setSession } = useAdminSession();
  const [open, setOpen] = useState(false);

  const { data: me, error } = useAdminMe();

  const onLogout = () => {
    clear();
    qc.clear();
    navigate("/admin/login");
  };

  useEffect(() => {
    if (me && token) {
      setSession(token, me.name, me.permissions || []);
    }
  }, [me, token, setSession]);

  useEffect(() => {
    if (error) {
      onLogout();
    }
  }, [error]);

  return (
    <div className="min-h-dvh bg-bg">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line/70 bg-surface/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2.5">
          <Logo variant="full" />
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.3em] text-muted">
            Admin Console
          </span>
        </div>
        <div className="mt-8 flex-1 overflow-y-auto" data-lenis-prevent="true">
          <NavItems />
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted"
        >
          <LogOut className="size-[18px] " /> Log out
        </button>
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface px-4 py-5">
            <div className="flex items-center justify-between px-2.5">
              <Logo variant="full" />
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5 text-muted" />
              </button>
            </div>
            <div className="mt-8 flex-1 overflow-y-auto" data-lenis-prevent="true">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-muted"
            >
              <LogOut className="size-[18px]" /> Log out
            </button>
          </aside>
        </div>
      )}

      {/* main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line/70 bg-surface/80 px-5 backdrop-blur-xl">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-6 text-ink" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/profile")}
              title="Click to edit profile & change password"
              className="flex items-center gap-3 rounded-2xl p-1.5 transition-all hover:bg-surface-muted/80 cursor-pointer group"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">{name}</p>
                <p className="text-xs text-muted">
                  {permissions?.includes("*") ? "Super Admin" : "Staff Member"}
                </p>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white shadow-sm ring-2 ring-primary/20 group-hover:scale-105 transition-transform">
                {name.slice(0, 1).toUpperCase()}
              </span>
            </button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="lg:hidden" aria-label="Log out">
              <LogOut className="size-4" />
            </Button>
          </div>

        </header>

        <main className="px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
