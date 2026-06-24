import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  MapPin,
  User,
  Mail,
  Phone,
  Check,
  Gift,
  Pencil,
  X,
  ShieldCheck,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ApiError } from "@shared/lib/api";
import { useMe, useReferralSummary } from "../api/queries";
import { useUpdateProfile, useRequestPhoneChange, useConfirmPhoneChange } from "../api/mutations";

export function Profile() {
  const { data: me } = useMe();
  const { data: referrals } = useReferralSummary();
  const vehicles = me?.vehicles ?? [];
  const addresses = me?.addresses ?? [];

  const updateProfile = useUpdateProfile();
  const requestPhoneChange = useRequestPhoneChange();
  const confirmPhoneChange = useConfirmPhoneChange();

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // phone-change sub-flow: idle (just show current phone) -> enter (new number) -> otp (verify)
  const [phoneStep, setPhoneStep] = useState<"idle" | "enter" | "otp">("idle");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneUpdated, setPhoneUpdated] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setEmail(me.email ?? "");
    }
  }, [me]);

  const startEditing = () => {
    setName(me?.name ?? "");
    setEmail(me?.email ?? "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setPhoneStep("idle");
    setNewPhone("");
    setOtp("");
    setPhoneError("");
  };

  const saveDetails = () => {
    updateProfile.mutate(
      { name: name.trim() || "NexClean Member", email: email.trim() },
      {
        onSuccess: () => {
          setSaved(true);
          setEditing(false);
          setTimeout(() => setSaved(false), 1800);
        },
      },
    );
  };

  const sendPhoneOtp = async () => {
    if (!/^\d{10}$/.test(newPhone)) {
      setPhoneError("Enter a valid 10-digit number");
      return;
    }
    setPhoneError("");
    try {
      await requestPhoneChange.mutateAsync(newPhone);
      setPhoneStep("otp");
    } catch (e) {
      setPhoneError(e instanceof ApiError ? e.message : "Couldn't send OTP");
    }
  };

  const confirmPhoneOtp = async () => {
    if (otp.length < 4) {
      setPhoneError("Enter the code you received");
      return;
    }
    setPhoneError("");
    try {
      await confirmPhoneChange.mutateAsync({ phone: newPhone, code: otp });
      setPhoneStep("idle");
      setNewPhone("");
      setOtp("");
      setPhoneUpdated(true);
      setTimeout(() => setPhoneUpdated(false), 2200);
    } catch (e) {
      setPhoneError(e instanceof ApiError ? e.message : "Verification failed");
    }
  };

  const initial = (me?.name || "N").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ink">Profile</h1>

      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-soft font-display text-2xl font-semibold text-white">
              {initial}
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-ink">{me?.name || "NexClean Member"}</p>
              <p className="text-sm text-muted">{me?.phone}</p>
            </div>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="size-4" /> Edit profile
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Mail className="size-4 text-muted" />
              <div className="min-w-0">
                <p className="text-xs text-muted">Email</p>
                <p className="truncate font-medium text-ink">{me?.email || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Phone className="size-4 text-muted" />
              <div className="min-w-0">
                <p className="text-xs text-muted">Mobile number</p>
                <p className="truncate font-medium text-ink">{me?.phone}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="name"
                label="Full name"
                leading={<User className="size-4" />}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Input
                name="email"
                label="Email"
                type="email"
                leading={<Mail className="size-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={saveDetails} disabled={updateProfile.isPending}>
                {saved ? (
                  <>
                    <Check className="size-4" /> Saved
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                <X className="size-4" /> Cancel
              </Button>
            </div>

            {/* mobile number — change requires OTP verification since it's the login identifier */}
            <div className="rounded-2xl border border-line bg-surface-muted/40 p-4">
              <p className="mb-1 text-sm font-medium text-ink">Mobile number</p>

              {phoneStep === "idle" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink">{me?.phone}</span>
                  <Button variant="outline" size="sm" onClick={() => setPhoneStep("enter")}>
                    Change number
                  </Button>
                </div>
              )}

              {phoneStep === "enter" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Enter your new number — we'll send a one-time code to verify it before updating your login.
                  </p>
                  <Input
                    name="newPhone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    leading={<Phone className="size-4" />}
                    placeholder="98765 43210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                    error={phoneError}
                  />
                  <div className="flex gap-3">
                    <Button size="sm" onClick={sendPhoneOtp} disabled={requestPhoneChange.isPending}>
                      {requestPhoneChange.isPending ? <Loader2 className="size-4 animate-spin" /> : "Send OTP"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoneStep("idle");
                        setNewPhone("");
                        setPhoneError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {phoneStep === "otp" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Enter the 6-digit code sent to <span className="font-medium text-ink">+91 {newPhone}</span>.
                  </p>
                  <Input
                    name="phoneOtp"
                    inputMode="numeric"
                    maxLength={6}
                    className="tracking-[0.5em]"
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    error={phoneError}
                  />
                  <div className="flex gap-3">
                    <Button size="sm" onClick={confirmPhoneOtp} disabled={confirmPhoneChange.isPending}>
                      {confirmPhoneChange.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="size-4" /> Verify & update
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoneStep("idle");
                        setNewPhone("");
                        setOtp("");
                        setPhoneError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {phoneUpdated && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <Check className="size-4" /> Mobile number updated — use it next time you log in.
                </p>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* quick links to dedicated pages, kept off this page to avoid clutter */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/app/profile/refer">
          <GlassCard interactive className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Gift className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-ink">Refer & earn</p>
              <p className="truncate text-sm text-muted">{referrals?.referralCode ?? "Get your code"}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </GlassCard>
        </Link>

        <Link to="/app/profile/vehicles">
          <GlassCard interactive className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Car className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-ink">Your garage</p>
              <p className="truncate text-sm text-muted">
                {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </GlassCard>
        </Link>

        <Link to="/app/profile/addresses">
          <GlassCard interactive className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-ink">Saved addresses</p>
              <p className="truncate text-sm text-muted">
                {addresses.length} address{addresses.length === 1 ? "" : "es"}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
