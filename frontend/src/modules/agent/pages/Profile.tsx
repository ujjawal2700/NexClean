import { useState, useEffect } from "react";
import { User, Phone, Star, BadgeCheck, CheckCircle2, Check, Power } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgentMe, useToggleOnline, useUpdateName } from "../api/agent.api";

export function Profile() {
  const { data: me } = useAgentMe();
  const toggleOnline = useToggleOnline();
  const updateName = useUpdateName();

  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me?.name) setDisplayName(me.name);
  }, [me?.name]);

  const save = () => {
    updateName.mutate(displayName.trim() || "Specialist", {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
    });
  };

  const verified = me?.agentStatus === "verified";
  const initials = (me?.name ?? "NX").split(" ").map((n) => n[0]).join("");

  const stats = [
    { label: "Rating", value: `${me?.rating ?? 0}★` },
    { label: "Jobs done", value: String(me?.jobsDone ?? 0) },
    { label: "Status", value: verified ? "Verified" : me?.agentStatus ?? "—" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-ink">Profile</h1>

      <GlassCard className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-2xl font-semibold text-white shadow-[var(--shadow-glow)]">
          {initials}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <p className="font-display text-xl font-semibold text-ink">{me?.name ?? "Specialist"}</p>
            {verified && <BadgeCheck className="size-5 text-primary" />}
          </div>
          <p className="text-sm text-muted">{me?.phone ?? ""}</p>
          <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted sm:justify-start">
            <Star className="size-4 fill-primary text-primary" /> {me?.rating ?? 0} rating
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <GlassCard key={s.label} className="text-center">
            <p className="font-display text-2xl font-semibold capitalize text-ink">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Power className="size-5" />
          </span>
          <div>
            <p className="font-display font-semibold text-ink">Availability</p>
            <p className="text-sm text-muted">
              You're currently {me?.online ? "online and receiving jobs" : "offline"}.
            </p>
          </div>
        </div>
        <Button
          variant={me?.online ? "outline" : "primary"}
          size="sm"
          disabled={toggleOnline.isPending}
          onClick={() => toggleOnline.mutate(!me?.online)}
        >
          {me?.online ? "Go offline" : "Go online"}
        </Button>
      </GlassCard>

      <GlassCard>
        <p className="font-display text-lg font-semibold text-ink">Account details</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input name="name" label="Full name" leading={<User className="size-4" />} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input name="phone" label="Mobile number" leading={<Phone className="size-4" />} value={me?.phone ?? ""} disabled />
        </div>
        <Button className="mt-4" size="sm" onClick={save} disabled={updateName.isPending}>
          {saved ? (<><Check className="size-4" /> Saved</>) : "Save changes"}
        </Button>
      </GlassCard>

      <GlassCard className="flex items-center gap-3 text-sm text-muted">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        Background-checked &amp; insured. Documents verified by the NexClean team.
      </GlassCard>
    </div>
  );
}
