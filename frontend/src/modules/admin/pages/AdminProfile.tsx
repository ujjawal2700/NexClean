import { useAdminMe } from "../api/admin.api";
import { UserProfileEdit } from "@shared/components/UserProfileEdit";
import { Skeleton } from "@shared/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { RefreshCw } from "lucide-react";

export function AdminProfile() {
  const { data: me, isLoading, error, refetch } = useAdminMe();
  const qc = useQueryClient();

  const handleProfileUpdated = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin", "me"] });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-12 text-center">
        <p className="text-sm font-medium text-red-500">Failed to load admin profile details.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          <RefreshCw className="size-4" /> Retry loading
        </Button>
      </div>
    );
  }

  const userObj = {
    id: me.id || (me as any)._id || "",
    name: me.name || "Admin",
    email: me.email || "",
    phone: me.phone || "",
    role: "admin",
    permissions: Array.isArray(me.permissions) ? me.permissions : [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Account Profile</h1>
        <p className="mt-1 text-muted">Manage your personal information, contact details, and security credentials.</p>
      </div>

      <UserProfileEdit user={userObj} onProfileUpdated={handleProfileUpdated} />
    </div>
  );
}
