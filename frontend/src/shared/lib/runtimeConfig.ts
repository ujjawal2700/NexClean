import { API_URL } from "./api";

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export type PublicRuntimeConfig = {
  googleMapsApiKey: string | null;
  firebase: FirebasePublicConfig | null;
};

let configPromise: Promise<PublicRuntimeConfig> | null = null;

/**
 * Build-time values from frontend/.env(.production), used for whatever the
 * server doesn't send. Deployments configured them here (VITE_FIREBASE_*,
 * VITE_GOOGLE_MAPS_KEY) while the server's FIREBASE_WEB_* were empty, and the
 * app silently ran with no web push and no maps. All of these are browser-safe
 * by design — they end up in the page either way.
 */
function buildTimeConfig(): PublicRuntimeConfig {
  const env = import.meta.env;
  const firebase: FirebasePublicConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.VITE_FIREBASE_APP_ID ?? "",
    vapidKey: env.VITE_FIREBASE_VAPID_KEY ?? "",
  };
  const complete = firebase.apiKey && firebase.projectId && firebase.messagingSenderId && firebase.appId && firebase.vapidKey;
  return {
    googleMapsApiKey: env.VITE_GOOGLE_MAPS_KEY || null,
    firebase: complete ? firebase : null,
  };
}

/** The server's values win; the build's fill any gap. */
function withBuildFallback(server: PublicRuntimeConfig): PublicRuntimeConfig {
  const build = buildTimeConfig();
  return {
    googleMapsApiKey: server.googleMapsApiKey || build.googleMapsApiKey,
    firebase: server.firebase ?? build.firebase,
  };
}

/** Fetch the explicit browser-safe allowlist; no server secret is serialized. */
export function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  if (configPromise) return configPromise;

  configPromise = fetch(`${API_URL}/config/public`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Public config request failed (${response.status})`);
      const payload = (await response.json()) as {
        success?: boolean;
        data?: PublicRuntimeConfig;
      };
      if (!payload.success || !payload.data) throw new Error("Public config response is invalid");
      return withBuildFallback(payload.data);
    })
    .catch((error) => {
      configPromise = null;
      console.info("Browser integrations are unavailable:", error);
      return buildTimeConfig();
    });

  return configPromise;
}
