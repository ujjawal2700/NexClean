import { useState } from "react";
import { ShieldCheck, Plus, Trash2, Pencil, Users, Key, Check } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
} from "../api/admin.api";
import type { AdminRole, AdminStaff } from "../types";

// Administrative sections that can be toggled as permissions. Grouped and
// ordered to mirror the sidebar, so granting access reads the same way it is
// navigated. Every key here must match a `permission` in AdminLayout's NAV_GROUPS.
const PERMISSION_SECTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Analytics Reports" },
  { key: "bookings", label: "Bookings & Dispatch" },
  { key: "off-peak-hours", label: "Off-Peak Hours" },
  { key: "area-alerts", label: "Area Alerts" },
  { key: "chat", label: "Support Chat" },
  { key: "customers", label: "Customers" },
  { key: "agents", label: "Agents & Verification" },
  { key: "leads", label: "Leads" },
  { key: "payments", label: "Payments & Refunds" },
  { key: "agent-payouts", label: "Agent Payouts" },
  { key: "payout-requests", label: "Payout Requests" },
  { key: "pricing", label: "Pricing Packages" },
  { key: "plans", label: "Subscription Plans" },
  { key: "vehicle-categories", label: "Vehicle Categories" },
  { key: "vehicle-brands", label: "Vehicle Brands" },
  { key: "locations", label: "Cities & Zones" },
  { key: "promotions", label: "Coupons & Banners" },
  { key: "special-coupons", label: "Special Coupons" },
  { key: "referrals", label: "Referrals & Coins" },
  { key: "notifications", label: "Notifications" },
  { key: "content", label: "Landing & Static Content" },
  { key: "roles", label: "Roles & Staff Management" },
];

export function RoleManagement() {
  const [activeTab, setActiveTab] = useState<"roles" | "staff">("roles");

  // API Hooks
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: staffList = [], isLoading: staffLoading } = useStaff();

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const createStaffMutation = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

  // Role Form State
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleError, setRoleError] = useState("");

  // Staff Form State
  const [editingStaff, setEditingStaff] = useState<AdminStaff | null>(null);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRoleId, setStaffRoleId] = useState("");
  const [staffError, setStaffError] = useState("");

  // Actions - Roles
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRolePermissions(["dashboard"]); // default access
    setRoleError("");
    setRoleFormOpen(true);
  };

  const handleOpenEditRole = (role: AdminRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRolePermissions(role.permissions);
    setRoleError("");
    setRoleFormOpen(true);
  };

  const handleTogglePermission = (permKey: string) => {
    setRolePermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey],
    );
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      return setRoleError("Role name is required");
    }
    setRoleError("");

    try {
      if (editingRole) {
        await updateRoleMutation.mutateAsync({
          id: editingRole.id,
          name: roleName.trim(),
          permissions: rolePermissions,
        });
      } else {
        await createRoleMutation.mutateAsync({
          name: roleName.trim(),
          permissions: rolePermissions,
        });
      }
      setRoleFormOpen(false);
    } catch (e: any) {
      setRoleError(e?.message || "Failed to save role");
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the role "${name}"? This cannot be undone.`)) {
      try {
        await deleteRoleMutation.mutateAsync(id);
      } catch (e: any) {
        alert(e?.message || "Failed to delete role. Make sure no staff member is using it.");
      }
    }
  };

  // Actions - Staff
  const handleOpenCreateStaff = () => {
    setEditingStaff(null);
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setStaffRoleId(roles[0]?.id || "");
    setStaffError("");
    setStaffFormOpen(true);
  };

  const handleOpenEditStaff = (staff: AdminStaff) => {
    setEditingStaff(staff);
    setStaffName(staff.name);
    setStaffEmail(staff.email);
    setStaffPassword(""); // leave blank unless changing
    
    const roleId = staff.adminRoleId;
    const resolvedId = roleId && typeof roleId === "object" ? (roleId as AdminRole).id : String(roleId || "");
    setStaffRoleId(resolvedId);
    
    setStaffError("");
    setStaffFormOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!staffName.trim() || !staffEmail.trim() || !staffRoleId) {
      return setStaffError("Name, email, and role are required");
    }
    if (!editingStaff && !staffPassword) {
      return setStaffError("Password is required for new staff accounts");
    }
    setStaffError("");

    try {
      if (editingStaff) {
        await updateStaffMutation.mutateAsync({
          id: editingStaff.id,
          name: staffName.trim(),
          email: staffEmail.trim(),
          password: staffPassword.trim() || undefined,
          adminRoleId: staffRoleId,
        });
      } else {
        await createStaffMutation.mutateAsync({
          name: staffName.trim(),
          email: staffEmail.trim(),
          password: staffPassword.trim(),
          adminRoleId: staffRoleId,
        });
      }
      setStaffFormOpen(false);
    } catch (e: any) {
      setStaffError(e?.message || "Failed to save staff account");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the staff account for "${name}"?`)) {
      try {
        await deleteStaffMutation.mutateAsync(id);
      } catch (e: any) {
        alert(e?.message || "Failed to delete staff account");
      }
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Role &amp; Staff Management</h1>
        <p className="mt-1 text-muted">Create administrative roles and assign section permissions to staff accounts.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-px">
        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none ${
            activeTab === "roles"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Key className="size-4" /> Roles &amp; Permissions
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none ${
            activeTab === "staff"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users className="size-4" /> Staff Accounts
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === "roles" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-ink">Roles</h2>
              <p className="text-sm text-muted">Manage roles and their access scopes.</p>
            </div>
            <Button size="sm" onClick={handleOpenCreateRole}>
              <Plus className="size-4" /> Create Role
            </Button>
          </div>

          {roleFormOpen && (
            <GlassCard className="space-y-5 border border-primary/20">
              <h3 className="text-lg font-semibold text-ink">
                {editingRole ? `Edit Role: ${editingRole.name}` : "Create New Role"}
              </h3>

              <div className="space-y-4 max-w-xl">
                <Input
                  name="roleName"
                  label="Role Name"
                  placeholder="e.g. Operations Manager, Support Executive"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  error={roleError}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Section Permissions</p>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 bg-surface-muted/50 p-4 rounded-2xl border border-line">
                  {PERMISSION_SECTIONS.map((sec) => {
                    const isChecked = rolePermissions.includes(sec.key);
                    return (
                      <label
                        key={sec.key}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none hover:bg-surface-muted ${
                          isChecked
                            ? "border-primary/30 bg-primary/5 text-ink font-medium"
                            : "border-line bg-surface text-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(sec.key)}
                          className="sr-only"
                        />
                        <div
                          className={`grid size-5 place-items-center rounded-md border transition-all ${
                            isChecked
                              ? "bg-primary border-primary text-white"
                              : "border-muted/50 text-transparent"
                          }`}
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </div>
                        <span className="text-sm">{sec.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveRole} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
                  Save Role
                </Button>
                <Button variant="ghost" onClick={() => setRoleFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </GlassCard>
          )}

          {rolesLoading ? (
            <div className="py-10 text-center text-muted">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="py-10 text-center text-muted border border-dashed border-line rounded-2xl">
              No roles found. Create one to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((role) => (
                <GlassCard key={role.id} className="flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-5 text-primary" />
                        <h3 className="font-display font-semibold text-lg text-ink">{role.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenEditRole(role)}
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors"
                          title="Edit Role"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id, role.name)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50/10 transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {role.permissions.length === 0 ? (
                        <span className="text-xs text-muted italic">No permissions assigned</span>
                      ) : role.permissions.includes("*") ? (
                        <Badge>Full Access (*)</Badge>
                      ) : (
                        role.permissions.map((perm) => {
                          const section = PERMISSION_SECTIONS.find((s) => s.key === perm);
                          return (
                            <Badge key={perm} className="capitalize">
                              {section?.label || perm}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted border-t border-line/50 pt-2">
                    Created at {role.createdAt ? new Date(role.createdAt).toLocaleDateString() : "N/A"}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-ink">Staff Accounts</h2>
              <p className="text-sm text-muted">Manage credentials and assign roles for sub-admin users.</p>
            </div>
            <Button size="sm" onClick={handleOpenCreateStaff} disabled={roles.length === 0}>
              <Plus className="size-4" /> Add Staff Account
            </Button>
          </div>

          {staffFormOpen && (
            <GlassCard className="space-y-5 border border-primary/20">
              <h3 className="text-lg font-semibold text-ink">
                {editingStaff ? `Edit Staff Account: ${editingStaff.name}` : "Create New Staff Account"}
              </h3>

              {staffError && <div className="text-xs text-red-500 bg-red-50/10 border border-red-500/20 p-3 rounded-xl">{staffError}</div>}

              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <Input
                  name="staffName"
                  label="Name"
                  placeholder="e.g. John Doe"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
                <Input
                  name="staffEmail"
                  type="email"
                  label="Email Address"
                  placeholder="e.g. john@nexclean.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
                <Input
                  name="staffPassword"
                  type="password"
                  label={editingStaff ? "New Password (Optional)" : "Password"}
                  placeholder={editingStaff ? "Leave blank to keep current" : "••••••••"}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Role</label>
                  <select
                    value={staffRoleId}
                    onChange={(e) => setStaffRoleId(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveStaff} disabled={createStaffMutation.isPending || updateStaffMutation.isPending}>
                  Save Account
                </Button>
                <Button variant="ghost" onClick={() => setStaffFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </GlassCard>
          )}

          {staffLoading ? (
            <div className="py-10 text-center text-muted">Loading staff accounts...</div>
          ) : staffList.length === 0 ? (
            <div className="py-10 text-center text-muted border border-dashed border-line rounded-2xl">
              No custom staff accounts found. Create one to allow other users to log in.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-muted/50 text-xs font-semibold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Assigned Role</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {staffList.map((staff) => {
                    const roleObj = staff.adminRoleId && typeof staff.adminRoleId === "object" ? (staff.adminRoleId as AdminRole) : null;
                    const assignedRole = roleObj ? roleObj.name : "Unknown";
                    return (
                      <tr key={staff.id} className="hover:bg-surface-muted/30">
                        <td className="px-5 py-4 font-medium text-ink">{staff.name}</td>
                        <td className="px-5 py-4 text-muted">{staff.email}</td>
                        <td className="px-5 py-4">
                          <Badge>{assignedRole}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEditStaff(staff)}
                              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors"
                              title="Edit Staff"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staff.id, staff.name)}
                              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50/10 transition-colors"
                              title="Delete Staff"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
