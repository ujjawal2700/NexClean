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
  sendLocationHeartbeat,
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
}

/** Ring-style buzz, repeated while a job offer is on screen. */
const OFFER_VIBRATION = [600, 250, 600, 250, 600];
const OFFER_VIBRATION_REPEAT_MS = 3_500;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS Safari has no Vibration API) */
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
  const checkOfferRef = useRef<() => void>(() => {});
  const offerEventVersionRef = useRef(0);
  const lastRestLocationAtRef = useRef(0);

  // Socket connection + offer events.
  useEffect(() => {
    if (!authenticated) return;
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "agent" },
    });
    socketRef.current = socket;

    // Socket events are ephemeral. Reconcile with the authoritative REST
    // state after every connect/reconnect so a brief mobile network handoff
    // cannot make a valid offer invisible for its entire timeout.
    const refreshJobs = () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    };
    // A reconnect may have missed events (e.g. a cancellation while the phone
    // was locked), so re-read the jobs as well as any pending offer.
    socket.on("connect", () => {
      checkOfferRef.current();
      refreshJobs();
    });

    // A job of ours was cancelled — flip it now, not on the next refresh.
    socket.on("job_cancelled", refreshJobs);

    socket.on("job_offer", (o: JobOffer) => {
      offerEventVersionRef.current += 1;
      setError(null);
      setOffer(o);
      playPing();
    });
    socket.on("offer_revoked", ({ bookingId }: { bookingId: string }) => {
      offerEventVersionRef.current += 1;
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

    // Coming back to the app (unlock, app switch): catch up on anything the
    // socket couldn't deliver while the web view was suspended.
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshJobs();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authenticated, qc]);

  // Restore a live offer that arrived while the app was closed/reconnecting or on tab focus.
  useEffect(() => {
    if (!authenticated) return;
    const checkOffer = () => {
      const versionAtRequest = offerEventVersionRef.current;
      fetchCurrentOffer()
        .then((o) => {
          // A socket event that arrived after this request began is newer than
          // its response. Never let a slow `null` reconciliation erase that
          // freshly delivered popup.
          if (o || offerEventVersionRef.current === versionAtRequest) setOffer(o);
        })
        .catch(() => {});
    };
    checkOfferRef.current = checkOffer;
    checkOffer();
    // A lightweight safety net for WebSocket-only production deployments.
    // Five seconds is fast enough to recover a missed popup while remaining
    // tiny compared with location streaming traffic.
    const poll = window.setInterval(checkOffer, online ? 5_000 : 15_000);
    window.addEventListener("focus", checkOffer);
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkOffer();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", checkOffer);
      document.removeEventListener("visibilitychange", onVisibility);
      checkOfferRef.current = () => {};
    };
  }, [authenticated, online]);

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
    // Socket.IO is the fast path; this periodic authenticated write is the
    // reliability path. It keeps nearest-agent ranking current even when a
    // corporate/mobile network blocks WebSockets or the cross-worker adapter
    // is temporarily unavailable.
    if (Date.now() - lastRestLocationAtRef.current >= 20_000) {
      lastRestLocationAtRef.current = Date.now();
      void sendLocationHeartbeat(deviceFix.lat, deviceFix.lng).catch(() => {});
    }
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

  // Keep the phone buzzing for as long as the offer is waiting, like an
  // incoming call — one short buzz is easy to miss in a pocket. Stops the
  // moment the offer is accepted, declined, revoked or runs out.
  const offerKey = offer ? `${offer.bookingId}:${offer.expiresAt}` : null;
  useEffect(() => {
    if (!offer) return;
    const deadline = new Date(offer.expiresAt).getTime();
    const buzz = () => {
      if (Date.now() >= deadline) {
        window.clearInterval(id);
        vibrate(0);
        return;
      }
      vibrate(OFFER_VIBRATION);
    };
    const id = window.setInterval(buzz, OFFER_VIBRATION_REPEAT_MS);
    buzz();
    return () => {
      window.clearInterval(id);
      vibrate(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the offer's identity, not the object
  }, [offerKey]);

  return { offer, accept, decline, accepting, error, locating };
}
