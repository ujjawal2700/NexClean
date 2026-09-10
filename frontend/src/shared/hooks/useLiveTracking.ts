import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiFetch, SOCKET_URL } from "@shared/lib/api";
import type {
  AgentLocationEvent,
  BookingProgressEvent,
  DispatchProgressEvent,
  LiveFix,
  TrackingSnapshot,
} from "@shared/types/tracking";

export type LiveTracking = {
  snapshot: TrackingSnapshot | null;
  /** Freshest position — the socket stream when live, else the snapshot's. */
  fix: LiveFix | null;
  loading: boolean;
  error: string | null;
  /** True once the socket is connected AND the booking room is joined. */
  connected: boolean;
  /** Seconds since the last accepted fix, or null when none has arrived. */
  staleSeconds: number | null;
  refresh: () => void;
};

/** Above this, the cleaner's phone has stopped reporting and we should say so. */
export const FIX_STALE_SECONDS = 45;

/**
 * Subscribe to one booking's live tracking feed.
 *
 * Two sources, deliberately: a REST snapshot establishes the whole picture
 * (including everything the socket never sends, like the address and the
 * package), and socket events patch the parts that move. That split is what
 * lets the screen survive a dropped connection — reconnecting re-runs the
 * snapshot and the UI is whole again, rather than resuming mid-stream with
 * gaps.
 */
export function useLiveTracking(bookingId: string | undefined, enabled = true): LiveTracking {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [loading, setLoading] = useState(!!bookingId);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const socketRef = useRef<Socket | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * A customer watching their own booking sits in two rooms at once — the
   * booking's, and their personal user room — so every progress event arrives
   * twice. Both copies are identical and carry the server's timestamp, which
   * makes the duplicate cheap to recognise and worth dropping: each one would
   * otherwise trigger its own snapshot re-fetch.
   */
  const lastProgressRef = useRef<string>("");

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  /* ------------------------------- snapshot ------------------------------- */
  useEffect(() => {
    if (!bookingId || !enabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    apiFetch<TrackingSnapshot>(`/tracking/bookings/${bookingId}`)
      .then((data) => {
        if (!alive) return;
        setSnapshot(data);
        setError(null);
        // Only seed from the snapshot when the stream hasn't already produced
        // something newer — a refresh mid-journey must not rewind the marker.
        setFix((current) => {
          if (!data.agentLocation) return current;
          if (!current) return data.agentLocation;
          return new Date(data.agentLocation.updatedAt) > new Date(current.updatedAt)
            ? data.agentLocation
            : current;
        });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Couldn't load tracking");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookingId, enabled, reloadToken]);

  /* -------------------------------- socket -------------------------------- */
  useEffect(() => {
    if (!bookingId || !enabled) return;

    const socket = io(SOCKET_URL, { withCredentials: true, transports: ["websocket"] });
    socketRef.current = socket;

    const join = () => {
      // The room is authorized server-side on join, so a rejection here is the
      // same answer the REST snapshot would give — surface it rather than
      // silently sitting in a room we were never admitted to.
      socket.emit("join_booking", bookingId, (res: { ok?: boolean; error?: string } | undefined) => {
        setConnected(!!res?.ok);
        if (res?.ok) {
          // Clear a previous refusal: a reconnect that succeeds means whatever
          // the last one complained about no longer applies, and leaving the
          // message up would misreport a working screen as broken.
          setError(null);
        } else if (res?.error) {
          setError(res.error);
        }
      });
    };

    socket.on("connect", join);
    socket.on("disconnect", () => setConnected(false));

    socket.on("agent_location_update", (payload: AgentLocationEvent) => {
      // The admin feed names many bookings per message; the per-booking room
      // names one. Accept either, but never a fix meant for a different job.
      const matches =
        payload.bookingId === bookingId || payload.bookingIds?.includes(bookingId) || false;
      if (!matches) return;
      setFix({
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
        updatedAt: payload.updatedAt,
      });
    });

    socket.on("booking_progress", (payload: BookingProgressEvent) => {
      if (payload.bookingId !== bookingId) return;
      const signature = `${payload.jobStatus}:${payload.dispatchStatus}:${payload.status}:${payload.at}`;
      if (signature === lastProgressRef.current) return;
      lastProgressRef.current = signature;
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              jobStatus: payload.jobStatus,
              dispatchStatus: payload.dispatchStatus,
              status: payload.status,
              // A phase change can add or remove the cleaner (assignment,
              // completion, cancellation), and only the snapshot knows their
              // details — so re-read rather than guess.
              trackable:
                payload.status === "upcoming" &&
                ["assigned", "enroute", "arrived", "in_progress"].includes(payload.jobStatus),
            }
          : prev,
      );
      refresh();
    });

    socket.on("dispatch_progress", (payload: DispatchProgressEvent) => {
      if (payload.bookingId !== bookingId) return;
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              dispatchStatus: payload.dispatchStatus,
              dispatchAttempts: payload.dispatchAttempts,
              searchRadiusM: payload.searchRadiusM,
            }
          : prev,
      );
    });

    // A cleaner being assigned is the moment the screen changes character
    // entirely, so pull the full picture rather than patching fields.
    socket.on("booking_assigned", (payload: { bookingId: string }) => {
      if (payload?.bookingId === bookingId) refresh();
    });

    if (socket.connected) join();

    return () => {
      socket.emit("leave_booking", bookingId);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [bookingId, enabled, refresh]);

  /* ------------------------------ staleness ------------------------------ */
  useEffect(() => {
    if (!fix) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [fix]);

  const staleSeconds = fix
    ? Math.max(0, Math.round((now - new Date(fix.updatedAt).getTime()) / 1000))
    : null;

  return { snapshot, fix, loading, error, connected, staleSeconds, refresh };
}
