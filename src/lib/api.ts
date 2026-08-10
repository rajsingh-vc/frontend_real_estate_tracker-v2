import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/contexts/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      setTokens(data.access, data.refresh);
      return data.access as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(pathOrUrl: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE_URL}${pathOrUrl}`;
  const token = getAccessToken();

  const headers: HeadersInit = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return request<T>(pathOrUrl, options, true);
    }
    clearTokens();
    window.location.href = "/login";
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message =
      body?.detail ||
      (body && typeof body === "object" ? Object.values(body).flat().join(" ") : undefined) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export const apiGet = <T,>(path: string) => request<T>(path);
export const apiPost = <T,>(path: string, data?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
  });
export const apiPatch = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined });
export const apiDelete = (path: string) => request<void>(path, { method: "DELETE" });

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function apiList<T>(path: string): Promise<T[]> {
  const data = await request<T[] | Paginated<T>>(path);
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

// ---- Types ----

export interface ApiUser {
  id: number;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  email: string;
  username: string;
}

export interface User extends ApiUser {
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  activity_status: "Active" | "Inactive";
  company: number | null;
  company_name?: string;
  // Real, permission-driven flags from the backend (see accounts.UserSerializer) —
  // use these instead of string-matching `role` to decide what a user can do.
  can_manage_users: boolean;
  can_manage_roles: boolean;
  can_manage_departments: boolean;
  can_manage_organization: boolean;
}

export interface Company {
  id: number;
  name: string;
  subdomain: string;
  is_active: boolean;
}

export interface ApiProject {
  id: number;
  name: string;
  location: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  totalUnits: number;
  reraNumber: string;
  developer: string;
  budget: number;
  spent: number;
  organizationId: number | null;
  companyId: number | null;
  entityId: number | null;
  organizationName?: string;
  companyName?: string;
  entityName?: string | null;
  // ✅ NEW — drives which flow the UI shows for this project
  hierarchyMode: "full" | "direct_task"; // "full" = Tower→Floor→Unit→Task, "direct_task" = Task directly under Project
  // ✅ NEW — ISO datetime strings from the backend (auto_now_add / auto_now)
  createdAt: string;
  updatedAt: string;
}

export interface ApiTower {
  id: number;
  name: string;
  projectId: number;
  totalFloors: number;
  progress: number;
  status: string;
}

export interface ApiFloor {
  id: number;
  name: string;
  number: number;
  towerId: number;
  projectId: number;
  status?: string;
  progress?: number;
  floorNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiUnit {
  id: number;
  unitNumber: string;
  floorId: number;
  towerId: number;
  projectId: number;
  type: string;
  status: string;
  areaSqFt: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiChecklist {
  id: number;
  name: string;
  taskId: number;
  unitId: number;
  floorId: number;
  towerId: number;
  projectId: number;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSubTask {
  id: number;
  name: string;
  checklistId: number;
  taskId: number;
  unitId: number;
  floorId: number;
  towerId: number;
  projectId: number;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiChecklistItem {
  id: number;
  title: string;
  completed: boolean;
}

export interface ApiComment {
  id: number;
  user: string;
  text: string;
  date: string;
}

export interface ApiTask {
  id: number;
  title: string;
  description: string;
  department: string;
  assignedHod: number | null;
  assignedUsers: number[];
  assignedTo: number | null;
  startDate: string | null;
  endDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  priority: string;
  status: string;
  dependencies: number[];
  dependsOn: number | null;
  isRepetitive: boolean;
  repeatFrequency: "daily" | "weekly" | "monthly" | null;
  isSelfTask: boolean;
  checklist: ApiChecklistItem[];
  progress: number;
  delayDays: number;
  delayReason: string;
  criticalPath: boolean;
  projectId: number;
  towerId: number | null;
  floorId: number | null;
  unitId: number | null;
  phase: string;
  comments: ApiComment[];
  organizationId?: number | null;
  organizationName?: string | null;
  companyId?: number | null;
  companyName?: string | null;
  entityId?: number | null;
  entityName?: string | null;
  // ✅ NEW — ISO datetime strings from the backend (auto_now_add / auto_now)
  createdAt: string;
  updatedAt: string;
}

export interface ApiChecklistTemplate {
  id: number;
  name: string;
  category: string;
  items: string[];
  projectId?: number | null;
  projectName?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  subCategoryId?: number | null;
  subCategoryName?: string | null;
}

export interface ApiHurdle {
  id: number;
  title: string;
  description: string;
  type: string;
  affectedTaskId: number | null;
  affectedTower: string;
  responsibleDepartment: string;
  impactDays: number;
  severity: string;
  status: string;
  resolutionNotes: string;
  projectId: number;
  reportedDate: string;
  resolvedDate: string | null;
}

export interface HurdlePayload {
  title: string;
  description?: string;
  type: string;
  affectedTaskId?: number | null;
  affectedTower?: string;
  responsibleDepartment: string;
  impactDays?: number;
  severity?: string;
  status?: string;
  resolutionNotes?: string;
  projectId: number;
  resolvedDate?: string | null;
}

export interface NewTaskPayload {
  title: string;
  description?: string;
  department: string;
  assignedHod?: number | null;
  assignedUsers?: number[];
  assignedTo?: number | null;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  projectId: number;
  towerId?: number | null;
  floorId?: number | null;
  unitId?: number | null;
  phase?: string;
  checklistTemplateId?: number;
  dependsOn?: number | null;
  isRepetitive?: boolean;
  repeatFrequency?: "daily" | "weekly" | "monthly" | null;
  isSelfTask?: boolean;
}

export interface ProjectPayload {
  name: string;
  location: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  totalUnits?: number;
  reraNumber?: string;
  budget?: number;
  spent?: number;
  organizationId: number;
  companyId: number;
  entityId?: number | null;
  // ✅ NEW — defaults server-side to "full"
  hierarchyMode?: "full" | "direct_task";
}

export interface TowerPayload {
  name: string;
  projectId: number;
  totalFloors?: number;
  status?: string;
  progress?: number;
}

export interface FloorPayload {
  name: string;
  number: number;
  towerId: number;
  projectId: number;
  status?: string;
  progress?: number;
}

export interface UnitPayload {
  unitNumber: string;
  floorId: number;
  towerId: number;
  projectId: number;
  type?: string;
  status?: string;
  areaSqFt?: number;
  progress?: number;
}

export interface ChecklistPayload {
  name: string;
  taskId: number;
  unitId: number;
  floorId: number;
  towerId: number;
  projectId: number;
  status?: string;
  progress?: number;
}

export interface SubTaskPayload {
  name: string;
  checklistId: number;
  taskId: number;
  unitId: number;
  floorId: number;
  towerId: number;
  projectId: number;
  status?: string;
  progress?: number;
}

export interface UserPayload {
  username: string;
  password: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  avatar?: string;
  company?: number | null;
}

export interface UserUpdatePayload {
  name?: string;
  username?: string;
  email?: string;
  is_active?: boolean;
  role?: string;
  department?: string;
  company?: number | null;
}

export interface ApiEscalationRule {
  id: number;
  level: number;
  role: string;
  days: number;
  description: string;
}

export interface EscalationRulePayload {
  level: number;
  role: string;
  days: number;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  company: number | null;
}

export interface Department {
  id: number;
  name: string;
  company: number;
}

export interface Invitation {
  id: number;
  email: string;
  phone_number: string;
  name: string;
  username: string;
  company: number;
  company_name: string;
  role_name: string | null;
  department_name: string | null;
  invited_by: number;
  invited_by_name: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

export interface InvitationPayload {
  email: string;
  phone_number?: string;
  name?: string;
  username?: string;
  company: number;
  role?: string;
  department?: string;
}

// ---- Wire-shape normalizers ----
export function normalizeUser(raw: any): User {
  return {
    id: raw.id,
    name: raw.name ?? "",
    role: raw.role ?? "",
    department: raw.department ?? "",
    avatar: raw.avatar,
    email: raw.email ?? "",
    username: raw.username ?? "",
    is_active: raw.is_active ?? raw.isActive ?? false,
    is_superuser: raw.is_superuser ?? raw.isSuperuser ?? false,
    last_login: raw.last_login ?? raw.lastLogin ?? null,
    activity_status: raw.activity_status ?? raw.activityStatus ?? ((raw.isActive ?? raw.is_active) ? "Active" : "Inactive"),
    company: raw.company ?? null,
    company_name: raw.company_name ?? raw.companyName ?? undefined,
    can_manage_users: raw.can_manage_users ?? raw.canManageUsers ?? (raw.is_superuser ?? raw.isSuperuser ?? false),
    can_manage_roles: raw.can_manage_roles ?? raw.canManageRoles ?? (raw.is_superuser ?? raw.isSuperuser ?? false),
    can_manage_departments: raw.can_manage_departments ?? raw.canManageDepartments ?? (raw.is_superuser ?? raw.isSuperuser ?? false),
    can_manage_organization: raw.can_manage_organization ?? raw.canManageOrganization ?? (raw.is_superuser ?? raw.isSuperuser ?? false),
  };
}

function normalizeRole(raw: any): Role {
  return {
    id: raw.id,
    name: raw.name ?? "",
    company: raw.company ?? null,
  };
}

function normalizeDepartment(raw: any): Department {
  return {
    id: raw.id,
    name: raw.name ?? "",
    company: raw.company,
  };
}

function normalizeInvitation(raw: any): Invitation {
  return {
    id: raw.id,
    email: raw.email ?? "",
    phone_number: raw.phone_number ?? raw.phoneNumber ?? "",
    name: raw.name ?? "",
    username: raw.username ?? "",
    company: raw.company,
    company_name: raw.company_name ?? raw.companyName ?? "",
    role_name: raw.role_name ?? raw.roleName ?? "",
    department_name: raw.department_name ?? raw.departmentName ?? "",
    invited_by: raw.invited_by ?? raw.invitedBy,
    invited_by_name: raw.invited_by_name ?? raw.invitedByName ?? "",
    status: raw.status,
    created_at: raw.created_at ?? raw.createdAt,
    expires_at: raw.expires_at ?? raw.expiresAt,
  };
}

function normalizeOrganization(raw: any): Organization {
  return {
    id: raw.id,
    name: raw.name ?? "",
    logo: raw.logo ?? null,
    address: raw.address ?? "",
    company_count: raw.company_count ?? raw.companyCount ?? 0,
    entity_count: raw.entity_count ?? raw.entityCount ?? 0,
  };
}

// Guards ApiTask consumers (Dashboard, task detail views, CSV export, etc.)
// against a backend response that omits or nulls array fields — e.g. a task
// with no checklist template applied, or no comments yet. Without this,
// `task.checklist.length` / `task.comments.map(...)` throws and — since
// there's no error boundary — takes down the whole page.
function normalizeTask(raw: any): ApiTask {
  return {
    ...raw,
    checklist: raw.checklist ?? [],
    comments: raw.comments ?? [],
    dependencies: raw.dependencies ?? [],
    assignedUsers: raw.assignedUsers ?? [],
  };
}

// ---- API Services ----

export const usersApi = {
  list: async () => (await apiList<any>("/users/")).map(normalizeUser),
  create: async (payload: UserPayload) => normalizeUser(await apiPost<any>("/users/", payload)),
  update: async (id: number, data: UserUpdatePayload) => normalizeUser(await apiPatch<any>(`/users/${id}/`, data)),
};

export const companiesApi = {
  list: () => apiList<Company>("/companies/"),
  create: (data: { name: string; subdomain: string }) =>
    apiPost<Company>("/companies/", data),
  update: (id: number, data: Partial<{ name: string; subdomain: string; is_active: boolean }>) =>
    apiPatch<Company>(`/companies/${id}/`, data),
};

export const escalationRulesApi = {
  list: () => apiList<ApiEscalationRule>("/escalation-rules/"),
  create: (data: EscalationRulePayload) => apiPost<ApiEscalationRule>("/escalation-rules/", data),
  update: (id: number, data: Partial<EscalationRulePayload>) =>
    apiPatch<ApiEscalationRule>(`/escalation-rules/${id}/`, data),
  remove: (id: number) => apiDelete(`/escalation-rules/${id}/`),
};

export const projectsApi = {
  list: () => apiList<ApiProject>("/projects/"),
  create: (data: ProjectPayload) => apiPost<ApiProject>("/projects/", data),
  update: (id: number, data: Partial<ProjectPayload>) => apiPatch<ApiProject>(`/projects/${id}/`, data),
  remove: (id: number) => apiDelete(`/projects/${id}/`),
};

export const towersApi = {
  list: () => apiList<ApiTower>("/towers/"),
  getByProject: (projectId: number) => apiList<ApiTower>(`/projects/${projectId}/towers/`),
  create: (data: TowerPayload) => apiPost<ApiTower>("/towers/", data),
  update: (id: number, data: Partial<TowerPayload>) => apiPatch<ApiTower>(`/towers/${id}/`, data),
  remove: (id: number) => apiDelete(`/towers/${id}/`),
};

export const floorsApi = {
  list: () => apiList<ApiFloor>("/floors/"),
  getByTower: (towerId: number) => apiList<ApiFloor>(`/towers/${towerId}/floors/`),
  create: (data: FloorPayload) => apiPost<ApiFloor>("/floors/", data),
  update: (id: number, data: Partial<FloorPayload>) => apiPatch<ApiFloor>(`/floors/${id}/`, data),
  remove: (id: number) => apiDelete(`/floors/${id}/`),
};

export const unitsApi = {
  list: () => apiList<ApiUnit>("/units/"),
  getByFloor: (floorId: number) => apiList<ApiUnit>(`/floors/${floorId}/units/`),
  create: (data: UnitPayload) => apiPost<ApiUnit>("/units/", data),
  update: (id: number, data: Partial<UnitPayload>) => apiPatch<ApiUnit>(`/units/${id}/`, data),
  remove: (id: number) => apiDelete(`/units/${id}/`),
};

export const checklistsApi = {
  list: () => apiList<ApiChecklist>("/checklists/"),
  getByTask: (taskId: number) => apiList<ApiChecklist>(`/tasks/${taskId}/checklists/`),
  create: (data: ChecklistPayload) => apiPost<ApiChecklist>("/checklists/", data),
  update: (id: number, data: Partial<ChecklistPayload>) => apiPatch<ApiChecklist>(`/checklists/${id}/`, data),
  remove: (id: number) => apiDelete(`/checklists/${id}/`),
};

export const subTasksApi = {
  list: () => apiList<ApiSubTask>("/subtasks/"),
  getByChecklist: (checklistId: number) => apiList<ApiSubTask>(`/checklists/${checklistId}/subtasks/`),
  create: (data: SubTaskPayload) => apiPost<ApiSubTask>("/subtasks/", data),
  update: (id: number, data: Partial<SubTaskPayload>) => apiPatch<ApiSubTask>(`/subtasks/${id}/`, data),
  remove: (id: number) => apiDelete(`/subtasks/${id}/`),
};

export interface ChecklistTemplatePayload {
  name: string;
  category: string;
  items: string[];
  projectId?: number | null;
  categoryId?: number | null;
  subCategoryId?: number | null;
}

export const checklistTemplatesApi = {
  list: () => apiList<ApiChecklistTemplate>("/checklist-templates/"),
  create: (data: ChecklistTemplatePayload) => apiPost<ApiChecklistTemplate>("/checklist-templates/", data),
  update: (id: number, data: Partial<ChecklistTemplatePayload>) =>
    apiPatch<ApiChecklistTemplate>(`/checklist-templates/${id}/`, data),
  remove: (id: number) => apiDelete(`/checklist-templates/${id}/`),
};

export interface ApiResourceMachine {
  id: number;
  name: string;
  qty: number;
}

export interface ApiResourceMaterial {
  id: number;
  name: string;
  qty: number;
  unit: string;
}

export interface ApiResource {
  id: number;
  taskId: number;
  labour: number;
  machines: ApiResourceMachine[];
  materials: ApiResourceMaterial[];
  vendor: string;
}

export interface ResourcePayload {
  taskId: number;
  labour: number;
  vendor?: string;
  machines?: { name: string; qty: number }[];
  materials?: { name: string; qty: number; unit: string }[];
}

export const hurdlesApi = {
  list: () => apiList<ApiHurdle>("/hurdles/"),
  create: (data: HurdlePayload) => apiPost<ApiHurdle>("/hurdles/", data),
  update: (id: number, data: Partial<HurdlePayload>) => apiPatch<ApiHurdle>(`/hurdles/${id}/`, data),
  remove: (id: number) => apiDelete(`/hurdles/${id}/`),
};

export const resourcesApi = {
  list: () => apiList<ApiResource>("/resources/"),
  create: (data: ResourcePayload) => apiPost<ApiResource>("/resources/", data),
  update: (id: number, data: Partial<ResourcePayload>) => apiPatch<ApiResource>(`/resources/${id}/`, data),
  remove: (id: number) => apiDelete(`/resources/${id}/`),
};

export interface ApiComplianceItem {
  id: number;
  name: string;
  project: number;
  projectName: string;
  status: string;
  progress: number;
  dueDate: string | null;
}

export interface ComplianceItemPayload {
  name: string;
  project: number;
  status?: string;
  progress?: number;
  dueDate?: string;
}

export const complianceApi = {
  list: () => apiList<ApiComplianceItem>("/compliance-items/"),
  create: (data: ComplianceItemPayload) => apiPost<ApiComplianceItem>("/compliance-items/", data),
  update: (id: number, data: Partial<ComplianceItemPayload>) =>
    apiPatch<ApiComplianceItem>(`/compliance-items/${id}/`, data),
  remove: (id: number) => apiDelete(`/compliance-items/${id}/`),
};

export interface ApiHandoverUnit {
  id: number;
  unit: string;
  tower: string;
  project: number;
  projectName: string;
  status: string;
  progress: number;
  buyer: string;
}

export interface HandoverUnitPayload {
  unit: string;
  tower?: string;
  project: number;
  status?: string;
  progress?: number;
  buyer?: string;
}

export const handoverApi = {
  list: () => apiList<ApiHandoverUnit>("/handover-units/"),
  create: (data: HandoverUnitPayload) => apiPost<ApiHandoverUnit>("/handover-units/", data),
  update: (id: number, data: Partial<HandoverUnitPayload>) =>
    apiPatch<ApiHandoverUnit>(`/handover-units/${id}/`, data),
  remove: (id: number) => apiDelete(`/handover-units/${id}/`),
};

export interface ApiSocietyStep {
  id: number;
  name: string;
  completed: boolean;
}

export interface ApiSociety {
  id: number;
  name: string;
  project: number;
  projectName: string;
  status: string;
  progress: number;
  steps: ApiSocietyStep[];
}

export interface SocietyPayload {
  name: string;
  project: number;
  status?: string;
  steps?: { name: string; completed?: boolean }[];
}

export const societyApi = {
  list: () => apiList<ApiSociety>("/societies/"),
  create: (data: SocietyPayload) => apiPost<ApiSociety>("/societies/", data),
  update: (id: number, data: Partial<Pick<SocietyPayload, "name" | "project" | "status">>) =>
    apiPatch<ApiSociety>(`/societies/${id}/`, data),
  remove: (id: number) => apiDelete(`/societies/${id}/`),
  toggleStep: (societyId: number, stepId: number) =>
    apiPost<ApiSocietyStep>(`/societies/${societyId}/steps/${stepId}/toggle/`),
};

export interface ApiDocument {
  id: number;
  name: string;
  file: string;
  type: string;
  category: string;
  project: number;
  projectName: string;
  task: number | null;
  compliance: number | null;
  handover: number | null;
  date: string;
  size: string;
}

export const documentsApi = {
  list: (filters?: {
    project?: number;
    task?: number;
    resource?: number;
    hurdle?: number;
    checklist_template?: number;
    compliance?: number;
    handover?: number;
    society?: number;
    tower?: number;
    floor?: number;
    category?: string;
  }): Promise<ApiDocument[]> => {
    let path = "/documents/";
    if (filters) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const qs = params.toString();
      if (qs) path += `?${qs}`;
    }
    return apiList<ApiDocument>(path).then(result => result || []);
  },

  upload: (data: { name: string; category: string; project: number; file: File }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("category", data.category);
    formData.append("project", String(data.project));
    formData.append("file", data.file);
    return apiPost<ApiDocument>("/documents/", formData);
  },

  uploadWithAssignments: (data: {
    name: string;
    category: string;
    project: number;
    file: File;
    complianceId?: number;
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("category", data.category);
    formData.append("project", String(data.project));
    formData.append("file", data.file);
    if (data.complianceId) formData.append("compliance", String(data.complianceId));
    return apiPost<ApiDocument>("/documents/", formData);
  },

  uploadForTask: (data: {
    name: string;
    category?: string;
    project?: number;
    task: number;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("category", data.category || "General");
    if (data.project) formData.append("project", String(data.project));
    formData.append("task", String(data.task));
    formData.append("file", data.file);
    return apiPost<ApiDocument>("/documents/", formData);
  },

  uploadForCompliance: (data: {
    name: string;
    category?: string;
    project: number;
    compliance: number;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("category", data.category || "General");
    formData.append("project", String(data.project));
    formData.append("compliance", String(data.compliance));
    formData.append("file", data.file);
    return apiPost<ApiDocument>("/documents/", formData);
  },

  uploadForHandover: (data: {
    name: string;
    category?: string;
    project: number;
    handover: number;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("category", data.category || "General");
    formData.append("project", String(data.project));
    formData.append("handover", String(data.handover));
    formData.append("file", data.file);
    return apiPost<ApiDocument>("/documents/", formData);
  },

  remove: (id: number) => apiDelete(`/documents/${id}/`),
};

export interface ApiDepartmentStat {
  name: string;
  completed: number;
  inProgress: number;
  delayed: number;
  total: number;
}

export interface ApiDelayPrediction {
  taskId: number;
  title: string;
  department: string;
  progress: number;
  delayDays: number;
  criticalPath: boolean;
  projectName: string | null;
  towerName: string | null;
  riskScore: number;
  risk: { label: string; band: "high" | "medium" | "low" };
}

export const analyticsApi = {
  aiAssistant: (message: string) => apiPost<{ response: string }>("/analytics/ai-assistant/", { message }),
  departmentStats: () => apiGet<ApiDepartmentStat[]>("/analytics/department-stats/"),
  delayPredictions: () => apiGet<ApiDelayPrediction[]>("/analytics/delay-predictions/"),
};

export interface ApiChatMessage {
  id: number;
  user: string;
  userId: number | null;
  text: string;
  createdAt: string;
}

export const tasksApi = {
  list: async () => (await apiList<any>("/tasks/")).map(normalizeTask),
  create: async (data: NewTaskPayload) => normalizeTask(await apiPost<any>("/tasks/", data)),
  update: async (id: number, data: Partial<ApiTask>) => normalizeTask(await apiPatch<any>(`/tasks/${id}/`, data)),
  remove: (id: number) => apiDelete(`/tasks/${id}/`),
  addComment: (id: number, text: string) => apiPost<ApiComment>(`/tasks/${id}/comments/`, { text }),
  toggleChecklistItem: (taskId: number, itemId: number) =>
    apiPost<ApiChecklistItem>(`/tasks/${taskId}/checklist/${itemId}/toggle/`),
  addChecklistItem: (taskId: number, title: string) =>
    apiPost<ApiChecklistItem>(`/tasks/${taskId}/checklist/`, { title }),
  chat: {
    list: (taskId: number) => apiGet<ApiChatMessage[]>(`/tasks/${taskId}/chat/`),
    send: (taskId: number, text: string) => apiPost<ApiChatMessage>(`/tasks/${taskId}/chat/`, { text }),
    remove: (taskId: number, messageId: number) => apiDelete(`/tasks/${taskId}/chat/${messageId}/`),
  },
};

// ---------------------------------------------------------------------------
// Organizations, Companies & Entities
// ---------------------------------------------------------------------------

export interface Organization {
  id: number;
  name: string;
  logo: string | null;
  address: string;
  company_count: number;
  entity_count: number;
}

export interface OrganizationPayload {
  name: string;
  address: string;
  logo?: File | null;
}

export interface OrganizationCompany {
  id: number;
  organization: number;
  company_name: string;
  state: string;
  pin_code: string;
  zone: string;
  region: string;
  country: string;
  sub_domain: string;
}

export type OrganizationCompanyPayload = Omit<OrganizationCompany, "id">;

export interface Entity {
  id: number;
  organization: number;
  entity_name: string;
  state: string;
  region: string;
  zone: string;
}

export type EntityPayload = Omit<Entity, "id">;

function organizationToFormData(payload: OrganizationPayload): FormData {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("address", payload.address);
  if (payload.logo) formData.append("logo", payload.logo);
  return formData;
}

function unwrapList<T = any>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).results)) return (data as any).results;
  return [];
}

function normalizeCompany(raw: any): OrganizationCompany {
  return {
    id: raw.id,
    organization: raw.organization ?? raw.organization_id ?? raw.organizationId,
    company_name: raw.company_name ?? raw.companyName ?? raw.name ?? "",
    state: raw.state ?? "",
    pin_code: raw.pin_code ?? raw.pinCode ?? "",
    zone: raw.zone ?? "",
    region: raw.region ?? "",
    country: raw.country ?? "",
    sub_domain: raw.sub_domain ?? raw.subDomain ?? "",
  };
}

function normalizeEntity(raw: any): Entity {
  return {
    id: raw.id,
    organization: raw.organization ?? raw.organization_id ?? raw.organizationId,
    entity_name: raw.entity_name ?? raw.entityName ?? raw.name ?? "",
    state: raw.state ?? "",
    region: raw.region ?? "",
    zone: raw.zone ?? "",
  };
}

export const organizationApi = {
  list: async () => (await apiGet<any[]>("/organizations/")).map(normalizeOrganization),
  retrieve: async (id: number) => normalizeOrganization(await apiGet<any>(`/organizations/${id}/`)),
  create: async (payload: OrganizationPayload) =>
    normalizeOrganization(await apiPost<any>("/organizations/", organizationToFormData(payload))),
  update: async (id: number, payload: OrganizationPayload) =>
    normalizeOrganization(await apiPatch<any>(`/organizations/${id}/`, organizationToFormData(payload))),
  remove: (id: number) => apiDelete(`/organizations/${id}/`),
};

export const companyApi = {
  list: async (organizationId: number): Promise<OrganizationCompany[]> => {
    const data = await apiGet<any>(`/companies/?organization=${organizationId}`);
    return unwrapList(data).map(normalizeCompany);
  },
  create: async (payload: OrganizationCompanyPayload): Promise<OrganizationCompany> => {
    const data = await apiPost<any>("/companies/", payload);
    return normalizeCompany(data);
  },
  update: async (id: number, payload: OrganizationCompanyPayload): Promise<OrganizationCompany> => {
    const data = await apiPatch<any>(`/companies/${id}/`, payload);
    return normalizeCompany(data);
  },
  remove: (id: number) => apiDelete(`/companies/${id}/`),
};

export const entityApi = {
  list: async (organizationId: number): Promise<Entity[]> => {
    const data = await apiGet<any>(`/entities/?organization=${organizationId}`);
    return unwrapList(data).map(normalizeEntity);
  },
  create: async (payload: EntityPayload): Promise<Entity> => {
    const data = await apiPost<any>("/entities/", payload);
    return normalizeEntity(data);
  },
  update: async (id: number, payload: EntityPayload): Promise<Entity> => {
    const data = await apiPatch<any>(`/entities/${id}/`, payload);
    return normalizeEntity(data);
  },
  remove: (id: number) => apiDelete(`/entities/${id}/`),
};

export const rolesApi = {
  list: async (companyId?: number) =>
    (await apiList<any>(companyId ? `/roles/?company=${companyId}` : "/roles/")).map(normalizeRole),
};

export const departmentsApi = {
  list: async (companyId?: number) =>
    (await apiList<any>(companyId ? `/departments/?company=${companyId}` : "/departments/")).map(normalizeDepartment),
};

// ============================================================
// Invitations API
// ============================================================

export interface InvitationPreview {
  email: string;
  name: string;
  username: string;
  company_name: string;
  role_name: string | null;
  department_name: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  is_expired: boolean;
}

export interface AcceptInvitationPayload {
  token: string;
  username: string;
  password: string;
  name?: string;
}

export interface AcceptInvitationResponse {
  access: string;
  refresh: string;
  user: User;
}

function normalizeInvitationPreview(raw: any): InvitationPreview {
  return {
    email: raw.email ?? "",
    name: raw.name ?? "",
    username: raw.username ?? "",
    company_name: raw.company_name ?? raw.companyName ?? "",
    role_name: raw.role_name ?? raw.roleName ?? null,
    department_name: raw.department_name ?? raw.departmentName ?? null,
    status: raw.status,
    expires_at: raw.expires_at ?? raw.expiresAt,
    is_expired: raw.is_expired ?? raw.isExpired ?? false,
  };
}

export const invitationsApi = {
  list: async () => (await apiList<any>("/invitations/")).map(normalizeInvitation),
  create: async (payload: InvitationPayload) => normalizeInvitation(await apiPost<any>("/invitations/", payload)),
  update: async (id: number, payload: Partial<InvitationPayload>) =>
    normalizeInvitation(await apiPatch<any>(`/invitations/${id}/`, payload)),
  remove: (id: number) => apiDelete(`/invitations/${id}/`),
  resend: async (id: number) => normalizeInvitation(await apiPost<any>(`/invitations/${id}/resend/`)),
  preview: async (token: string) => normalizeInvitationPreview(await apiGet<any>(`/auth/invitations/${token}/`)),
  accept: async (payload: AcceptInvitationPayload) => {
    const data = await apiPost<any>("/auth/accept-invite/", payload);
    return { access: data.access, refresh: data.refresh, user: normalizeUser(data.user) } as AcceptInvitationResponse;
  },
};

// ============================================================
// ✅ Statuses API – used for dynamic status dropdowns
// ============================================================
export const statusesApi = {
  list: (entity: 'project' | 'tower' | 'task' | 'unit' | 'checklist') =>
    apiList<{ value: string; label: string; }>(`/statuses/?entity=${entity}`),
};