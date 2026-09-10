import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentSession } from "../store/sessionStore";
import {
  User,
  Phone,
  Star,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  LogOut,
  UserX,
  Pencil,
  Power,
  Loader2,
  Landmark,
  Wallet,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import {
  useAgentMe,
  useToggleOnline,
  useDeactivateAccount,
} from "../api/agent.api";

export function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useAgentSession((s) => s.clear);
  const { data: me } = useAgentMe();
  const toggleOnline = useToggleOnline();
  const deactivateAccount = useDeactivateAccount();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    clear();
    qc.clear();
    navigate("/agent/login");
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
    navigate("/agent/login");
  };

  const verified = me?.agentStatus === "verified";
  const isUnverified = me?.agentStatus !== "verified";

  // Get user initials for avatar
  const getInitials = () => {
    if (!me?.name) return "NX";
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
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h2 className="font-display text-2xl font-bold text-ink truncate">
              {me?.name || "Specialist"}
            </h2>
            {verified && (
              <BadgeCheck className="size-5 text-primary shrink-0" />
            )}
          </div>
          <p className="text-sm text-ink-soft truncate">{me?.phone}</p>
          <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted pt-1">
            <Star className="size-4 fill-primary text-primary" />
            <span className="font-bold text-ink">
              {me?.rating ? Number(me.rating).toFixed(1) : "New"}
            </span>
            <span>· {me?.jobsDone ?? 0} jobs done</span>
          </div>
        </div>
      </GlassCard>

      {/* Account Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="font-display text-xl font-bold text-primary">
            {me?.rating ? `${Number(me.rating).toFixed(1)}★` : "New"}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
            Rating
          </p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {me?.jobsDone ?? 0}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
            Jobs done
          </p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="font-display text-xl font-bold text-emerald-600 capitalize">
            {verified ? "Verified" : (me?.agentStatus ?? "—")}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
            Status
          </p>
        </GlassCard>
      </div>

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
          <div className="flex items-center gap-3 py-1.5 last:border-0">
            <Phone className="size-4 text-muted shrink-0" />
            <span className="text-muted w-24">Mobile</span>
            <span className="font-medium text-ink truncate">
              +91 {me?.phone || "—"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Availability Toggle Option */}
      <GlassCard className="flex items-center justify-between p-5 border border-line bg-surface">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Power className="size-4.5" />
          </span>
          <div>
            <p className="font-display font-semibold text-ink text-sm sm:text-base">
              Availability
            </p>
            <p className="text-xs text-muted">
              You are {me?.online ? "online & receiving jobs" : "offline"}
            </p>
          </div>
        </div>
        <Button
          variant={me?.online ? "outline" : "primary"}
          size="sm"
          disabled={toggleOnline.isPending || isUnverified}
          onClick={() => toggleOnline.mutate(!me?.online)}
          className="rounded-xl px-4 py-2 text-xs font-semibold">
          {me?.online ? "Go offline" : "Go online"}
        </Button>
      </GlassCard>

      {/* Navigation Options Menu */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink px-1">
          Settings &amp; Preferences
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Edit Profile Link */}
          {isUnverified ? (
            <div className="opacity-50 cursor-not-allowed h-full">
              <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface h-full">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink text-sm sm:text-base">
                    Edit profile
                  </p>
                  <p className="text-xs text-muted truncate">
                    Update full name
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </GlassCard>
            </div>
          ) : (
            <Link to="/agent/profile/edit">
              <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink text-sm sm:text-base">
                    Edit profile
                  </p>
                  <p className="text-xs text-muted truncate">
                    Update full name
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </GlassCard>
            </Link>
          )}

          {/* Payouts Link */}
          <Link to="/agent/payouts">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Payouts
                </p>
                <p className="text-xs text-muted truncate">
                  Request a payout of your earnings
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Bank Account Link */}
          <Link to="/agent/profile/bank-account">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Landmark className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Bank account
                </p>
                <p className="text-xs text-muted truncate">
                  Where your payouts get sent
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Help & Support Link */}
          <Link to="/agent/help">
            <GlassCard className="flex items-center gap-3 p-5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <HelpCircle className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  Help &amp; Support
                </p>
                <p className="text-xs text-muted truncate">
                  FAQs &amp; Support team chat
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>
        </div>
      </div>

      {/* Status Notice */}
      <GlassCard className="flex items-center gap-3 text-xs text-muted bg-surface/50">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        Background-checked &amp; insured. Specialist credentials verified by the
        NexClean operations team.
      </GlassCard>

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
                Are you sure you want to log out of your agent account? You will
                need to log back in to accept cleaning jobs and check payouts.
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
                Are you sure you want to delete your agent profile? You will be
                logged out immediately. Once deleted, only an admin can
                reactivate your account.
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
