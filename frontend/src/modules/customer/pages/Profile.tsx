import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import {
  Car,
  MapPin,
  User,
  Mail,
  Phone,
  Gift,
  Pencil,
  ChevronRight,
  HelpCircle,
  LogOut,
  Calendar,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useMe } from "../api/queries";

export function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useSessionStore((s) => s.clear);
  const { data: me } = useMe();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const vehicles = me?.vehicles ?? [];
  const addresses = me?.addresses ?? [];

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    clear();
    qc.clear();
    navigate("/app/login");
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!me?.name) return "U";
    return me.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title */}
      <h1 className="font-display text-3xl text-ink">Profile</h1>

      {/* User Header Info Card */}
      <GlassCard className="flex flex-col sm:flex-row items-center gap-5 p-6 bg-gradient-to-br from-surface to-surface-muted/30">
        <div className="size-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-display text-2xl font-bold text-primary shadow-sm shrink-0">
          {getInitials()}
        </div>
        <div className="text-center sm:text-left space-y-1 min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold text-ink truncate">{me?.name || "Member"}</h2>
          <p className="text-sm text-ink-soft truncate">{me?.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted pt-1">
            <Calendar className="size-3.5" />
            <span>Member since {me?.createdAt ? new Date(me.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "N/A"}</span>
          </div>
        </div>
      </GlassCard>

      {/* Account Details Card */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-line/50 pb-2">
          <h3 className="font-display text-lg font-semibold text-ink">Account Summary</h3>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-3 py-1.5 border-b border-line/30 last:border-0">
            <User className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Full name</span>
            <span className="font-medium text-ink truncate">{me?.name || "—"}</span>
          </div>
          <div className="flex items-center gap-3 py-1.5 border-b border-line/30 last:border-0">
            <Mail className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Email</span>
            <span className="font-medium text-ink truncate">{me?.email || "—"}</span>
          </div>
          <div className="flex items-center gap-3 py-1.5 last:border-0">
            <Phone className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Mobile</span>
            <span className="font-medium text-ink truncate">+91 {me?.phone || "—"}</span>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Options Menu */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink px-1">Settings &amp; Preferences</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Edit Profile Link */}
          <Link to="/app/profile/edit">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Pencil className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">Edit profile</p>
                <p className="text-xs text-muted truncate">Name, email &amp; phone number</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Refer & Earn Link */}
          <Link to="/app/profile/refer">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Gift className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">Refer &amp; earn</p>
                <p className="text-xs text-muted truncate">Invite friends &amp; get rewards</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Your Garage Link */}
          <Link to="/app/profile/vehicles">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Car className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">Your garage</p>
                <p className="text-xs text-muted truncate">
                  {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} registered
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Saved Addresses Link */}
          <Link to="/app/profile/addresses">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">Saved addresses</p>
                <p className="text-xs text-muted truncate">
                  {addresses.length} address{addresses.length === 1 ? "" : "es"} saved
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>
        </div>

        {/* Help & Support Link (spanning full width) */}
        <Link to="/app/help" className="block mt-3">
          <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-ink text-sm sm:text-base">Help &amp; Support</p>
              <p className="text-xs text-muted">FAQs, CMS documents &amp; Live support chat</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </GlassCard>
        </Link>
      </div>

      {/* Log out Button */}
      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full mt-6 text-red-500 border-red-200 hover:bg-red-50/15 flex items-center justify-center gap-2 bg-surface"
      >
        <LogOut className="size-[18px]" />
        <span>Log out</span>
      </Button>

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-sm space-y-6 bg-surface p-6 shadow-xl border border-line">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <LogOut className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Log Out</h3>
              <p className="text-sm text-muted leading-relaxed">
                Are you sure you want to log out of your account? You will need to log back in to manage your bookings and subscriptions.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmLogout}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Log out
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
