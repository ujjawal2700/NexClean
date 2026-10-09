import { useCallback } from "react";
import { create } from "zustand";
import { useQueryClient } from "@tanstack/react-query";
import { getPushToken, requestPushPermission, saveDeviceToken } from "@shared/lib/push";
import { apiFetch } from "@shared/lib/api";
import { meKey, sendLocationHeartbeat, useAgentMe, useToggleOnline } from "../api/agent.api";
import type { AgentProfile } from "../types";
import { requestCurrentDeviceFix } from "./useDeviceLocation";

// The header, dashboard and profile share one operation. Lock synchronously,
// before any permission prompt, so repeated taps never queue more toggles.
const useAvailability = create<{
  pending: boolean;
  error: string | null;
  locationPending: boolean;
  locationError: string | null;
}>(() => ({ pending: false, error: null, locationPending: false, locationError: null }));

export function useOnlineSwitch() {
  const { data: me } = useAgentMe();
  const mutation = useToggleOnline();
  const qc = useQueryClient();
  const state = useAvailability();
  const online = me?.online ?? false;

  const requestLocation = useCallback(async () => {
    if (useAvailability.getState().locationPending) return;
    useAvailability.setState({ locationPending: true, locationError: null });
    try {
      const fix = await requestCurrentDeviceFix();
      await sendLocationHeartbeat(fix.lat, fix.lng);
    } catch (error) {
      useAvailability.setState({ locationError: error instanceof Error ? error.message : "Couldn't share your location. Please try again." });
    } finally {
      useAvailability.setState({ locationPending: false });
    }
  }, []);

  const setOnline = useCallback(async (next: boolean) => {
    if (useAvailability.getState().pending) return;
    useAvailability.setState({ pending: true, error: null });
    // Permissions and token registration run independently of availability.
    // A GPS or notification prompt can stay unanswered for minutes.
    if (next) {
      void requestLocation();
      void requestPushPermission()
        .then(() => getPushToken())
        .then(async (token) => {
          saveDeviceToken(token);
          await apiFetch("/notifications/register-token", { method: "POST", body: { token } });
        })
        .catch(() => {});
    }
    try {
      await mutation.mutateAsync({ online: next });
    } catch (error) {
      useAvailability.setState({ error: error instanceof Error ? error.message : "Couldn't update your availability. Please try again." });
    } finally {
      useAvailability.setState({ pending: false });
    }
  }, [mutation, requestLocation]);

  return {
    ...state, online, setOnline, requestLocation,
    toggle: () => setOnline(!(qc.getQueryData<AgentProfile>(meKey)?.online ?? online)),
  };
}
