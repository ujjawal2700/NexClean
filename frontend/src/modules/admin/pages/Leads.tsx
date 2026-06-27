import { useState } from "react";
import {
  MapPin, Phone, Mail, Building2, Calendar, Trash2, Search,
  Users, Loader2, Rocket,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useLeads, useDeleteLead } from "../api/admin.api";
import type { Lead } from "../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LeadCard({ lead, onDelete }: { lead: Lead; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          <Rocket className="size-5" />
        </div>

        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-ink">{lead.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Phone className="size-3" /> {lead.phone}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3" /> {lead.email}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="size-3 text-amber-500" />
              <strong className="text-ink">{lead.city}</strong>
            </span>
            {lead.location && (
              <span className="flex items-center gap-1">
                <Building2 className="size-3" /> {lead.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {formatDate(lead.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function Leads() {
  const { data: leads = [], isLoading } = useLeads();
  const deleteLead = useDeleteLead();
  const [search, setSearch] = useState("");

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.city.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  });

  // Group by city
  const byCityMap = new Map<string, Lead[]>();
  for (const lead of filtered) {
    const existing = byCityMap.get(lead.city) ?? [];
    existing.push(lead);
    byCityMap.set(lead.city, existing);
  }
  const byCityEntries = Array.from(byCityMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            Users from cities where NexClean isn't available yet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5">
            <Rocket className="size-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{leads.length}</p>
            <p className="text-xs text-muted">Total leads</p>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
            <MapPin className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{byCityMap.size}</p>
            <p className="text-xs text-muted">Unique cities</p>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/10">
            <Rocket className="size-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">
              {leads.filter((l) => !l.notified).length}
            </p>
            <p className="text-xs text-muted">Awaiting launch</p>
          </div>
        </GlassCard>
      </div>

      {/* Search */}
      <Input
        name="lead-search"
        placeholder="Search by name, phone, city…"
        leading={<Search className="size-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted">
          <Loader2 className="size-5 animate-spin" /> Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <Rocket className="size-8 text-amber-400" />
          </div>
          <p className="font-semibold text-ink">No leads yet</p>
          <p className="text-sm text-muted">
            When users from unserviced cities sign up, they'll appear here.
          </p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No leads match your search.</p>
      ) : (
        <div className="space-y-6">
          {byCityEntries.map(([city, cityLeads]) => (
            <div key={city}>
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-amber-500" />
                <p className="text-sm font-semibold text-ink">{city}</p>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {cityLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {cityLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDelete={() => deleteLead.mutate(lead.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
