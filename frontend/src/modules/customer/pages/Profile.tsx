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
  Coins,
  Pencil,
  ChevronRight,
  HelpCircle,
  LogOut,
  UserX,
  Calendar,
  Loader2,
  Bell,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useMe, useNotifications } from "../api/queries";
import { useDeactivateAccount } from "../api/mutations";

export function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useSessionStore((s) => s.clear);
  const { data: me } = useMe();
  const { data: notifications = [] } = useNotifications();
  const deactivateAccount = useDeactivateAccount();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;
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

  const confirmDeactivate = async () => {
    try {
      await deactivateAccount.mutateAsync();
    } catch {
      /* ignore */
    }
    setShowDeactivateConfirm(false);
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
      <h1 className="font-display text-2xl text-ink sm:text-3xl">Profile</h1>

      {/* User Header Info Card */}
      <GlassCard className="flex flex-col sm:flex-row items-center gap-5 p-6 bg-gradient-to-br from-surface to-surface-muted/30">
        <div className="size-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-display text-2xl font-bold text-primary shadow-sm shrink-0">
          {getInitials()}
        </div>
        <div className="text-center sm:text-left space-y-1 min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold text-ink truncate">
            {me?.name || "Member"}
          </h2>
          <p className="text-sm text-ink-soft truncate">{me?.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted pt-1">
            <Calendar className="size-3.5" />
            <span>
              Member since{" "}
              {me?.createdAt
                ? new Date(me.createdAt).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })
                : "N/A"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Account Details Card */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-line/50 pb-2">
          <h3 className="font-display text-lg font-semibold text-ink">
            Account Summary
          </h3>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-3 py-1.5 border-b border-line/30 last:border-0">
            <User className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Full name</span>
            <span className="font-medium text-ink truncate">
              {me?.name || "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 py-1.5 border-b border-line/30 last:border-0">
            <Mail className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Email</span>
            <span className="font-medium text-ink truncate">
              {me?.email || "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 py-1.5 last:border-0">
            <Phone className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Mobile</span>
            <span className="font-medium text-ink truncate">
              +91 {me?.phone || "—"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Options Menu */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink px-1">
          Settings &amp; Preferences
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Edit Profile Link */}
          <Link to="/app/profile/edit">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Pencil className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Edit profile
                </p>
                <p className="text-xs text-muted truncate">
                  Name, email &amp; phone number
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Wallet Link */}
          <Link to="/app/wallet">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                <Coins className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Wallet
                </p>
                <p className="text-xs text-muted truncate">
                  Coin balance &amp; history
                </p>
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
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Refer &amp; earn
                </p>
                <p className="text-xs text-muted truncate">
                  Invite friends &amp; get rewards
                </p>
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
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Your garage
                </p>
                <p className="text-xs text-muted truncate">
                  {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}{" "}
                  registered
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
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Saved addresses
                </p>
                <p className="text-xs text-muted truncate">
                  {addresses.length} address{addresses.length === 1 ? "" : "es"}{" "}
                  saved
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Notifications Link */}
          <Link to="/app/notifications">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Bell className="size-4.5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-primary" />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display font-semibold text-ink text-sm sm:text-base">
                    Notifications
                  </p>
                  {unread > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {unread} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted truncate">
                  {unread > 0
                    ? `${unread} unread update${unread > 1 ? "s" : ""}`
                    : "Alerts, offers & status"}
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
              <p className="font-display font-semibold text-ink text-sm sm:text-base">
                Help &amp; Support
              </p>
              <p className="text-xs text-muted">
                FAQs, CMS documents &amp; Live support chat
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </GlassCard>
        </Link>
      </div>

      {/* Account Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full text-ink-soft border-line hover:bg-surface-muted flex items-center justify-center gap-2 bg-surface">
          <LogOut className="size-[18px]" />
          <span>Log out</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowDeactivateConfirm(true)}
          className="w-full text-red-500 border-red-200 hover:bg-red-50/15 flex items-center justify-center gap-2 bg-surface">
          <UserX className="size-[18px]" />
          <span>Delete account</span>
        </Button>
      </div>

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-sm space-y-6 bg-surface p-6 shadow-xl border border-line">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink/5 text-ink">
                <LogOut className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">
                Log Out
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Are you sure you want to log out of your account? You will need
                to log back in to manage your bookings and subscriptions.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                onClick={confirmLogout}
                className="flex-1 rounded-xl bg-ink text-surface hover:bg-ink/90 cursor-pointer">
                Log out
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Custom Deactivate Confirmation Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-sm space-y-6 bg-surface p-6 shadow-xl border border-line">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <UserX className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">
                Delete Account?
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Are you sure you want to delete your profile? You will be logged
                out immediately. Once deleted, only an admin can reactivate your
                profile.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeactivateConfirm(false)}
                disabled={deactivateAccount.isPending}
                className="flex-1 rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                onClick={confirmDeactivate}
                disabled={deactivateAccount.isPending}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer">
                {deactivateAccount.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Delete account"
                )}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
