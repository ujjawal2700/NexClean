import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, BadgeCheck, CreditCard, ArrowRight } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgents, useSetAgentStatus } from "../api/admin.api";
import { AGENT_STATUS_STYLE } from "../lib/status";

export function AgentVerification() {
  const { data: agents = [] } = useAgents();
  const setAgentStatus = useSetAgentStatus();
  const [query, setQuery] = useState("");

  // Filter to pending status only
  const pendingAgents = agents.filter((a) => a.status === "pending");

  const q = query.toLowerCase();
  const list = pendingAgents.filter((a) => {
    const matchesQuery =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q) ||
      a.area.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q);
    return matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Agent Verification</h1>
        <p className="mt-1 text-muted">
          {pendingAgents.length} {pendingAgents.length === 1 ? "specialist" : "specialists"} pending identity and KYC verification.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-80">
          <Input
            name="search"
            placeholder="Search pending agents…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => {
          return (
            <GlassCard key={a.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 font-display font-semibold text-white">
                  {a.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link to={`/admin/agents/${a.id}`} className="truncate font-display font-semibold text-ink hover:text-primary transition-colors">
                      {a.name}
                    </Link>
                  </div>
                  <p className="text-xs text-muted">{a.id} · {a.phone}</p>
                </div>
                <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", AGENT_STATUS_STYLE[a.status])}>
                  {a.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="size-4 text-primary" /> {a.area || "No area set"}
              </div>

              {/* KYC details section */}
              <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CreditCard className="size-3.5 text-primary" /> Aadhar: {a.aadharNumber || "—"}
                </p>

                {(a.aadharFrontUrl || a.aadharBackUrl) ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
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
                            className="block overflow-hidden rounded-xl border border-line hover:border-primary/50 transition-colors"
                          >
                            <img src={doc.url} alt={`Aadhar ${doc.label}`} className="aspect-[4/3] w-full object-cover" />
                          </a>
                        ),
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted/80 italic">No KYC documents uploaded yet.</p>
                )}
              </div>

              <div className="mt-auto pt-4 flex gap-2 border-t border-line/70 mt-4">
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-sm"
                  onClick={() => setAgentStatus.mutate({ id: a.id, status: "verified" })}
                >
                  <BadgeCheck className="size-4" /> Verify Agent
                </Button>
                <Link to={`/admin/agents/${a.id}`} className="inline-flex">
                  <Button size="sm" variant="outline" aria-label="View details">
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </GlassCard>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full py-12 text-center text-muted">No agents pending verification match your search.</p>
        )}
      </div>
    </div>
  );
}
