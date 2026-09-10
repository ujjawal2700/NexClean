import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL, ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import {
  useAgentMe,
  useJobs,
  jobsKey,
  summaryKey,
  fetchCurrentOffer,
  acceptOffer,
  declineOffer,
} from "../api/agent.api";
import type { JobOffer } from "../types";
import { useDeviceLocation } from "./useDeviceLocation";

/** Short attention beep via WebAudio (no asset needed). Best-effort. */
function playPing() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* autoplay blocked or unsupported */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* unsupported */
  }
}

export type AgentDispatch = {
  offer: JobOffer | null;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  accepting: boolean;
  error: string | null;
  /** Whether we're actively streaming GPS (agent online + permission granted). */
  locating: boolean;
};

/**
 * Connects the agent's real-time dispatch channel:
 *  - streams live GPS while online (for nearest-agent ranking)
 *  - receives job offers over the socket + restores any live offer on reconnect
 *  - exposes accept/decline actions
 *
 * Mounted once in AgentLayout so the popup shows over any page.
 */
export function useAgentDispatch(): AgentDispatch {
  const authenticated = useAgentSession((s) => s.authenticated);
  const { data: me } = useAgentMe();
  const { data: jobs = [] } = useJobs();
  const online = me?.online ?? false;
  const qc = useQueryClient();

  /**
   * A cleaner mid-job must keep streaming even if they toggle themselves
   * offline — going offline means "send me no new work", not "stop showing the
   * customer who is already waiting for me where I am". Without this, toggling
   * offline en route freezes the customer's map on a stale position with no
   * explanation.
   */
  const hasActiveJob = jobs.some(
    (j) => j.status === "assigned" || j.status === "enroute" || j.status === "arrived" || j.status === "in_progress",
  );
  const shouldStream = online || hasActiveJob;

  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Socket connection + offer events.
  useEffect(() => {
    if (!authenticated) return;
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "agent" },
    });
    socketRef.current = socket;

    socket.on("job_offer", (o: JobOffer) => {
      setError(null);
      setOffer(o);
      playPing();
    });
    socket.on("offer_revoked", ({ bookingId }: { bookingId: string }) => {
      setOffer((prev) => (prev?.bookingId === bookingId ? null : prev));
    });
    socket.on("job_assigned", () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    });
    socket.on("notification", () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    });
    socket.on("push_notification", () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authenticated, qc]);

  // Restore a live offer that arrived while the app was closed/reconnecting or on tab focus.
  useEffect(() => {
    if (!authenticated) return;
    const checkOffer = () => {
      fetchCurrentOffer()
        .then((o) => {
          if (o) setOffer(o);
        })
        .catch(() => {});
    };
    checkOffer();
    window.addEventListener("focus", checkOffer);
    document.addEventListener("visibilitychange", checkOffer);
    return () => {
      window.removeEventListener("focus", checkOffer);
      document.removeEventListener("visibilitychange", checkOffer);
    };
  }, [authenticated]);

  // Stream GPS so dispatch can rank by real distance and the customer's live
  // map can follow the cleaner in. The fix comes from the app-wide watch, which
  // the job map reads from too — see useDeviceLocation for why there is only one.
  const { fix: deviceFix, error: deviceError } = useDeviceLocation(shouldStream);

  useEffect(() => {
    if (!shouldStream || !deviceFix) {
      setLocating(false);
      return;
    }
    setLocating(true);
    socketRef.current?.emit("agent_location", {
      lat: deviceFix.lat,
      lng: deviceFix.lng,
      heading: deviceFix.heading,
      speed: deviceFix.speed,
    });
  }, [shouldStream, deviceFix]);

  useEffect(() => {
    if (deviceError) setLocating(false);
  }, [deviceError]);

  const accept = useCallback(async () => {
    if (!offer) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptOffer(offer.bookingId);
      setOffer(null);
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    } catch (e) {
      // Raced/expired — clear the popup and surface a brief message.
      setOffer(null);
      setError(e instanceof ApiError ? e.message : "This job is no longer available");
    } finally {
      setAccepting(false);
    }
  }, [offer, qc]);

  const decline = useCallback(async () => {
    if (!offer) return;
    const id = offer.bookingId;
    setOffer(null);
    try {
      await declineOffer(id);
    } catch {
      /* dispatch will time it out regardless */
    }
  }, [offer]);

  return { offer, accept, decline, accepting, error, locating };
}
