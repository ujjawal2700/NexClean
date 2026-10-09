import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL, ApiError } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import {
  meKey,
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

/**
 * Starts an incoming-call style ringtone and returns its cleanup function.
 * WebAudio is asset-free and works in the installed PWA after the app has had
 * a user interaction. Push notification sound remains the background fallback
 * when the operating system suspends the web view.
 */
function startOfferRingtone() {
  let ctx: AudioContext | null = null;
  let interval: number | null = null;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();

    const ring = () => {
      if (!ctx || ctx.state === "closed") return;
      void ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      // Two alternating tones, repeated twice, are much easier to recognise
      // as an incoming job than a single notification chirp.
      [0, 0.28, 0.65, 0.93].forEach((offset, index) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = index % 2 === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.23);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    };

    ring();
    interval = window.setInterval(ring, 2_400);
  } catch {
    /* autoplay blocked or unsupported */
  }

  return () => {
    if (interval !== null) window.clearInterval(interval);
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  };
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
  /** A job of ours that was just cancelled and hasn't been acknowledged yet. */
  cancelledJobId: string | null;
  dismissCancelled: () => void;
  /** This account was just signed in on another phone; this one is signed out. */
  sessionReplaced: boolean;
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
  const [cancelledJobId, setCancelledJobId] = useState<string | null>(null);
  const [sessionReplaced, setSessionReplaced] = useState(false);
  const activeJobIdsRef = useRef<Set<string> | null>(null);
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
      auth: (callback) => {
        const token = useAgentSession.getState().token;
        callback({ role: "agent", ...(token ? { token } : {}) });
      },
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

    // A job of ours was cancelled — tell the cleaner now, not on the next refresh.
    socket.on("job_cancelled", ({ bookingId }: { bookingId: string }) => {
      if (bookingId) setCancelledJobId(bookingId);
      refreshJobs();
    });

    // Signed in on another phone: this one no longer holds the account.
    socket.on("session_replaced", () => {
      offerEventVersionRef.current += 1;
      setOffer(null);
      setSessionReplaced(true);
    });
    // The server refuses a reconnect from a revoked session. Re-reading the
    // profile turns that into a 401, which the route guard sends to login.
    socket.on("connect_error", (err: Error) => {
      if (/session expired/i.test(err.message)) qc.invalidateQueries({ queryKey: meKey });
    });

    // Dispatch switched us offline after a run of unanswered offers.
    socket.on("auto_offline", () => {
      offerEventVersionRef.current += 1;
      setOffer(null);
      qc.invalidateQueries({ queryKey: meKey });
    });

    socket.on("job_offer", (o: JobOffer) => {
      offerEventVersionRef.current += 1;
      setError(null);
      setOffer(new Date(o.expiresAt).getTime() > Date.now() ? o : null);
    });
    socket.on("offer_revoked", ({ bookingId }: { bookingId: string }) => {
      offerEventVersionRef.current += 1;
      setOffer((prev) => (prev?.bookingId === bookingId ? null : prev));
    });
    socket.on("job_assigned", () => {
      checkOfferRef.current();
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    });
    socket.on("notification", () => {
      qc.invalidateQueries({ queryKey: jobsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    });
    socket.on("push_notification", () => {
      checkOfferRef.current();
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

  // Catch cancellations the socket never delivered (phone locked, reconnect):
  // any job we last saw as live that the server now reports cancelled. The
  // first load only records a baseline, so old cancellations don't pop up.
  useEffect(() => {
    const isLive = (s: string) => s === "assigned" || s === "enroute" || s === "arrived" || s === "in_progress";
    const prev = activeJobIdsRef.current;
    if (prev) {
      const justCancelled = jobs.find((j) => j.status === "cancelled" && prev.has(j.id));
      if (justCancelled) setCancelledJobId(justCancelled.id);
    }
    activeJobIdsRef.current = new Set(jobs.filter((j) => isLive(j.status)).map((j) => j.id));
  }, [jobs]);

  const dismissCancelled = useCallback(() => setCancelledJobId(null), []);

  // Restore a live offer that arrived while the app was closed/reconnecting or on tab focus.
  useEffect(() => {
    if (!authenticated || sessionReplaced) return;
    let disposed = false;
    let requestId = 0;
    let inFlight: AbortController | null = null;
    const checkOffer = () => {
      // Middleware rejections do not trigger Socket.IO's automatic reconnect.
      // Retry transient authentication/DB failures on the same safety cadence.
      const socket = socketRef.current;
      if (socket && !socket.connected && !socket.active) socket.connect();
      // Do not continually supersede a slow response on a weak network.
      // A bounded single request can still recover an offer after >5 seconds.
      if (inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      const id = ++requestId;
      const versionAtRequest = offerEventVersionRef.current;
      fetchCurrentOffer(controller.signal)
        .then((o) => {
          // A socket event that arrived after this request began is newer than
          // its response. Never let a slow `null` reconciliation erase that
          // freshly delivered popup.
          if (disposed || id !== requestId || offerEventVersionRef.current !== versionAtRequest) return;
          setOffer(o && new Date(o.expiresAt).getTime() > Date.now() ? o : null);
        })
        .catch(() => {})
        .finally(() => {
          window.clearTimeout(timeout);
          if (inFlight === controller) inFlight = null;
        });
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
      disposed = true;
      inFlight?.abort();
      window.clearInterval(poll);
      window.removeEventListener("focus", checkOffer);
      document.removeEventListener("visibilitychange", onVisibility);
      checkOfferRef.current = () => {};
    };
  }, [authenticated, online, sessionReplaced]);

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
      offerEventVersionRef.current += 1;
      await acceptOffer(offer.bookingId);
      offerEventVersionRef.current += 1;
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
    offerEventVersionRef.current += 1;
    setOffer(null);
    try {
      await declineOffer(id);
    } catch {
      /* dispatch will time it out regardless */
    }
  }, [offer]);

  // Expiry also stops the ringtone when the socket or REST endpoint is down.
  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => {
      offerEventVersionRef.current += 1;
      setOffer(null);
    }, Math.max(0, new Date(offer.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [offer]);

  // Keep the phone buzzing for as long as the offer is waiting, like an
  // incoming call — one short buzz is easy to miss in a pocket. Stops the
  // moment the offer is accepted, declined, revoked or runs out.
  const offerKey = offer ? `${offer.bookingId}:${offer.expiresAt}` : null;
  useEffect(() => {
    if (!offer) return;
    const stopRingtone = startOfferRingtone();
    const buzz = () => {
      vibrate(OFFER_VIBRATION);
    };
    const id = window.setInterval(buzz, OFFER_VIBRATION_REPEAT_MS);
    buzz();
    return () => {
      window.clearInterval(id);
      vibrate(0);
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the offer's identity, not the object
  }, [offerKey]);

  return { offer, accept, decline, accepting, error, locating, cancelledJobId, dismissCancelled, sessionReplaced };
}
