import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  User, Mail, Phone, Gift, ArrowRight, ArrowLeft, ShieldCheck,
  Loader2, MapPin, Building2, Rocket, CheckCircle2,
} from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { LegalConsent } from "@shared/components/LegalConsent";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Stepper } from "@shared/ui/Stepper";
import { ApiError } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useCustomerSignup, useVerifyOtp, useCheckReferralCode } from "../api/mutations";
import { meKey } from "../api/queries";
import { usePublicCities, usePublicZones, useSubmitLead } from "../api/public";
import type { PublicCity, PublicZone } from "../api/public";


type Step = "details" | "location" | "otp";

/** Result of the referral "Verify" button, for the code currently in the field. */
type ReferralStatus =
  | { state: "idle" }
  | { state: "valid"; referrerName: string }
  | { state: "invalid"; message: string };

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const authenticated = useSessionStore((s) => s.authenticated);
  const setToken = useSessionStore((s) => s.setToken);
  const signup = useCustomerSignup();
  const verifyOtp = useVerifyOtp();
  const submitLead = useSubmitLead();
  const checkReferral = useCheckReferralCode();

  // Step state
  const [step, setStep] = useState<Step>("details");

  // Step 1 — Details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") ?? "");
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>({ state: "idle" });
  const [legalConsent, setLegalConsent] = useState(false);

  // Step 2 — Location
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [customCity, setCustomCity] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [isUnservicedCity, setIsUnservicedCity] = useState(false);

  // Step 3 — OTP
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const phoneRef = useRef(phone);

  const { data: cities = [], isLoading: citiesLoading } = usePublicCities();
  const { data: zones = [], isLoading: zonesLoading } = usePublicZones(selectedCityId);

  // A code that arrived through an invite link (?ref=) is verified straight
  // away, so the customer sees who invited them without pressing anything.
  useEffect(() => {
    const code = searchParams.get("ref")?.trim();
    if (!code) return;
    checkReferral.mutate(
      { code },
      {
        onSuccess: (res) => setReferralStatus({ state: "valid", referrerName: res.referrerName }),
        onError: (e) =>
          setReferralStatus({
            state: "invalid",
            message: e instanceof ApiError ? e.message : "Couldn't check this code. Try again.",
          }),
      },
    );
    // Once, on arrival — later edits go through the Verify button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already logged in — redirect to dashboard. Must come after every hook
  // call above (Rules of Hooks): this becomes true mid-session right after a
  // successful signup (see the otp step below), and an earlier return here
  // would make this component render fewer hooks than its previous pass.
  if (authenticated) return <Navigate to="/app" replace />;

  const stepIndex: Record<Step, number> = { details: 0, location: 1, otp: 2 };

  /* ─── Referral code verify ────────────────────────────────────────── */
  const verifyReferral = async (): Promise<boolean> => {
    const code = referralCode.trim();
    if (!code) return true;
    try {
      const res = await checkReferral.mutateAsync({
        code,
        phone: /^\d{10}$/.test(phone) ? phone : undefined,
      });
      setReferralStatus({ state: "valid", referrerName: res.referrerName });
      return true;
    } catch (e) {
      setReferralStatus({
        state: "invalid",
        message: e instanceof ApiError ? e.message : "Couldn't check this code. Try again.",
      });
      return false;
    }
  };

  /* ─── Step 1 submit ───────────────────────────────────────────────── */
  const submitDetails = async () => {
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number");
    if (!legalConsent) return setError("Please accept the Privacy Policy and Terms & Conditions");
    setError("");
    // A code that was typed but never verified is checked now, so a bad code
    // is caught on this step instead of failing account creation later.
    if (referralCode.trim() && referralStatus.state !== "valid" && !(await verifyReferral())) return;
    phoneRef.current = phone;
    setStep("location");
  };

  /* ─── Step 2 — City selection ─────────────────────────────────────── */
  const selectCity = (city: PublicCity) => {
    setSelectedCityId(city.id);
    setSelectedCityName(city.name);
    setSelectedZoneId(null);
    setIsUnservicedCity(false);
    setCustomCity("");
    setCustomLocation("");
  };

  const selectNotListed = () => {
    setSelectedCityId(null);
    setSelectedCityName("");
    setSelectedZoneId(null);
    setIsUnservicedCity(true);
  };

  const proceedFromLocation = async () => {
    setError("");
    if (!isUnservicedCity) {
      // Normal flow — city is serviceable
      if (!selectedCityId) return setError("Please select your city");
      if (zones.length > 0 && !selectedZoneId) return setError("Please select your society / zone");
      // Proceed to account creation + OTP
      try {
        await signup.mutateAsync({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
          referralCode: referralCode.trim() || undefined,
          privacyAccepted: true,
          termsAccepted: true,
        });
        setStep("otp");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't create your account. Please try again.");
      }
    } else {
      // Unserviced city — still create account, then capture lead
      if (!customCity.trim()) return setError("Please enter your city name");
      if (!customLocation.trim()) return setError("Please enter your area / locality");
      try {
        await signup.mutateAsync({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
          referralCode: referralCode.trim() || undefined,
          privacyAccepted: true,
          termsAccepted: true,
        });
        setStep("otp");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't create your account. Please try again.");
      }
    }
  };

  /* ─── Step 3 — OTP verify ─────────────────────────────────────────── */
  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    try {
      const { token, user } = await verifyOtp.mutateAsync({ phone: phoneRef.current, code: otp });
      setToken(token);
      qc.setQueryData(meKey, user);

      if (isUnservicedCity) {
        // Save lead record, then redirect to coming-soon screen
        try {
          await submitLead.mutateAsync({
            name: name.trim(),
            phone,
            email: email.trim() || undefined,
            city: customCity.trim(),
            location: customLocation.trim(),
          });
        } catch {
          // Non-fatal — account was already created
        }
        navigate("/app/coming-soon", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed");
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────── */
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/app">
            <Logo variant="full" />
          </Link>
        </div>

        <div className="glass rounded-card p-5 sm:p-8 shadow-[var(--shadow-lift)]">
          <Stepper steps={["Details", "Location", "Verify"]} current={stepIndex[step]} />

          {/* ─── Step 1: Details ──────────────────────────────────────── */}
          {step === "details" && (
            <>
              <Badge className="mb-5">Create account</Badge>
              <h1 className="text-2xl text-ink">Join NexClean</h1>
              <p className="mt-2 text-sm text-muted">A few details and we'll get your garage set up.</p>

              <div className="mt-6 space-y-4">
                <Input
                  name="name"
                  autoComplete="name"
                  label="Full name"
                  placeholder="Aisha Sharma"
                  leading={<User className="size-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  name="email"
                  autoComplete="email"
                  label="Email (optional)"
                  type="email"
                  placeholder="you@example.com"
                  leading={<Mail className="size-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  label="Mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  leading={<Phone className="size-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && submitDetails()}
                />
                <div>
                  <Input
                    name="referralCode"
                    label="Referral code (optional)"
                    placeholder="e.g. AISH4F2A"
                    leading={<Gift className="size-4" />}
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferralStatus({ state: "idle" });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && verifyReferral()}
                    error={referralStatus.state === "invalid" ? referralStatus.message : undefined}
                    trailing={
                      referralStatus.state === "valid" ? (
                        <CheckCircle2 className="size-5 text-emerald-600" aria-label="Verified" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => verifyReferral()}
                          disabled={!referralCode.trim() || checkReferral.isPending}
                          className="cursor-pointer rounded-xl px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-default disabled:opacity-40"
                        >
                          {checkReferral.isPending ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
                        </button>
                      )
                    }
                  />
                  {referralStatus.state === "valid" && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> Referred by {referralStatus.referrerName}.
                    </p>
                  )}
                </div>
                <LegalConsent checked={legalConsent} onChange={setLegalConsent} />
                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
                <Button className="w-full" onClick={submitDetails} disabled={checkReferral.isPending}>
                  {checkReferral.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── Step 2: Location ─────────────────────────────────────── */}
          {step === "location" && (
            <>
              <button
                onClick={() => { setStep("details"); setError(""); }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <Badge className="mb-5">Service area</Badge>
              <h1 className="text-2xl text-ink">Select your city</h1>
              <p className="mt-2 text-sm text-muted">We'll match you with the best agents near you.</p>

              <div className="mt-5 space-y-3">
                {citiesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" /> Loading cities…
                  </div>
                ) : (
                  <>
                    {/* City pills */}
                    <div className="flex flex-wrap gap-2">
                      {cities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => selectCity(city)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                            selectedCityId === city.id && !isUnservicedCity
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-line bg-surface/60 text-ink hover:border-primary/50"
                          }`}
                        >
                          <MapPin className="size-3.5" /> {city.name}
                        </button>
                      ))}
                      {/* "Not Listed" option */}
                      <button
                        onClick={selectNotListed}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                          isUnservicedCity
                            ? "border-amber-500 bg-amber-500/10 text-amber-600"
                            : "border-line bg-surface/60 text-muted hover:border-amber-400/50"
                        }`}
                      >
                        My city isn't listed
                      </button>
                    </div>

                    {/* Society / Zone picker — only for serviceable city */}
                    {selectedCityId && !isUnservicedCity && (
                      <div className="mt-1">
                        <p className="mb-2 text-xs font-medium text-muted">Select your society / zone</p>
                        {zonesLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted">
                            <Loader2 className="size-4 animate-spin" /> Loading zones…
                          </div>
                        ) : zones.length === 0 ? (
                          <p className="text-xs text-muted">No zones listed yet for {selectedCityName}. You can continue anyway.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {zones.map((zone: PublicZone) => (
                              <button
                                key={zone.id}
                                onClick={() => setSelectedZoneId(zone.id)}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                                  selectedZoneId === zone.id
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-line bg-surface/60 text-ink hover:border-primary/50"
                                }`}
                              >
                                <Building2 className="size-3.5" /> {zone.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unserviced city — lead capture form */}
                    {isUnservicedCity && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                            <Rocket className="size-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">We're not there yet!</p>
                            <p className="mt-0.5 text-xs text-muted">
                              NexClean is growing fast. Tell us your city and area — we'll notify you the
                              moment we launch near you.
                            </p>
                          </div>
                        </div>
                        <Input
                          name="customCity"
                          label="Your city"
                          placeholder="e.g. Pune, Mumbai, Delhi…"
                          leading={<MapPin className="size-4" />}
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                        />
                        <Input
                          name="customLocation"
                          label="Area / Locality"
                          placeholder="e.g. Koregaon Park, Bandra West…"
                          leading={<Building2 className="size-4" />}
                          value={customLocation}
                          onChange={(e) => setCustomLocation(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}

                {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}

                <Button
                  className="w-full"
                  onClick={proceedFromLocation}
                  disabled={signup.isPending || citiesLoading}
                >
                  {signup.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isUnservicedCity ? (
                    <>Save my spot &amp; Continue <ArrowRight className="size-4" /></>
                  ) : (
                    <>Continue <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ─── Step 3: OTP ──────────────────────────────────────────── */}
          {step === "otp" && (
            <>
              <button
                onClick={() => { setStep("location"); setError(""); }}
                className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Edit location
              </button>
              <h1 className="text-2xl text-ink">Verify your number</h1>
              <p className="mt-2 text-sm text-muted">
                Enter the 6-digit code sent to <span className="font-medium text-ink">+91 {phoneRef.current}</span>.
              </p>
              {isUnservicedCity && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-2">
                  <Rocket className="size-3.5 shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700">
                    After verification, your spot in <strong>{customCity}</strong> will be saved.
                  </p>
                </div>
              )}
              <div className="mt-6 space-y-4">
                <Input
                  name="otp"
                  autoComplete="one-time-code"
                  label="One-time code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  className="tracking-[0.5em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}

                  error={error}
                />
                <Button
                  className="w-full"
                  onClick={verify}
                  disabled={verifyOtp.isPending || submitLead.isPending}
                >
                  {verifyOtp.isPending || submitLead.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>Verify &amp; continue <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Secure sign-in with a one-time code
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link to="/app/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
