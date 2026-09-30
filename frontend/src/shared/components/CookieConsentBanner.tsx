import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
} from "@shared/lib/cookieConsent";

export function CookieConsentBanner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [functional, setFunctional] = useState(false);

  useEffect(() => {
    const saved = readCookieConsent();
    setFunctional(saved?.functional ?? false);
    setVisible(!saved);

    const openSettings = () => {
      const current = readCookieConsent();
      setFunctional(current?.functional ?? false);
      setSettingsOpen(true);
      setVisible(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  const choose = (allowFunctional: boolean) => {
    saveCookieConsent(allowFunctional);
    setFunctional(allowFunctional);
    setSettingsOpen(false);
    setVisible(false);
  };

  if (!visible || location.pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5" role="region" aria-label="Cookie consent">
      <div className="mx-auto max-w-4xl rounded-3xl border border-line bg-surface/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="flex items-start gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <Cookie className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Your privacy choices</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  We use necessary cookies and browser storage for secure sessions, fraud prevention, and core app features.
                  With your permission, functional storage can remember convenience settings. We do not use advertising cookies.
                </p>
              </div>
              {readCookieConsent() && (
                <button
                  type="button"
                  onClick={() => { setVisible(false); setSettingsOpen(false); }}
                  className="rounded-full p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
                  aria-label="Close cookie settings"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {settingsOpen && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <ShieldCheck className="size-4 text-primary" /> Strictly necessary
                    </span>
                    <span className="text-xs font-semibold text-primary">Always on</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">Authentication, security, consent records, and essential transactions.</p>
                </div>
                <label className="cursor-pointer rounded-2xl border border-line bg-background/60 p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">Functional</span>
                    <input
                      type="checkbox"
                      checked={functional}
                      onChange={(event) => setFunctional(event.target.checked)}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">Remembers convenience settings and unfinished app activity.</span>
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                Read our <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link> for full details.
              </p>
              <div className="flex flex-wrap gap-2">
                {!settingsOpen && (
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                    <Settings2 className="size-4" /> Manage choices
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => choose(false)}>Necessary only</Button>
                <Button size="sm" onClick={() => choose(settingsOpen ? functional : true)}>
                  {settingsOpen ? "Save choices" : "Allow functional"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
