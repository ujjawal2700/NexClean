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
      return payload.data;
    })
    .catch((error) => {
      configPromise = null;
      console.info("Browser integrations are unavailable:", error);
      return { googleMapsApiKey: null, firebase: null };
    });

  return configPromise;
}
