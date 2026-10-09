import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentSession } from "../store/sessionStore";
import {
  User,
  Mail,
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
import { LogoutConfirmDialog } from "@shared/components/LogoutConfirmDialog";
import {
  useAgentMe,
  useDeactivateAccount,
} from "../api/agent.api";
import { useOnlineSwitch } from "../hooks/useOnlineSwitch";

export function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useAgentSession((s) => s.clear);
  const { data: me } = useAgentMe();
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

  const onlineSwitch = useOnlineSwitch();
  const handleOnlineToggle = () => onlineSwitch.toggle();

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
    <div className="mx-auto max-w-2xl space-y-3">
      {/* Title */}
      <h1 className="font-display text-2xl text-ink sm:text-3xl">Profile</h1>

      {/* User Header Info Card */}
      <GlassCard className="flex items-center gap-3 p-4 bg-gradient-to-br from-surface to-surface-muted/30">
        <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-display text-2xl font-bold text-primary shadow-sm shrink-0">
          {getInitials()}
        </div>
        <div className="text-left space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-ink truncate">
              {me?.name || "Specialist"}
            </h2>
            {verified && (
              <BadgeCheck className="size-5 text-primary shrink-0" />
            )}
          </div>
          <p className="text-sm text-ink-soft truncate">{me?.phone}</p>

        </div>
      </GlassCard>

      {/* Account Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Link to="/agent/reviews" aria-label="See my reviews">
          <GlassCard className="h-full p-3 text-center transition-colors hover:border-primary/30">
            <p className="font-display text-xl font-bold text-primary">
              {me?.rating ? `${Number(me.rating).toFixed(1)}★` : "New"}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
              Rating · {me?.ratingCount ?? 0} reviews
            </p>
          </GlassCard>
        </Link>
        <GlassCard className="p-3 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {me?.jobsDone ?? 0}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
            Jobs done
          </p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="font-display text-sm font-bold leading-7 text-emerald-600 capitalize">
            {verified ? "Verified" : (me?.agentStatus ?? "—")}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
            Status
          </p>
        </GlassCard>
      </div>

      {/* Account Details Card */}
      <GlassCard className="space-y-1 p-4">
        <div className="flex items-center justify-between border-b border-line/50 pb-2">
          <h3 className="font-display text-lg font-semibold text-ink">
            Account Summary
          </h3>
        </div>
        <div className="grid text-sm">
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 border-b border-line/30 py-2.5 sm:grid-cols-[1.25rem_6rem_minmax(0,1fr)] sm:items-center sm:gap-y-0">
            <User className="mt-0.5 size-4 shrink-0 text-muted sm:mt-0" />
            <span className="text-xs text-muted sm:text-sm">Full name</span>
            <span className="col-start-2 min-w-0 font-medium text-ink [overflow-wrap:anywhere] sm:col-start-3 sm:row-start-1">
              {me?.name || "—"}
            </span>
          </div>
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 border-b border-line/30 py-2.5 sm:grid-cols-[1.25rem_6rem_minmax(0,1fr)] sm:items-center sm:gap-y-0">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted sm:mt-0" />
            <span className="text-xs text-muted sm:text-sm">Email</span>
            <span
              className="col-start-2 min-w-0 font-medium text-ink [overflow-wrap:anywhere] sm:col-start-3 sm:row-start-1"
              data-testid="agent-account-email">
              {me?.email || "Not added"}
            </span>
          </div>
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[1.25rem_6rem_minmax(0,1fr)] sm:items-center sm:gap-y-0">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted sm:mt-0" />
            <span className="text-xs text-muted sm:text-sm">Mobile</span>
            <span className="col-start-2 min-w-0 font-medium text-ink [overflow-wrap:anywhere] sm:col-start-3 sm:row-start-1">
              +91 {me?.phone || "—"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Availability Toggle Option */}
      <GlassCard className="flex items-center justify-between gap-3 p-3.5 border border-line bg-surface">
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
          disabled={onlineSwitch.pending || isUnverified}
          onClick={() => void handleOnlineToggle()}
          className="rounded-xl px-4 py-2 text-xs font-semibold">
          {me?.online ? "Go offline" : "Go online"}
        </Button>
      </GlassCard>

      {/* Navigation Options Menu */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink px-1">
          Settings &amp; Preferences
        </h3>

        <div className="grid gap-2 sm:grid-cols-2">
          {/* Edit Profile Link */}
          {isUnverified ? (
            <div className="opacity-50 cursor-not-allowed h-full">
              <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface h-full">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink text-sm sm:text-base">
                    Edit profile
                  </p>
                  <p className="text-xs text-muted truncate">
                    Contact details &amp; security
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </GlassCard>
            </div>
          ) : (
            <Link to="/agent/profile/edit">
              <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink text-sm sm:text-base">
                    Edit profile
                  </p>
                  <p className="text-xs text-muted truncate">
                    Contact details &amp; security
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </GlassCard>
            </Link>
          )}

          {/* Reviews Link */}
          <Link to="/agent/reviews">
            <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
                <Star className="size-4.5 fill-amber-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink text-sm sm:text-base">
                  My reviews
                </p>
                <p className="text-xs text-muted truncate">
                  See your ratings and what customers said
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </GlassCard>
          </Link>

          {/* Payouts Link */}
          <Link to="/agent/payouts">
            <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
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
            <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
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
            <GlassCard className="flex items-center gap-3 p-3.5 border border-line bg-surface hover:bg-surface-muted/20 hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
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
      <div className="grid grid-cols-2 gap-2 pt-1">
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

      <LogoutConfirmDialog
        open={showLogoutConfirm}
        audience="agent"
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />

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
