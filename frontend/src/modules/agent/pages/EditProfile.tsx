import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Check,
  X,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgentMe, useUpdateName } from "../api/agent.api";

export function EditProfile() {
  const navigate = useNavigate();
  const { data: me } = useAgentMe();
  const updateName = useUpdateName();

  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me?.name) {
      setDisplayName(me.name);
    }
  }, [me]);

  const save = () => {
    updateName.mutate(displayName.trim() || "Specialist", {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  };

  const cancel = () => {
    if (me?.name) {
      setDisplayName(me.name);
    }
    navigate("/agent/profile");
  };

  const isUnverified = me?.agentStatus === "unverified";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title block */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Edit Profile</h1>
      </div>

      {isUnverified && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          ⚠️ Complete KYC verification to update your profile details.
        </div>
      )}

      {/* Personal Details Card */}
      <GlassCard className="space-y-5">
        <div className="flex items-center gap-2 border-b border-line/50 pb-3">
          <User className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Personal Details</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="name"
            label="Full name"
            leading={<User className="size-4" />}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Rohit Kumar"
            disabled={isUnverified}
          />
          <Input
            name="phone"
            label="Mobile number"
            leading={<Phone className="size-4" />}
            value={me?.phone ?? ""}
            disabled
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="sm" onClick={save} disabled={updateName.isPending || isUnverified}>
            {saved ? (
              <>
                <Check className="size-4" /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center gap-2 border-b border-line/50 pb-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Login Identity</h2>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Your phone number is verified during sign-up and KYC verification. To change your registered phone number, please contact support.
        </p>
      </GlassCard>
    </div>
  );
}
