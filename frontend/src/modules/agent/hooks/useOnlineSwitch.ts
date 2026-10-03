import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPushToken,
  requestPushPermission,
  saveDeviceToken,
} from "@shared/lib/push";
import { apiFetch } from "@shared/lib/api";
import { meKey, useAgentMe, useToggleOnline } from "../api/agent.api";
import { requestCurrentDeviceFix } from "./useDeviceLocation";

/**
 * The cleaner's Online / Offline switch.
 *
 * Online now lasts until the cleaner switches it off — swiping the app away
 * doesn't end it — and job offers reach a closed app by push. So going online
 * is also the moment to make sure this phone can get those pushes: ask for
 * notification permission (inside the tap, before any await, or Safari ignores
 * it) and register this phone's token.
 */
export function useOnlineSwitch() {
  const { data: me } = useAgentMe();
  const toggle = useToggleOnline();
  const qc = useQueryClient();
  const online = me?.online ?? false;

  const setOnline = useCallback(
    async (next: boolean) => {
      if (!next) {
        toggle.mutate({ online: false });
        return;
      }
      const asked = requestPushPermission();
      try {
        const fix = await requestCurrentDeviceFix();
        toggle.mutate({ online: true, lat: fix.lat, lng: fix.lng });
      } catch {
        // Still online; the location nudge explains how to enable GPS.
        toggle.mutate({ online: true });
      }
      try {
        await asked;
        const token = await getPushToken({ requestPermission: true });
        saveDeviceToken(token);
        await apiFetch("/notifications/register-token", { method: "POST", body: { token } });
      } catch {
        /* the banner tells the cleaner if job alerts can't reach a closed app */
      } finally {
        qc.invalidateQueries({ queryKey: meKey });
      }
    },
    [toggle, qc],
  );

  return { online, pending: toggle.isPending, setOnline, toggle: () => setOnline(!online) };
}
