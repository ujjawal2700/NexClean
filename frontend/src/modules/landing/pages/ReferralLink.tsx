import { useEffect, useRef } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@shared/ui/Button";
import { customerPlayStoreUrl, referralAndroidIntentUrl } from "@shared/lib/site";

/**
 * Landing point for a shared referral invite — https://nexclean.in/referral?code=CODE
 * (or /referral/CODE). With the app installed, Android/iOS open the app at this
 * URL instead (see public/.well-known). Android browsers try the app with a
 * Play Store fallback; inside the native app and on other platforms, sign-up
 * receives the referral code directly.
 */
export function ReferralLink() {
  const [params] = useSearchParams();
  const { code: pathCode } = useParams();
  const code = (params.get("code") ?? params.get("ref") ?? pathCode ?? "").trim().toUpperCase();
  const native = window as unknown as { NexCleanShare?: unknown; NexCleanApp?: boolean };
  const inCustomerApp = !!native.NexCleanShare || native.NexCleanApp === true || /NexClean/i.test(navigator.userAgent);
  const androidBrowser = /Android/i.test(navigator.userAgent) && !inCustomerApp;
  const attempted = useRef<string | null>(null);
  const intentUrl = referralAndroidIntentUrl(code);

  useEffect(() => {
    if (!androidBrowser || attempted.current === intentUrl) return;
    attempted.current = intentUrl;
    // Verified App Links normally bypass this page. If a browser reaches it,
    // try the explicit package and let Chrome handle the store fallback.
    try {
      window.location.replace(intentUrl);
    } catch {
      // Some embedded browsers reject external schemes; keep the tap targets.
    }
  }, [androidBrowser, intentUrl]);

  if (androidBrowser) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-5 py-12">
        <div className="w-full max-w-sm space-y-5 rounded-card border border-line bg-surface p-6 text-center shadow-soft">
          <img src="/logo.png" alt="NexClean" className="mx-auto size-16 rounded-2xl" />
          <h1 className="text-2xl text-ink">Your NexClean invite</h1>
          <p className="text-sm text-muted">Open NexClean to get started, or install it from Google Play.</p>
          {code && <p className="rounded-xl bg-primary/5 p-3 text-sm text-ink">Referral code: <strong>{code}</strong></p>}
          <div className="space-y-3">
            {/* A real tap can launch the app in browsers that block automatic intents. */}
            <Button asChild className="min-h-12 w-full"><a href={intentUrl}>Open NexClean</a></Button>
            <Button asChild variant="outline" className="min-h-12 w-full"><a href={customerPlayStoreUrl(code)}>Install from Google Play</a></Button>
          </div>
        </div>
      </main>
    );
  }
  return <Navigate to={code ? `/app/signup?ref=${encodeURIComponent(code)}` : "/app/signup"} replace />;
}
