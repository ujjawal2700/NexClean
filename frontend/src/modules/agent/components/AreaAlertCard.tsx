import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radar, BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { ApiError } from "@shared/lib/api";
import { useNotifyArea } from "../api/agent.api";

/**
 * Agent-side trigger for the Smart Area Alert (NexClean Nearby). Calls the
 * backend, which finds nearby customers in the society and pushes each one.
 */
export function AreaAlertCard({ society }: { society: string }) {
  const notifyArea = useNotifyArea();
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const send = async () => {
    setError("");
    try {
      const alert = await notifyArea.mutateAsync(society);
      setSentCount(alert.sentCount);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the alert");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-card border border-primary/20 bg-gradient-to-br from-primary to-primary-soft p-6 text-white shadow-[var(--shadow-glow)]">
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(circle, #00C2FF, transparent 70%)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Radar className="size-5" />
          <p className="font-display text-lg font-semibold">NexClean Nearby</p>
        </div>
        <p className="mt-2 max-w-sm text-sm text-white/85">
          You're servicing <span className="font-semibold">{society}</span>. Notify nearby customers
          about a cleaning opportunity in their area.
        </p>

        <div className="mt-5">
          <AnimatePresence mode="wait">
            {sentCount === null ? (
              <motion.div key="cta" exit={{ opacity: 0 }}>
                <Button variant="glass" className="bg-white text-primary hover:bg-white" onClick={send} disabled={notifyArea.isPending}>
                  {notifyArea.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <BellRing className="size-4" /> Notify nearby customers
                    </>
                  )}
                </Button>
                {error && <p className="mt-2 text-sm text-white/90">{error}</p>}
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-pill bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur"
              >
                <Check className="size-4" /> Alert sent to {sentCount} nearby customer(s)
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
