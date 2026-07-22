import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAgentMe } from "../api/agent.api";
import { UserProfileEdit } from "@shared/components/UserProfileEdit";
import { useQueryClient } from "@tanstack/react-query";

export function EditProfile() {
  const navigate = useNavigate();
  const { data: me, refetch } = useAgentMe();
  const qc = useQueryClient();

  const handleProfileUpdated = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["agent", "me"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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

      <UserProfileEdit
        user={
          me
            ? {
                id: me.id,
                name: me.name,
                email: me.email || "",
                phone: me.phone || "",
                role: "agent",
              }
            : null
        }
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
