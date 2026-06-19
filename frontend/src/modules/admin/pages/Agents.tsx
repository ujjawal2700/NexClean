import { Star, MapPin, BadgeCheck, Ban, RotateCcw, CreditCard } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useAgents, useSetAgentStatus } from "../api/admin.api";
import { AGENT_STATUS_STYLE } from "../lib/status";

export function Agents() {
  const { data: agents = [] } = useAgents();
  const setAgentStatus = useSetAgentStatus();

  const online = agents.filter((a) => a.online).length;
  const pending = agents.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Agents</h1>
        <p className="mt-1 text-muted">
          {agents.length} specialists · {online} online · {pending} pending verification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <GlassCard key={a.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-semibold text-white">
                {a.name.split(" ").map((n) => n[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-display font-semibold text-ink">{a.name}</p>
                  {a.status === "verified" && <BadgeCheck className="size-4 shrink-0 text-primary" />}
                </div>
                <p className="text-xs text-muted">{a.id} · {a.phone}</p>
              </div>
              <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", AGENT_STATUS_STYLE[a.status])}>
                {a.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface/60 p-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 font-display font-semibold text-ink">
                  <Star className="size-3.5 fill-primary text-primary" /> {a.rating}
                </p>
                <p className="text-[11px] text-muted">Rating</p>
              </div>
              <div>
                <p className="font-display font-semibold text-ink">{a.jobsDone}</p>
                <p className="text-[11px] text-muted">Jobs</p>
              </div>
              <div>
                <p className={cn("font-display font-semibold", a.online ? "text-emerald-600" : "text-muted")}>
                  {a.online ? "Online" : "Off"}
                </p>
                <p className="text-[11px] text-muted">Now</p>
              </div>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4 text-primary" /> {a.area}
            </p>

            {(a.aadharFrontUrl || a.aadharBackUrl) && (
              <div className="mt-3 rounded-2xl border border-line bg-surface/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CreditCard className="size-3.5 text-primary" /> Aadhar {a.aadharNumber || "—"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { label: "Front", url: a.aadharFrontUrl },
                    { label: "Back", url: a.aadharBackUrl },
                  ].map(
                    (doc) =>
                      doc.url && (
                        <a
                          key={doc.label}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl border border-line"
                        >
                          <img src={doc.url} alt={`Aadhar ${doc.label}`} className="aspect-[4/3] w-full object-cover" />
                        </a>
                      ),
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2 border-t border-line/70 pt-4">
              {a.status === "pending" && (
                <Button size="sm" className="flex-1" onClick={() => setAgentStatus.mutate({ id: a.id, status: "verified" })}>
                  <BadgeCheck className="size-4" /> Verify
                </Button>
              )}
              {a.status === "verified" && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setAgentStatus.mutate({ id: a.id, status: "suspended" })}>
                  <Ban className="size-4" /> Suspend
                </Button>
              )}
              {a.status === "suspended" && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setAgentStatus.mutate({ id: a.id, status: "verified" })}>
                  <RotateCcw className="size-4" /> Reinstate
                </Button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
