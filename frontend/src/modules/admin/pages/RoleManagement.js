import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ShieldCheck, Plus, Trash2, Pencil, Users, Key, Check } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, } from "../api/admin.api";
// Standard administrative sections that can be toggled as permissions
const PERMISSION_SECTIONS = [
    { key: "dashboard", label: "Dashboard" },
    { key: "bookings", label: "Bookings" },
    { key: "customers", label: "Customers" },
    { key: "agents", label: "Agents & Verification" },
    { key: "leads", label: "Leads" },
    { key: "payments", label: "Payments & Refunds" },
    { key: "pricing", label: "Pricing Packages" },
    { key: "plans", label: "Subscription Plans" },
    { key: "locations", label: "Cities & Zones" },
    { key: "vehicle-categories", label: "Vehicle Categories" },
    { key: "vehicle-brands", label: "Vehicle Brands" },
    { key: "promotions", label: "Coupons & Banners" },
    { key: "special-coupons", label: "Special Coupons" },
    { key: "referrals", label: "Referrals & Coins" },
    { key: "content", label: "Landing & Static Content" },
    { key: "reports", label: "Analytics Reports" },
    { key: "roles", label: "Roles & Staff Management" },
    { key: "chat", label: "Support Chat" },
];
export function RoleManagement() {
    const [activeTab, setActiveTab] = useState("roles");
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
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormOpen, setRoleFormOpen] = useState(false);
    const [roleName, setRoleName] = useState("");
    const [rolePermissions, setRolePermissions] = useState([]);
    const [roleError, setRoleError] = useState("");
    // Staff Form State
    const [editingStaff, setEditingStaff] = useState(null);
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
    const handleOpenEditRole = (role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRolePermissions(role.permissions);
        setRoleError("");
        setRoleFormOpen(true);
    };
    const handleTogglePermission = (permKey) => {
        setRolePermissions((prev) => prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]);
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
            }
            else {
                await createRoleMutation.mutateAsync({
                    name: roleName.trim(),
                    permissions: rolePermissions,
                });
            }
            setRoleFormOpen(false);
        }
        catch (e) {
            setRoleError(e?.message || "Failed to save role");
        }
    };
    const handleDeleteRole = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete the role "${name}"? This cannot be undone.`)) {
            try {
                await deleteRoleMutation.mutateAsync(id);
            }
            catch (e) {
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
    const handleOpenEditStaff = (staff) => {
        setEditingStaff(staff);
        setStaffName(staff.name);
        setStaffEmail(staff.email);
        setStaffPassword(""); // leave blank unless changing
        const roleId = staff.adminRoleId;
        const resolvedId = roleId && typeof roleId === "object" ? roleId.id : String(roleId || "");
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
            }
            else {
                await createStaffMutation.mutateAsync({
                    name: staffName.trim(),
                    email: staffEmail.trim(),
                    password: staffPassword.trim(),
                    adminRoleId: staffRoleId,
                });
            }
            setStaffFormOpen(false);
        }
        catch (e) {
            setStaffError(e?.message || "Failed to save staff account");
        }
    };
    const handleDeleteStaff = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete the staff account for "${name}"?`)) {
            try {
                await deleteStaffMutation.mutateAsync(id);
            }
            catch (e) {
                alert(e?.message || "Failed to delete staff account");
            }
        }
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Role & Staff Management" }), _jsx("p", { className: "mt-1 text-muted", children: "Create administrative roles and assign section permissions to staff accounts." })] }), _jsxs("div", { className: "flex gap-2 border-b border-line pb-px", children: [_jsxs("button", { onClick: () => setActiveTab("roles"), className: `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none ${activeTab === "roles"
                            ? "border-primary text-primary font-semibold"
                            : "border-transparent text-muted hover:text-ink"}`, children: [_jsx(Key, { className: "size-4" }), " Roles & Permissions"] }), _jsxs("button", { onClick: () => setActiveTab("staff"), className: `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none ${activeTab === "staff"
                            ? "border-primary text-primary font-semibold"
                            : "border-transparent text-muted hover:text-ink"}`, children: [_jsx(Users, { className: "size-4" }), " Staff Accounts"] })] }), activeTab === "roles" ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-ink", children: "Roles" }), _jsx("p", { className: "text-sm text-muted", children: "Manage roles and their access scopes." })] }), _jsxs(Button, { size: "sm", onClick: handleOpenCreateRole, children: [_jsx(Plus, { className: "size-4" }), " Create Role"] })] }), roleFormOpen && (_jsxs(GlassCard, { className: "space-y-5 border border-primary/20", children: [_jsx("h3", { className: "text-lg font-semibold text-ink", children: editingRole ? `Edit Role: ${editingRole.name}` : "Create New Role" }), _jsx("div", { className: "space-y-4 max-w-xl", children: _jsx(Input, { name: "roleName", label: "Role Name", placeholder: "e.g. Operations Manager, Support Executive", value: roleName, onChange: (e) => setRoleName(e.target.value), error: roleError }) }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: "Section Permissions" }), _jsx("div", { className: "grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 bg-surface-muted/50 p-4 rounded-2xl border border-line", children: PERMISSION_SECTIONS.map((sec) => {
                                            const isChecked = rolePermissions.includes(sec.key);
                                            return (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none hover:bg-surface-muted ${isChecked
                                                    ? "border-primary/30 bg-primary/5 text-ink font-medium"
                                                    : "border-line bg-surface text-muted"}`, children: [_jsx("input", { type: "checkbox", checked: isChecked, onChange: () => handleTogglePermission(sec.key), className: "sr-only" }), _jsx("div", { className: `grid size-5 place-items-center rounded-md border transition-all ${isChecked
                                                            ? "bg-primary border-primary text-white"
                                                            : "border-muted/50 text-transparent"}`, children: _jsx(Check, { className: "size-3.5 stroke-[3]" }) }), _jsx("span", { className: "text-sm", children: sec.label })] }, sec.key));
                                        }) })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Button, { onClick: handleSaveRole, disabled: createRoleMutation.isPending || updateRoleMutation.isPending, children: "Save Role" }), _jsx(Button, { variant: "ghost", onClick: () => setRoleFormOpen(false), children: "Cancel" })] })] })), rolesLoading ? (_jsx("div", { className: "py-10 text-center text-muted", children: "Loading roles..." })) : roles.length === 0 ? (_jsx("div", { className: "py-10 text-center text-muted border border-dashed border-line rounded-2xl", children: "No roles found. Create one to get started." })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: roles.map((role) => (_jsxs(GlassCard, { className: "flex flex-col justify-between h-full space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-start gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ShieldCheck, { className: "size-5 text-primary" }), _jsx("h3", { className: "font-display font-semibold text-lg text-ink", children: role.name })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => handleOpenEditRole(role), className: "p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors", title: "Edit Role", children: _jsx(Pencil, { className: "size-4" }) }), _jsx("button", { onClick: () => handleDeleteRole(role.id, role.name), className: "p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50/10 transition-colors", title: "Delete Role", children: _jsx(Trash2, { className: "size-4" }) })] })] }), _jsx("div", { className: "flex flex-wrap gap-1.5 pt-1", children: role.permissions.length === 0 ? (_jsx("span", { className: "text-xs text-muted italic", children: "No permissions assigned" })) : role.permissions.includes("*") ? (_jsx(Badge, { children: "Full Access (*)" })) : (role.permissions.map((perm) => {
                                                const section = PERMISSION_SECTIONS.find((s) => s.key === perm);
                                                return (_jsx(Badge, { className: "capitalize", children: section?.label || perm }, perm));
                                            })) })] }), _jsxs("div", { className: "text-[11px] text-muted border-t border-line/50 pt-2", children: ["Created at ", role.createdAt ? new Date(role.createdAt).toLocaleDateString() : "N/A"] })] }, role.id))) }))] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-ink", children: "Staff Accounts" }), _jsx("p", { className: "text-sm text-muted", children: "Manage credentials and assign roles for sub-admin users." })] }), _jsxs(Button, { size: "sm", onClick: handleOpenCreateStaff, disabled: roles.length === 0, children: [_jsx(Plus, { className: "size-4" }), " Add Staff Account"] })] }), staffFormOpen && (_jsxs(GlassCard, { className: "space-y-5 border border-primary/20", children: [_jsx("h3", { className: "text-lg font-semibold text-ink", children: editingStaff ? `Edit Staff Account: ${editingStaff.name}` : "Create New Staff Account" }), staffError && _jsx("div", { className: "text-xs text-red-500 bg-red-50/10 border border-red-500/20 p-3 rounded-xl", children: staffError }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 max-w-2xl", children: [_jsx(Input, { name: "staffName", label: "Name", placeholder: "e.g. John Doe", value: staffName, onChange: (e) => setStaffName(e.target.value) }), _jsx(Input, { name: "staffEmail", type: "email", label: "Email Address", placeholder: "e.g. john@nexclean.com", value: staffEmail, onChange: (e) => setStaffEmail(e.target.value) }), _jsx(Input, { name: "staffPassword", type: "password", label: editingStaff ? "New Password (Optional)" : "Password", placeholder: editingStaff ? "Leave blank to keep current" : "••••••••", value: staffPassword, onChange: (e) => setStaffPassword(e.target.value) }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Role" }), _jsx("select", { value: staffRoleId, onChange: (e) => setStaffRoleId(e.target.value), className: "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/25", children: roles.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id))) })] })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Button, { onClick: handleSaveStaff, disabled: createStaffMutation.isPending || updateStaffMutation.isPending, children: "Save Account" }), _jsx(Button, { variant: "ghost", onClick: () => setStaffFormOpen(false), children: "Cancel" })] })] })), staffLoading ? (_jsx("div", { className: "py-10 text-center text-muted", children: "Loading staff accounts..." })) : staffList.length === 0 ? (_jsx("div", { className: "py-10 text-center text-muted border border-dashed border-line rounded-2xl", children: "No custom staff accounts found. Create one to allow other users to log in." })) : (_jsx("div", { className: "overflow-x-auto rounded-2xl border border-line bg-surface/50", children: _jsxs("table", { className: "w-full text-left border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-line bg-surface-muted/50 text-xs font-semibold uppercase tracking-wider text-muted", children: [_jsx("th", { className: "px-5 py-3", children: "Name" }), _jsx("th", { className: "px-5 py-3", children: "Email" }), _jsx("th", { className: "px-5 py-3", children: "Assigned Role" }), _jsx("th", { className: "px-5 py-3", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-line/60", children: staffList.map((staff) => {
                                        const roleObj = staff.adminRoleId && typeof staff.adminRoleId === "object" ? staff.adminRoleId : null;
                                        const assignedRole = roleObj ? roleObj.name : "Unknown";
                                        return (_jsxs("tr", { className: "hover:bg-surface-muted/30", children: [_jsx("td", { className: "px-5 py-4 font-medium text-ink", children: staff.name }), _jsx("td", { className: "px-5 py-4 text-muted", children: staff.email }), _jsx("td", { className: "px-5 py-4", children: _jsx(Badge, { children: assignedRole }) }), _jsx("td", { className: "px-5 py-4", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleOpenEditStaff(staff), className: "p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors", title: "Edit Staff", children: _jsx(Pencil, { className: "size-4" }) }), _jsx("button", { onClick: () => handleDeleteStaff(staff.id, staff.name), className: "p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50/10 transition-colors", title: "Delete Staff", children: _jsx(Trash2, { className: "size-4" }) })] }) })] }, staff.id));
                                    }) })] }) }))] }))] }));
}
