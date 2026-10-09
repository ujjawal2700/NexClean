import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
import { requestCurrentDeviceFix, useDeviceLocation } from "../hooks/useDeviceLocation";
import { useAgentSession } from "../store/sessionStore";
import { useAgentMe, useToggleOnline } from "../api/agent.api";

/** Keep every signed-in agent page inaccessible until device location works. */
export function LocationGate({ children }: { children: ReactNode }) {
  const { fix, error } = useDeviceLocation();
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const clear = useAgentSession((s) => s.clear);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useAgentMe();
  const availability = useToggleOnline();
  const tookOffline = useRef(false);

  useEffect(() => {
    if (fix && !error) tookOffline.current = false;
    if (error && me?.online && !tookOffline.current) {
      tookOffline.current = true;
      availability.mutate({ online: false });
    }
  }, [fix, error, me?.online, availability.mutate]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void requestCurrentDeviceFix().catch(() => {});
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  const retry = async () => {
    if (pending) return;
    setPending(true);
    setRetryError(null);
    try {
      await requestCurrentDeviceFix();
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Couldn't get your location. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (fix && !error) return <>{children}</>;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 py-10" data-testid="agent-location-gate">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center"><Logo variant="full" /></div>
        <div className="rounded-card border border-line bg-surface p-6 shadow-lg sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><MapPin className="size-6" /></span>
          <h1 className="mt-5 text-2xl text-ink">Location access required</h1>
          <p className="mt-3 text-sm text-muted">Allow location access and turn on your device's location to use the agent app. We need your current location for nearby jobs and live service tracking.</p>
          {(retryError || error) && <p role="alert" className="mt-4 text-sm text-red-600">{retryError || error}</p>}
          <Button className="mt-6 w-full" disabled={pending} onClick={() => void retry()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Getting location…" : "Enable location"}
          </Button>
          <p className="mt-3 text-xs text-muted">If access is blocked, allow Location for NexClean in your browser or app settings, then try again.</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => {
            clear();
            qc.clear();
            navigate("/agent/login", { replace: true });
          }}>Log out</Button>
        </div>
      </div>
    </main>
  );
}
