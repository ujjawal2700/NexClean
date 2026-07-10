import { useState, useEffect, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useAdminSession } from "../store/sessionStore";
import { useAgents, useLeads, useAdminMe } from "../api/admin.api";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, permission: "dashboard" },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarRange, end: false, permission: "bookings" },
  { to: "/admin/dispatch", label: "Dispatch", icon: Radio, end: false, permission: "bookings" },
  { to: "/admin/customers", label: "Customers", icon: Contact2, end: false, permission: "customers" },
  { to: "/admin/agents", label: "Agents", icon: Users, end: false, permission: "agents" },
  { to: "/admin/agent-verification", label: "Agent Verification", icon: BadgeCheck, end: false, permission: "agents" },
  { to: "/admin/leads", label: "Leads", icon: Rocket, end: false, permission: "leads" },
  { to: "/admin/payments", label: "Payments", icon: Wallet, end: false, permission: "payments" },
  { to: "/admin/pricing", label: "Pricing", icon: Tag, end: false, permission: "pricing" },
  { to: "/admin/area-alerts", label: "Area Alerts", icon: Radar, end: false, permission: "area-alerts" },
  { to: "/admin/notifications", label: "Notifications", icon: Megaphone, end: false, permission: "notifications" },
  { to: "/admin/plans", label: "Plans", icon: CreditCard, end: false, permission: "plans" },
  { to: "/admin/locations", label: "Locations", icon: MapPin, end: false, permission: "locations" },
  { to: "/admin/vehicle-categories", label: "Vehicle Categories", icon: Layers, end: false, permission: "vehicle-categories" },
  { to: "/admin/vehicle-brands", label: "Vehicle Brands", icon: Car, end: false, permission: "vehicle-brands" },
  { to: "/admin/promotions", label: "Coupon & Promotions", icon: Ticket, end: false, permission: "promotions" },
  { to: "/admin/special-coupons", label: "Special Coupons", icon: Sparkles, end: false, permission: "special-coupons" },
  { to: "/admin/referrals", label: "Referrals", icon: Gift, end: false, permission: "referrals" },
  { to: "/admin/content", label: "Content", icon: FileText, end: false, permission: "content" },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, end: false, permission: "reports" },
  { to: "/admin/roles", label: "Role Management", icon: ShieldCheck, end: false, permission: "roles" },
  { to: "/admin/support", label: "Support Chat", icon: MessageSquare, end: false, permission: "chat" },
];


function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { data: agents = [] } = useAgents();
  const { data: leads = [] } = useLeads();
  const permissions = useAdminSession((s) => s.permissions) || [];
  const pendingCount = agents.filter((a) => a.status === "pending").length;
  const leadCount = leads.length;

  const filteredNav = NAV.filter((item) => {
    if (permissions.includes("*")) return true;
    return permissions.includes(item.permission);
  });

  return (
    <nav className="flex flex-col gap-1">
      {filteredNav.map((item) => {
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
    </nav>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { token, name, clear, permissions, setSession } = useAdminSession();
  const [open, setOpen] = useState(false);

  const { data: me, error } = useAdminMe();

  const onLogout = () => {
    clear();
    qc.clear();
    navigate("/admin/login");
  };

  useEffect(() => {
    if (me && token) {
      setSession(token, me.name, me.permissions);
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
            <div className="text-right">
              <p className="text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-muted">
                {permissions.includes("*") ? "Super Admin" : "Staff Member"}
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white">
              {name.slice(0, 1).toUpperCase()}
            </span>
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
