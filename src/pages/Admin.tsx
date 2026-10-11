import { useEffect, useState } from "react";
import {
  Users as UsersIcon,
  Shield,
  Settings as SettingsIcon,
  Bell,
  Trash2,
  Pencil,
  Plus,
  X,
  Building2,
  Landmark,
  Network,
  ChevronRight,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Copy,
  Check,
  CheckCircle2,
  Mail,
  Eye,
  RotateCw,
  AlertTriangle,
  FolderGit2,
} from "lucide-react";
import {
  usersApi,
  escalationRulesApi,
  organizationApi,
  companyApi,
  entityApi,
  invitationsApi,
  projectsApi,
  type User,
  type UserUpdatePayload,
  type ApiEscalationRule,
  type EscalationRulePayload,
  type Organization,
  type OrganizationPayload,
  type OrganizationCompany,
  type OrganizationCompanyPayload,
  type Entity,
  type EntityPayload,
  type Invitation,
  type InvitationPayload,
  type ApiProject,
  type statusesApi,
  resolveImageUrl,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileModal } from "@/components/layout/UserProfileModal";

type TabKey = "users" | "escalation" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "escalation", label: "Escalation Matrix" },
  { key: "settings", label: "Settings" },
];

function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [showRolesPermissions, setShowRolesPermissions] = useState(false);

  if (showGeneralSettings) {
    return <GeneralSettingsApp onExit={() => setShowGeneralSettings(false)} />;
  }

  if (showRolesPermissions) {
    return <RolesPermissionsApp onExit={() => setShowRolesPermissions(false)} />;
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {user?.is_superuser ? "Super Admin" : "Admin"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">System configuration and user management</p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap sm:inline-flex items-center gap-1 bg-gray-100 dark:bg-secondary/80 border border-transparent dark:border-border rounded-xl p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white dark:bg-card text-gray-900 dark:text-gray-100 shadow-sm border border-transparent dark:border-border"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm dark:shadow-none p-4 sm:p-6">
          {activeTab === "users" && <UsersTab currentUser={user!} />}
          {activeTab === "escalation" && <EscalationMatrixTab />}
          {activeTab === "settings" && (
            <SettingsTab
              onOpenGeneralSettings={() => setShowGeneralSettings(true)}
              onOpenRolesPermissions={() => setShowRolesPermissions(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Cycled by row position so the avatar colors vary the way they do in the
// design (each user isn't tied to a specific color, it's just alternated).
const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/40",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800/40",
  "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-800/40",
  "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 dark:border dark:border-rose-800/40",
  "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border dark:border-cyan-800/40",
];

// Role names are free text (set per-company, see accounts.Role), so this
// matches on keywords rather than an exact/fixed list — any role containing
// "admin", "manager", etc. still gets a sensible color instead of falling
// through to the gray default.
function roleBadgeClasses(role: string) {
  const key = (role || "").toLowerCase();
  if (key.includes("super")) return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border dark:border-blue-800/50";
  if (key.includes("admin")) return "bg-green-50 text-green-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/50";
  if (key.includes("manager")) return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 dark:border dark:border-purple-800/50";
  if (key.includes("viewer")) return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50";
  if (key.includes("engineer")) return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border dark:border-cyan-800/50";
  return "bg-gray-100 text-gray-700 dark:bg-secondary dark:text-gray-300 dark:border dark:border-border";
}

function formatLastLogin(lastLogin: string | null) {
  if (!lastLogin) return "Never";
  const date = new Date(lastLogin);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { datePart, timePart };
}

// A user's row is only considered "Active" once two things are true:
//   1) their account is enabled (is_active), AND
//   2) if they came in through an invite, that invite was actually
//      accepted — a pending/expired/revoked invite always reads as
//      "Inactive" regardless of the raw is_active flag on the account.
// This is what ties the badge to "did the invited person accept the
// invite link", per how invitationsApi/usersApi report status.
function getUserActivity(user: User, invitesByEmail: Map<string, Invitation>): "active" | "inactive" {
  const invite = invitesByEmail.get(user.email.trim().toLowerCase());
  if (invite && invite.status !== "accepted") return "inactive";
  return user.is_active ? "active" : "inactive";
}

function UsersTab({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [invitesByEmail, setInvitesByEmail] = useState<Map<string, Invitation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Only SuperAdmin or an Admin whose Role actually carries
  // 'can_manage_users' may invite people
  const canInvite = currentUser.is_superuser || currentUser.can_manage_users;

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, invites] = await Promise.all([usersApi.list(), invitationsApi.list()]);
      setUsers(usersData);
      const byEmail = new Map<string, Invitation>();
      invites.forEach((inv) => byEmail.set(inv.email.trim().toLowerCase(), inv));
      setInvitesByEmail(byEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleToggleActive(user: User) {
    setTogglingId(user.id);
    setError(null);
    setActionSuccess(null);
    try {
      if (user.is_active) {
        await usersApi.disable(user.id);
        setActionSuccess(`User account "${user.name}" disabled and active sessions revoked.`);
      } else {
        await usersApi.enable(user.id);
        setActionSuccess(`User account "${user.name}" re-enabled successfully.`);
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleResendInvite(user: User) {
    const invite = invitesByEmail.get(user.email.trim().toLowerCase());
    if (!invite) return;
    setResendingId(user.id);
    setError(null);
    setActionSuccess(null);
    try {
      await invitationsApi.resend(invite.id);
      setActionSuccess(`Invitation email resent to ${user.email}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Management</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage user accounts, roles, access permissions, and invitation lifecycle
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteUser(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <Plus size={16} />
            Invite New User
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccess}</span>
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading users…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto border border-gray-100 dark:border-border rounded-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-border bg-gray-50/60 dark:bg-muted/50">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Role
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Organization
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Assigned Projects
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Account Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Invitation
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Last Login
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                const lastLogin = formatLastLogin(user.last_login);
                const isToggling = togglingId === user.id;
                const isResending = resendingId === user.id;
                const matchingInvite = invitesByEmail.get(user.email.trim().toLowerCase());
                const inviteStatus = matchingInvite ? matchingInvite.status : user.invitation_status || "accepted";
                const isPendingInvite = inviteStatus === "pending" || inviteStatus === "expired";

                return (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-border last:border-b-0 hover:bg-gray-50/60 dark:hover:bg-muted/30 transition-colors"
                  >
                    {/* 1. User Full Name & Username */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full font-semibold flex items-center justify-center text-xs shrink-0 ${
                            AVATAR_COLORS[index % AVATAR_COLORS.length]
                          }`}
                        >
                          {initials(user.name || user.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                            {user.name || "—"}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">@{user.username}</p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">ID: USR-{String(user.id).padStart(4, "0")}</span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Email Address */}
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {user.email || "—"}
                    </td>

                    {/* 3. Assigned Role */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeClasses(user.role)}`}
                      >
                        {user.is_superuser ? "Super Admin" : user.role || "User"}
                      </span>
                    </td>

                    {/* 4. Organization */}
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {user.company_name || "Primary Tenant"}
                    </td>

                    {/* 5. Assigned Projects */}
                    <td className="px-4 py-3">
                      {user.assigned_projects && user.assigned_projects.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {user.assigned_projects.slice(0, 2).map((p, pIdx) => {
                            const name = typeof p === "string" ? p : String((p as any)?.name ?? p);
                            return (
                              <span
                                key={pIdx}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 truncate max-w-[100px]"
                                title={name}
                              >
                                {name}
                              </span>
                            );
                          })}
                          {user.assigned_projects.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-400">
                              +{user.assigned_projects.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">All Projects</span>
                      )}
                    </td>

                    {/* 6. Account Status (Active / Disabled) */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-green-50 text-green-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
                            : "bg-red-50 text-red-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.is_active ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {user.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* 7. Invitation Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                          inviteStatus === "accepted"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : inviteStatus === "pending"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-secondary dark:text-gray-400"
                        }`}
                      >
                        {inviteStatus}
                      </span>
                    </td>

                    {/* 8. Last Login */}
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {typeof lastLogin === "string" ? (
                        lastLogin
                      ) : (
                        <>
                          <span>{lastLogin.datePart}</span>
                          <span className="text-[10px] text-gray-400 block">{lastLogin.timePart}</span>
                        </>
                      )}
                    </td>

                    {/* 9. Action Buttons */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Profile */}
                        <button
                          type="button"
                          onClick={() => setViewingProfileUser(user)}
                          className="p-1.5 rounded-md border border-gray-200 dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted transition-colors"
                          title="View Profile Details"
                          aria-label={`View ${user.name} profile`}
                        >
                          <Eye size={14} />
                        </button>

                        {/* Edit Role & Permissions */}
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 rounded-md border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                          title="Edit User Role & Permissions"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Toggle Disable / Enable Account */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          disabled={isToggling}
                          className={`p-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                            user.is_active
                              ? "border-green-200 dark:border-emerald-800/60 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-950/60"
                              : "border-gray-200 dark:border-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-muted"
                          }`}
                          title={user.is_active ? "Disable user access" : "Re-enable user access"}
                          aria-label={user.is_active ? `Disable ${user.name}` : `Enable ${user.name}`}
                        >
                          {user.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>

                        {/* Resend Invitation (if pending) */}
                        {isPendingInvite && matchingInvite && (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(user)}
                            disabled={isResending}
                            className="p-1.5 rounded-md border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors disabled:opacity-50"
                            title="Resend Invitation Email"
                            aria-label={`Resend invite to ${user.email}`}
                          >
                            <RotateCw size={14} className={isResending ? "animate-spin" : ""} />
                          </button>
                        )}

                        {/* Delete User */}
                        <button
                          type="button"
                          onClick={() => setDeletingUser(user)}
                          className="p-1.5 rounded-md border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                          title="Delete / Deactivate User"
                          aria-label={`Delete ${user.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No users registered yet.</p>
          )}
        </div>
      )}

      {showInviteUser && (
        <AddInvitationDialog
          onClose={() => setShowInviteUser(false)}
          onInvited={() => {
            setShowInviteUser(false);
            loadUsers();
          }}
          currentUser={currentUser}
        />
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          currentUser={currentUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          currentUser={currentUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => {
            setDeletingUser(null);
            loadUsers();
          }}
        />
      )}

      {viewingProfileUser && (
        <UserProfileModal
          user={viewingProfileUser}
          open={!!viewingProfileUser}
          onOpenChange={(open) => {
            if (!open) setViewingProfileUser(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Invitation Dialog ----
// Organization is a real dropdown (fetched from the API), always available —
// not gated behind is_superuser, since that flag isn't reliably present on
// every account. Role and Department stay free-text: the backend
// resolves-or-creates them scoped to whichever organization is selected.

function AddInvitationDialog({
  onClose,
  onInvited,
  currentUser,
}: {
  onClose: () => void;
  onInvited: () => void;
  currentUser: User;
}) {
  const [form, setForm] = useState({
    email: "",
    phone_number: "",
    name: "",
    username: "",
    company: currentUser.company || 0,
    role: "",
    department: "",
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOrgsLoading(true);
    organizationApi
      .list()
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs);
        setOrgsError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setOrgsError("Failed to load organizations");
        }
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!form.company) {
      setError("Please select an organization");
      return;
    }
    const payload: InvitationPayload = {
      email: form.email.trim(),
      phone_number: form.phone_number.trim() || undefined,
      name: form.name.trim() || undefined,
      username: form.username.trim() || undefined,
      company: form.company,
      role: form.role.trim() || undefined,
      department: form.department.trim() || undefined,
    };
    setSubmitting(true);
    try {
      const created = await invitationsApi.create(payload);
      setCreatedInvitation(created);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Invite User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="py-2 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center mb-2">
                <Mail size={24} />
              </div>
              <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100">Invitation Sent to Mailbox!</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                An invitation email has been sent directly to <strong className="text-gray-900 dark:text-gray-100">{form.email}</strong>.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The user can open their mailbox and click the link in the email to accept the invitation and set up their password.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onInvited}
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Horizontal (2-column) layout so related fields sit side by side
                instead of stacking one per row. */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name">
                <TextInput
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Jane Doe"
                />
              </Field>
              <Field label="Username">
                <TextInput
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  placeholder="Suggested username (they can change it)"
                />
              </Field>
              <Field label="Email">
                <TextInput
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>
              <Field label="Phone number (optional)">
                <TextInput
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                />
              </Field>
              <Field label="Role">
                <TextInput
                  value={form.role}
                  onChange={(e) => update("role", e.target.value)}
                  placeholder="e.g. Project Manager"
                />
              </Field>
              <Field label="Department">
                <TextInput
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </Field>
            </div>

            <Field label="Organization">
              <select
                required
                disabled={orgsLoading}
                value={form.company || ""}
                onChange={(e) => update("company", Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-50 dark:disabled:bg-muted/60 disabled:text-gray-400 transition-colors"
              >
                <option value="" className="bg-white dark:bg-card text-gray-900 dark:text-gray-100">
                  {orgsLoading ? "Loading organizations…" : "Select organization"}
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id} className="bg-white dark:bg-card text-gray-900 dark:text-gray-100">
                    {org.name}
                  </option>
                ))}
              </select>
              {orgsError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{orgsError}</p>}
            </Field>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting ? "Sending…" : "Send Invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Delete User Dialog ----
function DeleteUserDialog({
  user,
  currentUser,
  onClose,
  onDeleted,
}: {
  user: User;
  currentUser: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [permanent, setPermanent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentUser.id;

  async function handleDelete() {
    if (isSelf) {
      setError("You cannot delete or deactivate your own account.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.remove(user.id, permanent);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle size={20} />
            <h3 className="text-lg font-bold">Remove User</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          You are about to modify access for <strong className="text-gray-900 dark:text-gray-100">{user.name}</strong> ({user.email}).
        </p>

        <div className="space-y-3 bg-gray-50 dark:bg-secondary/40 p-3 rounded-xl border border-gray-100 dark:border-border text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="delete-type"
              checked={!permanent}
              onChange={() => setPermanent(false)}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-semibold text-gray-900 dark:text-gray-100 block">
                Deactivate Account (Recommended)
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Immediately revokes session tokens and blocks future login. Preserves user assignment history, checklists, task logs, and comments without breaking historical records.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-gray-200 dark:border-border">
            <input
              type="radio"
              name="delete-type"
              checked={permanent}
              onChange={() => setPermanent(true)}
              className="mt-0.5 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="font-semibold text-red-600 dark:text-red-400 block">
                Permanent Deletion
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Permanently deletes the user record from the database. Only permitted if no active tasks or workflow ownership exist.
              </span>
            </div>
          </label>
        </div>

        {isSelf && (
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Warning: You cannot delete your own account while logged in.
          </p>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || isSelf}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? "Processing…" : permanent ? "Permanently Delete" : "Deactivate User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Edit User Dialog ----
function EditUserDialog({
  user,
  currentUser,
  onClose,
  onSaved,
}: {
  user: User;
  currentUser: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [company, setCompany] = useState<number | null>(user.company);
  const [role, setRole] = useState(user.role);
  const [department, setDepartment] = useState(user.department);
  const [isActive, setIsActive] = useState(user.is_active);

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<number[]>(
    user.assigned_project_ids || []
  );

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOrgsLoading(true);
    organizationApi
      .list()
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs);
        setOrgsError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setOrgsError("Failed to load organizations");
        }
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });

    projectsApi
      .list()
      .then((projs) => {
        if (!cancelled) setProjects(projs);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !department.trim() || !role.trim()) {
      setError("Please fill in name, username, department, and role.");
      return;
    }
    if (!company) {
      setError("Please select an organization.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: UserUpdatePayload = {
        name,
        username,
        email,
        is_active: isActive,
        role,
        department,
        company,
        assigned_project_ids: assignedProjectIds,
      };
      await usersApi.update(user.id, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit User & Role Permissions</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Username">
              <TextInput required value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Email">
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Department">
              <TextInput
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
              />
            </Field>
            <Field label="Role">
              <TextInput
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Project Manager"
              />
            </Field>
          </div>

          <Field label="Organization">
            <select
              required
              disabled={orgsLoading}
              value={company || ""}
              onChange={(e) => setCompany(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-50 dark:disabled:bg-muted/60 disabled:text-gray-400 transition-colors"
            >
              <option value="" className="bg-white dark:bg-card text-gray-900 dark:text-gray-100">
                {orgsLoading ? "Loading organizations…" : "Select organization"}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-white dark:bg-card text-gray-900 dark:text-gray-100">
                  {org.name}
                </option>
              ))}
            </select>
            {orgsError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{orgsError}</p>}
          </Field>

          {/* Assigned Projects Multi-Select */}
          <div>
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <FolderGit2 size={13} className="text-blue-600" />
              <span>Assigned Projects Access</span>
            </span>
            <div className="max-h-32 overflow-y-auto p-2.5 rounded-lg border border-gray-200 dark:border-border bg-gray-50/50 dark:bg-secondary/40 space-y-1.5">
              {projects.map((proj) => {
                const checked = assignedProjectIds.includes(proj.id);
                return (
                  <label key={proj.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedProjectIds((prev) => [...prev, proj.id]);
                        } else {
                          setAssignedProjectIds((prev) => prev.filter((id) => id !== proj.id));
                        }
                      }}
                      className="rounded border-gray-300 dark:border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate font-medium">{proj.name}</span>
                  </label>
                );
              })}
              {projects.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">No projects created yet.</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300 dark:border-border bg-white dark:bg-secondary text-blue-600 focus:ring-blue-500"
            />
            Active Account
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-50 dark:disabled:bg-muted/60 disabled:text-gray-500 dark:disabled:text-gray-400 transition-colors ${props.className || ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Escalation Matrix tab (unchanged)
// ---------------------------------------------------------------------------

function EscalationMatrixTab() {
  const [rules, setRules] = useState<ApiEscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState<ApiEscalationRule | null>(null);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      const data = await escalationRulesApi.list();
      setRules([...data].sort((a, b) => a.level - b.level));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Escalation Matrix</h2>
        </div>
        <button
          onClick={() => setShowAddRule(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => setEditingRule(rule)}
              className="w-full flex items-center justify-between border border-gray-100 dark:border-border bg-white dark:bg-card rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors text-left shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-600 text-white font-semibold flex items-center justify-center text-sm shadow-sm">
                  L{rule.level}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{rule.role}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{rule.description}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-secondary/60 text-xs font-medium">
                {rule.days} days
              </span>
            </button>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-border rounded-xl px-4 py-6 text-center">
              No escalation rules yet.
            </p>
          )}
        </div>
      )}

      {showAddRule && (
        <EscalationRuleDialog
          rule={null}
          onClose={() => setShowAddRule(false)}
          onSaved={() => {
            setShowAddRule(false);
            loadRules();
          }}
          onDeleted={() => {
            setShowAddRule(false);
            loadRules();
          }}
        />
      )}

      {editingRule && (
        <EscalationRuleDialog
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={() => {
            setEditingRule(null);
            loadRules();
          }}
          onDeleted={() => {
            setEditingRule(null);
            loadRules();
          }}
        />
      )}
    </div>
  );
}

function EscalationRuleDialog({
  rule,
  onClose,
  onSaved,
  onDeleted,
}: {
  rule: ApiEscalationRule | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEditing = rule !== null;
  const [level, setLevel] = useState(rule ? String(rule.level) : "");
  const [role, setRole] = useState(rule?.role ?? "");
  const [days, setDays] = useState(rule ? String(rule.days) : "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const levelNum = Number(level);
    const daysNum = Number(days);
    if (!role.trim() || !level.trim() || !days.trim() || Number.isNaN(levelNum) || Number.isNaN(daysNum)) {
      setError("Please fill in level, role, and days.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const payload: EscalationRulePayload = {
      level: levelNum,
      role,
      days: daysNum,
      description,
    };
    try {
      if (isEditing && rule) {
        await escalationRulesApi.update(rule.id, payload);
      } else {
        await escalationRulesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!rule) return;
    setSubmitting(true);
    setError(null);
    try {
      await escalationRulesApi.remove(rule.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isEditing ? "Edit Rule" : "Add Rule"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <TextInput
                required
                type="number"
                min={1}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </Field>
            <Field label="Days">
              <TextInput
                required
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Role">
            <TextInput
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Project Manager"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
            />
          </Field>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting ? "Saving…" : isEditing ? "Save" : "Create rule"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab({
  onOpenGeneralSettings,
  onOpenRolesPermissions,
}: {
  onOpenGeneralSettings: () => void;
  onOpenRolesPermissions: () => void;
}) {
  const [summary, setSummary] = useState<{ orgs: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    organizationApi
      .list()
      .then((orgs) => {
        if (cancelled) return;
        setSummary({ orgs: orgs.length });
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generalSettingsDescription =
    !summary || summary.orgs === 0
      ? "Organizations"
      : `${summary.orgs} ${pluralize(summary.orgs, "organization")}`;

  const settingsCards: {
    icon: typeof SettingsIcon;
    title: string;
    description: string;
    disabled: boolean;
    onClick?: () => void;
  }[] = [
    {
      icon: SettingsIcon,
      title: "General Settings",
      description: generalSettingsDescription,
      disabled: false,
      onClick: onOpenGeneralSettings,
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Not wired to a backend yet",
      disabled: true,
    },
    {
      icon: UsersIcon,
      title: "Roles & Permissions",
      description: "Review invited users",
      disabled: false,
      onClick: onOpenRolesPermissions,
    },
    {
      icon: Shield,
      title: "Security",
      description: "Not wired to a backend yet",
      disabled: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {settingsCards.map(({ icon: Icon, title, description, disabled, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-disabled={disabled}
          className={`text-left flex items-start gap-3 border rounded-xl px-5 py-4 transition-colors bg-white dark:bg-card shadow-sm dark:shadow-none ${
            disabled
              ? "border-gray-100 dark:border-border opacity-50 cursor-not-allowed"
              : "border-gray-100 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/40"
          }`}
        >
          <Icon size={20} className="text-gray-500 dark:text-gray-400 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {title}
              {disabled && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400 bg-gray-100 dark:bg-secondary rounded-full px-2 py-0.5 border border-transparent dark:border-border">
                  Coming soon
                </span>
              )}
            </p>
            <p className="text-sm mt-0.5 text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function pluralize(count: number, singular: string, plural: string = `${singular}s`) {
  return count === 1 ? singular : plural;
}

// ---------------------------------------------------------------------------
// Roles & Permissions — Invitations
//
// Backed by /invitations/, which is a separate record from /users/ (an
// invitation only becomes a User once accepted, and there's no id linking
// the two back together). invitationsApi currently exposes list/create/
// remove only — no update — so this screen shows full invitation details
// in the same visual language as EditUserDialog, but read-only, with
// "Revoke" as the one available action. Wire in an update() call here if
// a PATCH /invitations/:id/ endpoint gets added later.
//
// Activity status ("Active" / "Inactive" / "Pending") is derived from real
// data, not hardcoded:
//   - status !== "accepted"  -> "Pending" (hasn't logged in yet)
//   - status === "accepted"  -> matched against /users/ by email (the only
//     link we have back to the User record) and judged by that user's real
//     last_login: logged in within the last 2 months -> "Active", otherwise
//     "Inactive".
// ---------------------------------------------------------------------------

function RolesPermissionsApp({ onExit }: { onExit: () => void }) {
  const { user: currentUser } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [usersByEmail, setUsersByEmail] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invitation | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  async function loadInvitations() {
    setLoading(true);
    setError(null);
    try {
      const [invites, users] = await Promise.all([invitationsApi.list(), usersApi.list()]);

      const byEmail = new Map<string, User>();
      users.forEach((u) => byEmail.set(u.email.trim().toLowerCase(), u));
      setUsersByEmail(byEmail);

      setInvitations(
        [...invites].sort((a, b) => {
          const rank = { active: 0, pending: 1, inactive: 2 } as const;
          const rankA = rank[getInvitationActivity(a, byEmail)];
          const rankB = rank[getInvitationActivity(b, byEmail)];
          if (rankA !== rankB) return rankA - rankB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvitations();
  }, []);

  const activeCount = invitations.filter((inv) => getInvitationActivity(inv, usersByEmail) === "active").length;
  const pendingCount = invitations.filter((inv) => getInvitationActivity(inv, usersByEmail) === "pending").length;
  const inactiveCount = invitations.filter((inv) => getInvitationActivity(inv, usersByEmail) === "inactive").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Settings
        </button>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Everyone who's been invited, and where they stand</p>
          </div>
          {!loading && !error && invitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                {activeCount} active
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {pendingCount} pending
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                {inactiveCount} inactive
              </span>
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2.5">
            {invitations.map((inv) => {
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelected(inv)}
                  className="w-full flex items-center justify-between gap-4 border border-gray-100 dark:border-border bg-white dark:bg-card rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors text-left shadow-sm dark:shadow-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full font-semibold flex items-center justify-center text-sm bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/40">
                      {initials(inv.name || inv.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{inv.name || inv.email}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{inv.email}</p>
                    </div>
                  </div>
                  {/* Note: invite status is intentionally not shown in this list
                      row — open the invitation to see its status. */}
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.department_name && (
                      <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-gray-50 text-gray-600 dark:bg-secondary dark:text-gray-300 dark:border dark:border-border text-xs font-medium">
                        {inv.department_name}
                      </span>
                    )}
                    {inv.role_name && (
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-secondary dark:text-gray-300 dark:border dark:border-border text-xs font-medium">
                        {inv.role_name}
                      </span>
                    )}
                    <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
                  </div>
                </button>
              );
            })}
            {invitations.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-border rounded-xl px-4 py-6 text-center">
                No invitations sent yet.
              </p>
            )}
          </div>
        )}

        {selected && (
          <InvitationDetailDialog
            invitation={selected}
            activity={getInvitationActivity(selected, usersByEmail)}
            matchedUser={usersByEmail.get(selected.email.trim().toLowerCase()) ?? null}
            onClose={() => setSelected(null)}
            onRevoked={() => {
              setSelected(null);
              loadInvitations();
            }}
            onResent={loadInvitations}
            onEditUser={(matchedUser) => {
              setSelected(null);
              setEditingUser(matchedUser);
            }}
          />
        )}

        {editingUser && currentUser && (
          <EditUserDialog
            user={editingUser}
            currentUser={currentUser}
            onClose={() => setEditingUser(null)}
            onSaved={() => {
              setEditingUser(null);
              loadInvitations();
            }}
          />
        )}
      </div>
    </div>
  );
}

type InvitationActivity = "pending" | "active" | "inactive";

const ACTIVITY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // ~2 months

// Real-data activity check:
//   - Not yet accepted -> "pending" (nothing to measure login against yet).
//   - Accepted -> look up the matching User by email and use its actual
//     last_login timestamp. Logged in within the last 2 months -> "active",
//     otherwise (including never logged in) -> "inactive".
function getInvitationActivity(invitation: Invitation, usersByEmail: Map<string, User>): InvitationActivity {
  if (invitation.status !== "accepted") return "pending";

  const matchedUser = usersByEmail.get(invitation.email.trim().toLowerCase());
  if (!matchedUser || !matchedUser.last_login) return "inactive";

  const lastLoginMs = new Date(matchedUser.last_login).getTime();
  if (Number.isNaN(lastLoginMs)) return "inactive";

  return Date.now() - lastLoginMs <= ACTIVITY_WINDOW_MS ? "active" : "inactive";
}

const ACTIVITY_DISPLAY: Record<InvitationActivity, { label: string; dot: string; badge: string }> = {
  active: {
    label: "Active",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/50",
  },
  pending: {
    label: "Pending",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-gray-400 dark:bg-gray-500",
    badge: "bg-gray-100 text-gray-500 dark:bg-secondary dark:text-gray-400 dark:border dark:border-border",
  },
};

// ---------------------------------------------------------------------------
// INVITATION DETAIL DIALOG – FULLY EDITABLE (Updated)
// ---------------------------------------------------------------------------

function InvitationDetailDialog({
  invitation,
  activity,
  matchedUser,
  onClose,
  onRevoked,
  onResent,
  onEditUser,
}: {
  invitation: Invitation;
  activity: InvitationActivity;
  matchedUser: User | null;
  onClose: () => void;
  onRevoked: () => void;
  onResent: () => void;
  onEditUser: (user: User) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editable, setEditable] = useState({
    name: invitation.name ?? '',
    username: invitation.username ?? '',
    email: invitation.email ?? '',
    phone_number: invitation.phone_number ?? '',
    role_name: invitation.role_name ?? '',
    department_name: invitation.department_name ?? '',
  });
  const [original, setOriginal] = useState(editable);

  // Reset when invitation changes
  useEffect(() => {
    const newValues = {
      name: invitation.name ?? '',
      username: invitation.username ?? '',
      email: invitation.email ?? '',
      phone_number: invitation.phone_number ?? '',
      role_name: invitation.role_name ?? '',
      department_name: invitation.department_name ?? '',
    };
    setEditable(newValues);
    setOriginal(newValues);
    setIsEditing(false);
  }, [invitation]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const display = ACTIVITY_DISPLAY[activity];

  const canResend = invitation.status === "pending" || invitation.status === "expired";
  const canEditUser = invitation.status === "accepted" && matchedUser !== null;

  async function handleRevoke() {
    if (!window.confirm(`Revoke the invitation sent to ${invitation.email}?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await invitationsApi.remove(invitation.id);
      onRevoked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setSubmitting(true);
    setError(null);
    setResent(false);
    try {
      await invitationsApi.resend(invitation.id);
      setResent(true);
      onResent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setSubmitting(false);
    }
  }

  const handleEdit = () => {
    setIsEditing(true);
    setOriginal(editable);
    setError(null);
  };

  const handleCancel = () => {
    setEditable(original);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // ⚠️ Replace this with your actual update API call when available.
      // For example: await invitationsApi.update(invitation.id, {
      //   name: editable.name,
      //   username: editable.username,
      //   email: editable.email,
      //   phone_number: editable.phone_number,
      //   role: editable.role_name,
      //   department: editable.department_name,
      // });
      console.log("Saving invitation changes:", editable);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate
      setOriginal(editable);
      setIsEditing(false);
      // Optionally refresh parent list
      // onResent(); // or call a dedicated onUpdated callback
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Invitation Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Editable fields – all display actual values or empty strings */}
          <Field label="Full name">
            <TextInput
              value={editable.name}
              onChange={(e) => setEditable((f) => ({ ...f, name: e.target.value }))}
              disabled={!isEditing}
              placeholder="Full name"
            />
          </Field>
          <Field label="Username">
            <TextInput
              value={editable.username}
              onChange={(e) => setEditable((f) => ({ ...f, username: e.target.value }))}
              disabled={!isEditing}
              placeholder="Username"
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={editable.email}
              onChange={(e) => setEditable((f) => ({ ...f, email: e.target.value }))}
              disabled={!isEditing}
              placeholder="Email"
            />
          </Field>
          <Field label="Phone number">
            <TextInput
              value={editable.phone_number}
              onChange={(e) => setEditable((f) => ({ ...f, phone_number: e.target.value }))}
              disabled={!isEditing}
              placeholder="Phone number"
            />
          </Field>
          <Field label="Role">
            <TextInput
              value={editable.role_name}
              onChange={(e) => setEditable((f) => ({ ...f, role_name: e.target.value }))}
              disabled={!isEditing}
              placeholder="Role"
            />
          </Field>
          <Field label="Department">
            <TextInput
              value={editable.department_name}
              onChange={(e) => setEditable((f) => ({ ...f, department_name: e.target.value }))}
              disabled={!isEditing}
              placeholder="Department"
            />
          </Field>

          {/* Read-only fields – show '—' if missing */}
          <Field label="Organization">
            <TextInput value={invitation.company_name || "—"} disabled />
          </Field>
          <Field label="Invited by">
            <TextInput value={invitation.invited_by_name || "—"} disabled />
          </Field>
          <Field label="Expires">
            <TextInput
              value={
                invitation.expires_at
                  ? new Date(invitation.expires_at).toLocaleDateString()
                  : "—"
              }
              disabled
            />
          </Field>
          <Field label="Invite status">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${display.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${display.dot}`} />
              {display.label}
            </span>
          </Field>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
        {resent && !error && <p className="text-sm text-green-600 dark:text-green-400 mt-3">Invitation email resent.</p>}

        {invitation.status === "pending" && (
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 mt-3 flex items-start gap-3">
            <Mail size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                Invitation email dispatched to mailbox
              </p>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/70 mt-0.5">
                The recipient has been sent an activation email with their sign-up link. If they didn't receive it, click "Resend invite" below.
              </p>
            </div>
            {(invitation.accept_url || invitation.token) && (
              <button
                type="button"
                title="Copy backup link"
                onClick={() => {
                  const url = invitation.accept_url || (invitation.token ? `${window.location.origin}/accept-invite?token=${invitation.token}` : '');
                  if (url) {
                    navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2500);
                  }
                }}
                className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1 bg-white dark:bg-card"
              >
                {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                {linkCopied ? "Copied" : "Copy backup link"}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-border">
          {/* Top row: invitation-level actions (unchanged) */}
          <div className="flex flex-wrap items-center gap-3">
            {invitation.status === "pending" && (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={16} />
                {submitting ? "Revoking…" : "Revoke invitation"}
              </button>
            )}
            {canResend && (
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Resending…" : "Resend invite"}
              </button>
            )}
            {canEditUser && (
              <button
                type="button"
                onClick={() => onEditUser(matchedUser as User)}
                disabled={submitting}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                Edit user
              </button>
            )}
          </div>

          {/* Bottom row: edit-mode controls (Edit, or Cancel / Save changes) + Close */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={submitting}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    className="text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={submitting}
                    className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Saving…" : "Save changes"}
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General Settings — Organizations (unchanged)
// ---------------------------------------------------------------------------

const EMPTY_COMPANY_FORM = {
  companyName: "",
  state: "",
  pinCode: "",
  zone: "",
  region: "",
  country: "",
  subDomain: "",
};

type GSScreen =
  | { name: "list" }
  | { name: "orgWizard" }
  | { name: "orgForm"; id: number }
  | { name: "orgDetail"; id: number }
  | { name: "companyForm"; organizationId: number; id: number | null }
  | { name: "entityForm"; organizationId: number; id: number | null };

function GeneralSettingsApp({ onExit }: { onExit: () => void }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [screen, setScreen] = useState<GSScreen>({ name: "list" });

  async function reloadOrganizations() {
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const data = await organizationApi.list();
      setOrganizations(data);
    } catch (err) {
      setOrgsError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setOrgsLoading(false);
    }
  }

  useEffect(() => {
    reloadOrganizations();
  }, []);

  async function deleteOrganization(org: Organization): Promise<boolean> {
    const label = org.name.trim() || "this organization";
    const childCount = org.company_count + org.entity_count;
    if (
      childCount > 0 &&
      !window.confirm(
        `Delete ${label}? This will also delete its ${childCount} associated ${pluralize(
          childCount,
          "company or entity record",
          "company and entity records"
        )}.`
      )
    ) {
      return false;
    }
    await organizationApi.remove(org.id);
    await reloadOrganizations();
    return true;
  }

  function goBack() {
    switch (screen.name) {
      case "list":
        onExit();
        return;
      case "orgWizard":
        setScreen({ name: "list" });
        return;
      case "orgForm":
        setScreen({ name: "orgDetail", id: screen.id });
        return;
      case "orgDetail":
        setScreen({ name: "list" });
        return;
      case "companyForm":
      case "entityForm":
        setScreen({ name: "orgDetail", id: screen.organizationId });
        return;
    }
  }

  const backLabel =
    screen.name === "list"
      ? "Back to Settings"
      : screen.name === "orgWizard"
      ? "Back to Organizations"
      : screen.name === "orgDetail"
      ? "Back to Organizations"
      : screen.name === "orgForm"
      ? "Back to Organization"
      : "Back to Organization";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>

        {screen.name === "list" && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">General Settings</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your organizations</p>
            </div>

            {orgsLoading && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>}
            {orgsError && <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{orgsError}</p>}

            {!orgsLoading && !orgsError && (
              <RecordSection
                icon={Building2}
                title="Organizations"
                addLabel="Add organization"
                onAdd={() => setScreen({ name: "orgWizard" })}
                onSelect={(id) => setScreen({ name: "orgDetail", id })}
                emptyLabel="No organizations yet"
                items={organizations.map((o) => ({
                  id: o.id,
                  title: o.name.trim() || "Untitled organization",
                  subtitle: o.address.trim() || "No address yet",
                  logo: o.logo ?? undefined,
                }))}
              />
            )}
          </>
        )}

        {screen.name === "orgWizard" && (
          <OrganizationWizardScreen
            onCancel={() => setScreen({ name: "list" })}
            onComplete={async (org) => {
              await reloadOrganizations();
              setScreen({ name: "orgDetail", id: org.id });
            }}
          />
        )}

        {screen.name === "orgForm" &&
          (() => {
            const org = organizations.find((o) => o.id === screen.id);
            if (!org) {
              return (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This organization no longer exists.</p>
                  <button
                    type="button"
                    onClick={() => setScreen({ name: "list" })}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Back to organizations
                  </button>
                </div>
              );
            }
            return (
              <OrganizationFormScreen
                record={org}
                onCancel={() => setScreen({ name: "orgDetail", id: org.id })}
                onSaved={async () => {
                  await reloadOrganizations();
                  setScreen({ name: "orgDetail", id: org.id });
                }}
                onDeleted={async () => {
                  if (await deleteOrganization(org)) {
                    setScreen({ name: "list" });
                  }
                }}
              />
            );
          })()}

        {screen.name === "orgDetail" &&
          (() => {
            const org = organizations.find((o) => o.id === screen.id);
            if (!org) {
              return (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This organization no longer exists.</p>
                  <button
                    type="button"
                    onClick={() => setScreen({ name: "list" })}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Back to organizations
                  </button>
                </div>
              );
            }
            return (
              <OrgDetailContainer
                organization={org}
                onEditOrganization={() => setScreen({ name: "orgForm", id: org.id })}
                onGoToCompanyForm={(id) => setScreen({ name: "companyForm", organizationId: org.id, id })}
                onGoToEntityForm={(id) => setScreen({ name: "entityForm", organizationId: org.id, id })}
              />
            );
          })()}

        {screen.name === "companyForm" && (
          <CompanyFormScreen
            organizationId={screen.organizationId}
            recordId={screen.id}
            onCancel={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
            onSaved={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
            onDeleted={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
          />
        )}

        {screen.name === "entityForm" && (
          <EntityFormScreen
            organizationId={screen.organizationId}
            recordId={screen.id}
            onCancel={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
            onSaved={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
            onDeleted={() => setScreen({ name: "orgDetail", id: screen.organizationId })}
          />
        )}
      </div>
    </div>
  );
}

function OrgDetailContainer({
  organization,
  onEditOrganization,
  onGoToCompanyForm,
  onGoToEntityForm,
}: {
  organization: Organization;
  onEditOrganization: () => void;
  onGoToCompanyForm: (id: number | null) => void;
  onGoToEntityForm: (id: number | null) => void;
}) {
  const [companies, setCompanies] = useState<OrganizationCompany[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([companyApi.list(organization.id), entityApi.list(organization.id)])
      .then(([c, e]) => {
        if (cancelled) return;
        setCompanies(c);
        setEntities(e);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load organization details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization.id]);

  if (loading) return <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;

  return (
    <OrganizationDetailScreen
      organization={organization}
      companies={companies}
      entities={entities}
      onEditOrganization={onEditOrganization}
      onAddCompany={() => onGoToCompanyForm(null)}
      onSelectCompany={(id) => onGoToCompanyForm(id)}
      onAddEntity={() => onGoToEntityForm(null)}
      onSelectEntity={(id) => onGoToEntityForm(id)}
    />
  );
}

function OrganizationDetailScreen({
  organization,
  companies,
  entities,
  onEditOrganization,
  onAddCompany,
  onSelectCompany,
  onAddEntity,
  onSelectEntity,
}: {
  organization: Organization;
  companies: OrganizationCompany[];
  entities: Entity[];
  onEditOrganization: () => void;
  onAddCompany: () => void;
  onSelectCompany: (id: number) => void;
  onAddEntity: () => void;
  onSelectEntity: (id: number) => void;
}) {
  const isEmpty = companies.length === 0 && entities.length === 0;
  const orgLabel = organization.name.trim() || "this organization";

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {organization.logo ? (
            <img
              src={organization.logo}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-border"
            />
          ) : (
            <span className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-secondary flex items-center justify-center">
              <Building2 size={22} className="text-gray-400 dark:text-gray-500" />
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {organization.name.trim() || "Untitled organization"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {organization.address.trim() || "No address yet"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEditOrganization}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 shrink-0 transition-colors"
        >
          Edit
        </button>
      </div>

      {isEmpty && (
        <div className="mb-6 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          No companies or entities yet. Anything you add below belongs to{" "}
          <span className="font-semibold">{orgLabel}</span> — use "Add company" or "Add entity" to
          get started.
        </div>
      )}

      <RecordSection
        icon={Landmark}
        title="Companies"
        addLabel="Add company"
        onAdd={onAddCompany}
        onSelect={onSelectCompany}
        emptyLabel="No companies yet"
        items={companies.map((c) => ({
          id: c.id,
          title: (c.company_name ?? '').trim() || "Untitled company",
          subtitle: [c.sub_domain, c.country].filter((v) => v?.trim()).join(" · ") || "No details yet",
        }))}
      />

      <RecordSection
        icon={Network}
        title="Entities"
        addLabel="Add entity"
        onAdd={onAddEntity}
        onSelect={onSelectEntity}
        emptyLabel="No entities yet"
        items={entities.map((e) => ({
          id: e.id,
          title: e.entity_name?.trim()
          || "Untitled entity",
          subtitle: [e.region, e.zone].filter((v) => v.trim()).join(" · ") || "No details yet",
        }))}
      />
    </div>
  );
}

interface RecordSectionItem {
  id: number;
  title: string;
  subtitle: string;
  logo?: string;
}

function RecordSection({
  icon: Icon,
  title,
  addLabel,
  onAdd,
  items,
  onSelect,
  emptyLabel,
}: {
  icon: typeof Building2;
  title: string;
  addLabel: string;
  onAdd: () => void;
  items: RecordSectionItem[];
  onSelect: (id: number) => void;
  emptyLabel: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{items.length}</span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <Plus size={16} />
          {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-border rounded-xl px-4 py-6 text-center">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="w-full flex items-center justify-between border border-gray-100 dark:border-border bg-white dark:bg-card rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-3 text-left">
                {item.logo ? (
                  <img
                    src={resolveImageUrl(item.logo) ?? item.logo}
                    alt=""
                    className="w-9 h-9 rounded-lg object-contain p-0.5 border border-gray-200 dark:border-border bg-white"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-secondary flex items-center justify-center">
                    <Icon size={16} className="text-gray-400 dark:text-gray-500" />
                  </span>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.title}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormScreenShell({
  title,
  onCancel,
  onDelete,
  onSubmit,
  submitting,
  submitLabel = "Save",
  children,
}: {
  title: string;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 space-y-3 shadow-sm dark:shadow-none">{children}</div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function OrganizationFormScreen({
  record,
  onCancel,
  onSaved,
  onDeleted,
}: {
  record: Organization;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(record.name);
  const [address, setAddress] = useState(record.address);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(record.logo);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Please fill in the organization name and address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: OrganizationPayload = { name, address, logo: logoFile };
      await organizationApi.update(record.id, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save organization");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreenShell
      title="Edit Organization"
      onCancel={onCancel}
      onDelete={onDeleted}
      onSubmit={handleSubmit}
      submitting={submitting}
    >
      <Field label="Organization name">
        <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" />
      </Field>
      <Field label="Logo">
        <div className="flex items-center gap-3">
          {logoPreview && (
            <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-border" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-secondary file:text-gray-700 dark:file:text-gray-200 file:text-sm file:font-medium hover:file:bg-gray-200 dark:hover:file:bg-muted transition-colors"
          />
        </div>
      </Field>
      <Field label="Address">
        <textarea
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
          placeholder="Street, city, state, ZIP"
        />
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </FormScreenShell>
  );
}

function CompanyFormScreen({
  organizationId,
  recordId,
  onCancel,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  recordId: number | null;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEditing = recordId !== null;
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditing || recordId === null) return;
    let cancelled = false;
    companyApi
      .list(organizationId)
      .then((companies) => {
        if (cancelled) return;
        const record = companies.find((c) => c.id === recordId);
        if (record) {
          setForm({
            companyName: record.company_name,
            state: record.state,
            pinCode: record.pin_code,
            zone: record.zone,
            region: record.region,
            country: record.country,
            subDomain: record.sub_domain,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load company");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing, organizationId, recordId]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.companyName.trim() ||
      !form.state.trim() ||
      !form.pinCode.trim() ||
      !form.zone.trim() ||
      !form.region.trim() ||
      !form.country.trim() ||
      !form.subDomain.trim()
    ) {
      setError("Please fill in all company fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const payload: OrganizationCompanyPayload = {
      organization: organizationId,
      company_name: form.companyName,
      state: form.state,
      pin_code: form.pinCode,
      zone: form.zone,
      region: form.region,
      country: form.country,
      sub_domain: form.subDomain,
    };
    try {
      if (isEditing && recordId !== null) {
        await companyApi.update(recordId, payload);
      } else {
        await companyApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (recordId === null) return;
    setSubmitting(true);
    try {
      await companyApi.remove(recordId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete company");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>;
  }

  return (
    <FormScreenShell
      title={isEditing ? "Edit Company" : "Add Company"}
      onCancel={onCancel}
      onDelete={isEditing ? handleDelete : undefined}
      onSubmit={handleSubmit}
      submitting={submitting}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company name">
          <TextInput required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
        </Field>
        <Field label="Sub domain">
          <TextInput
            required
            value={form.subDomain}
            onChange={(e) => update("subDomain", e.target.value)}
            placeholder="e.g. acme"
          />
        </Field>
        <Field label="Country">
          <TextInput required value={form.country} onChange={(e) => update("country", e.target.value)} />
        </Field>
        <Field label="State">
          <TextInput required value={form.state} onChange={(e) => update("state", e.target.value)} />
        </Field>
        <Field label="Pin code">
          <TextInput required value={form.pinCode} onChange={(e) => update("pinCode", e.target.value)} />
        </Field>
        <Field label="Zone">
          <TextInput required value={form.zone} onChange={(e) => update("zone", e.target.value)} />
        </Field>
        <Field label="Region">
          <TextInput required value={form.region} onChange={(e) => update("region", e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </FormScreenShell>
  );
}

function EntityFormScreen({
  organizationId,
  recordId,
  onCancel,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  recordId: number | null;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEditing = recordId !== null;
  const [entityName, setEntityName] = useState("");
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditing || recordId === null) return;
    let cancelled = false;
    entityApi
      .list(organizationId)
      .then((entities) => {
        if (cancelled) return;
        const record = entities.find((e) => e.id === recordId);
        if (record) {
          setEntityName(record.entity_name);
          setState(record.state);
          setRegion(record.region);
          setZone(record.zone);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load entity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing, organizationId, recordId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName.trim() || !state.trim() || !region.trim() || !zone.trim()) {
      setError("Please fill in all entity fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const payload: EntityPayload = {
      organization: organizationId,
      entity_name: entityName,
      state,
      region,
      zone,
    };
    try {
      if (isEditing && recordId !== null) {
        await entityApi.update(recordId, payload);
      } else {
        await entityApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entity");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (recordId === null) return;
    setSubmitting(true);
    try {
      await entityApi.remove(recordId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entity");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>;
  }

  return (
    <FormScreenShell
      title={isEditing ? "Edit Entity" : "Add Entity"}
      onCancel={onCancel}
      onDelete={isEditing ? handleDelete : undefined}
      onSubmit={handleSubmit}
      submitting={submitting}
    >
      <Field label="Entity name">
        <TextInput required value={entityName} onChange={(e) => setEntityName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State">
          <TextInput required value={state} onChange={(e) => setState(e.target.value)} />
        </Field>
        <Field label="Region">
          <TextInput required value={region} onChange={(e) => setRegion(e.target.value)} />
        </Field>
        <Field label="Zone">
          <TextInput required value={zone} onChange={(e) => setZone(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </FormScreenShell>
  );
}

const WIZARD_STEPS = [
  { label: "Organization", icon: Building2 },
  { label: "Company", icon: Landmark },
  { label: "Entity", icon: Network },
] as const;

function OrganizationWizardScreen({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: (org: Organization) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [savedOrg, setSavedOrg] = useState<Organization | null>(null);

  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [savedCompany, setSavedCompany] = useState<OrganizationCompany | null>(null);

  const [entityName, setEntityName] = useState("");
  const [entityState, setEntityState] = useState("");
  const [entityRegion, setEntityRegion] = useState("");
  const [entityZone, setEntityZone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateCompanyField<K extends keyof typeof companyForm>(key: K, value: (typeof companyForm)[K]) {
    setCompanyForm((f) => ({ ...f, [key]: value }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOrgLogoFile(file);
    setOrgLogoPreview(URL.createObjectURL(file));
  }

  async function saveOrganizationStep() {
    if (!orgName.trim() || !orgAddress.trim()) {
      setError("Please fill in the organization name and address.");
      return false;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: OrganizationPayload = { name: orgName, address: orgAddress, logo: orgLogoFile };
      const result = savedOrg ? await organizationApi.update(savedOrg.id, payload) : await organizationApi.create(payload);
      setSavedOrg(result);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save organization");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCompanyStep() {
    if (!savedOrg) {
      setError("Organization must be saved first.");
      return false;
    }
    if (
      !companyForm.companyName.trim() ||
      !companyForm.state.trim() ||
      !companyForm.pinCode.trim() ||
      !companyForm.zone.trim() ||
      !companyForm.region.trim() ||
      !companyForm.country.trim() ||
      !companyForm.subDomain.trim()
    ) {
      setError("Please fill in all company fields.");
      return false;
    }
    setError(null);
    setSubmitting(true);
    const payload: OrganizationCompanyPayload = {
      organization: savedOrg.id,
      company_name: companyForm.companyName,
      state: companyForm.state,
      pin_code: companyForm.pinCode,
      zone: companyForm.zone,
      region: companyForm.region,
      country: companyForm.country,
      sub_domain: companyForm.subDomain,
    };
    try {
      const result = savedCompany ? await companyApi.update(savedCompany.id, payload) : await companyApi.create(payload);
      setSavedCompany(result);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEntityStep() {
    if (!savedOrg) {
      setError("Organization must be saved first.");
      return false;
    }
    if (!entityName.trim() || !entityState.trim() || !entityRegion.trim() || !entityZone.trim()) {
      setError("Please fill in all entity fields.");
      return false;
    }
    setError(null);
    setSubmitting(true);
    const payload: EntityPayload = {
      organization: savedOrg.id,
      entity_name: entityName,
      state: entityState,
      region: entityRegion,
      zone: entityZone,
    };
    try {
      await entityApi.create(payload);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entity");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (await saveOrganizationStep()) setStep(2);
      return;
    }
    if (step === 2) {
      if (await saveCompanyStep()) setStep(3);
      return;
    }
    if (await saveEntityStep()) {
      onComplete(savedOrg as Organization);
    }
  }

  function handleBackClick() {
    setError(null);
    if (step === 1) {
      onCancel();
      return;
    }
    setStep((s) => (s === 3 ? 2 : 1));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        {WIZARD_STEPS.map((s, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isDone = n < step;
          return (
            <div key={s.label} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-2 flex-1 rounded-xl px-3 py-2 border transition-colors ${
                  isActive
                    ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/50"
                    : isDone
                    ? "border-green-200 bg-green-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                    : "border-gray-100 bg-gray-50 dark:border-border dark:bg-secondary/40"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isDone
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-muted text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {n}
                </span>
                <span
                  className={`text-sm font-medium truncate ${
                    isActive
                      ? "text-blue-700 dark:text-blue-300"
                      : isDone
                      ? "text-green-700 dark:text-emerald-300"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 && <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleFormSubmit}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {step === 1 ? "New Organization" : step === 2 ? "Company Setup" : "Entity Setup"}
        </h1>

        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-6 space-y-3 shadow-sm dark:shadow-none">
          {step === 1 && (
            <>
              <Field label="Organization name">
                <TextInput required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Acme Corp" />
              </Field>
              <Field label="Logo">
                <div className="flex items-center gap-3">
                  {orgLogoPreview && (
                    <img src={orgLogoPreview} alt="Logo preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-border" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-secondary file:text-gray-700 dark:file:text-gray-200 file:text-sm file:font-medium hover:file:bg-gray-200 dark:hover:file:bg-muted transition-colors"
                  />
                </div>
              </Field>
              <Field label="Address">
                <textarea
                  required
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-secondary/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="Street, city, state, ZIP"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company name">
                <TextInput required value={companyForm.companyName} onChange={(e) => updateCompanyField("companyName", e.target.value)} />
              </Field>
              <Field label="Sub domain">
                <TextInput
                  required
                  value={companyForm.subDomain}
                  onChange={(e) => updateCompanyField("subDomain", e.target.value)}
                  placeholder="e.g. acme"
                />
              </Field>
              <Field label="Country">
                <TextInput required value={companyForm.country} onChange={(e) => updateCompanyField("country", e.target.value)} />
              </Field>
              <Field label="State">
                <TextInput required value={companyForm.state} onChange={(e) => updateCompanyField("state", e.target.value)} />
              </Field>
              <Field label="Pin code">
                <TextInput required value={companyForm.pinCode} onChange={(e) => updateCompanyField("pinCode", e.target.value)} />
              </Field>
              <Field label="Zone">
                <TextInput required value={companyForm.zone} onChange={(e) => updateCompanyField("zone", e.target.value)} />
              </Field>
              <Field label="Region">
                <TextInput required value={companyForm.region} onChange={(e) => updateCompanyField("region", e.target.value)} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <>
              <Field label="Entity name">
                <TextInput required value={entityName} onChange={(e) => setEntityName(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <TextInput required value={entityState} onChange={(e) => setEntityState(e.target.value)} />
                </Field>
                <Field label="Region">
                  <TextInput required value={entityRegion} onChange={(e) => setEntityRegion(e.target.value)} />
                </Field>
                <Field label="Zone">
                  <TextInput required value={entityZone} onChange={(e) => setEntityZone(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={handleBackClick}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-secondary border border-transparent dark:border-border disabled:opacity-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? "Saving…" : step === 3 ? "Submit" : "Next"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Admin;