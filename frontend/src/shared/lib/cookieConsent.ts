export const COOKIE_CONSENT_KEY = "nexclean-cookie-consent";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_SETTINGS_EVENT = "nexclean:open-cookie-settings";

export type CookieConsent = {
  version: number;
  necessary: true;
  functional: boolean;
  updatedAt: string;
};

export function readCookieConsent(): CookieConsent | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) ?? "null") as Partial<CookieConsent> | null;
    if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION || parsed.necessary !== true) return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      functional: parsed.functional === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveCookieConsent(functional: boolean): CookieConsent {
  const consent: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    functional,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    if (!functional) sessionStorage.removeItem("nexclean-booking-draft");
  } catch {
    // Storage may be unavailable in private browsing; the app still works for this visit.
  }
  window.dispatchEvent(new CustomEvent("nexclean:cookie-consent-changed", { detail: consent }));
  return consent;
}

export function functionalStorageAllowed(): boolean {
  return readCookieConsent()?.functional === true;
}
