import { useCallback } from "react";
import { create } from "zustand";
import { useQueryClient } from "@tanstack/react-query";
import { getPushToken, requestPushPermission, saveDeviceToken } from "@shared/lib/push";
import { apiFetch } from "@shared/lib/api";
import { meKey, useAgentMe, useToggleOnline } from "../api/agent.api";
import type { AgentProfile } from "../types";
import { requestCurrentDeviceFix } from "./useDeviceLocation";

// The header, dashboard and profile share one operation. Lock synchronously,
// before any permission prompt, so repeated taps never queue more toggles.
const useAvailability = create<{
  pending: boolean;
  error: string | null;
}>(() => ({ pending: false, error: null }));

export function useOnlineSwitch() {
  const { data: me } = useAgentMe();
  const mutation = useToggleOnline();
  const qc = useQueryClient();
  const state = useAvailability();
  const online = me?.online ?? false;

  const setOnline = useCallback(async (next: boolean) => {
    if (useAvailability.getState().pending) return;
    useAvailability.setState({ pending: true, error: null });
    // Push registration remains optional; going online requires a fresh GPS fix.
    if (next) {
      void requestPushPermission()
        .then(() => getPushToken())
        .then(async (token) => {
          if (token.startsWith("web-")) return;
          saveDeviceToken(token);
          await apiFetch("/notifications/register-token", { method: "POST", body: { token } });
          void qc.invalidateQueries({ queryKey: meKey });
        })
        .catch(() => {});
    }
    try {
      const fix = next ? await requestCurrentDeviceFix() : null;
      await mutation.mutateAsync({ online: next, ...(fix ? { lat: fix.lat, lng: fix.lng } : {}) });
    } catch (error) {
      useAvailability.setState({ error: error instanceof Error ? error.message : "Couldn't update your availability. Please try again." });
    } finally {
      useAvailability.setState({ pending: false });
    }
  }, [mutation, qc]);

  return {
    ...state, online, setOnline,
    toggle: () => setOnline(!(qc.getQueryData<AgentProfile>(meKey)?.online ?? online)),
  };
}
