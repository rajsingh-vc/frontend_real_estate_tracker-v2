import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2, MapPin, Calendar, CalendarDays, ArrowRight, Pencil, Trash2, ChevronLeft,
  ChevronRight, ChevronDown, Layers, Boxes, GitFork, ListTree, ArrowDown,
  Sparkles, CheckCircle2, Clock, CheckSquare, Split, ArrowDownRight, CornerDownRight,
  ListChecks, Plus, Check, Circle, ExternalLink, Search, ChevronsUpDown, X, Home
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HierarchicalBreadcrumb } from "@/components/navigation/HierarchicalBreadcrumb";
import { getFloorType, getFloorDisplayName, getFloorSubtitle, getFloorSortRank, getFloorIcon, getFloorIconColorClass, countProperFloors } from "@/lib/floorUtils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  projectsApi, towersApi, floorsApi, unitsApi, checklistsApi, subTasksApi, tasksApi,
  organizationApi, companyApi, entityApi, resolveImageUrl,
  type ApiProject, type ApiTower, type ApiFloor, type ApiUnit,
  type ApiChecklist, type ApiSubTask, type ApiTask, type ProjectPayload, ApiError,
  type TowerPayload, type FloorPayload, type UnitPayload, type NewTaskPayload,
  type ChecklistPayload, type SubTaskPayload,
  type Organization, type OrganizationCompany, type Entity,
} from "@/lib/api";
import { NewTaskDialog } from "@/components/dialogs/NewTaskDialog";
import { TaskRow } from "@/pages/Tasks";

type ProjectStatus = string;
type TaskStatus = string;
type TowerStatus = string;

const statusLabels: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  delayed: "Delayed",
  blocked: "Blocked",
  not_started: "Not Started",
  review: "In Review",
  ready: "Ready",
};

const statusColors: Record<string, string> = {
  completed: "bg-success/15 text-success border-success/20",
  in_progress: "bg-warning/15 text-warning border-warning/20",
  delayed: "bg-destructive/15 text-destructive border-destructive/20",
  blocked: "bg-destructive/25 text-destructive border-destructive/30",
  not_started: "bg-muted text-muted-foreground border-border",
  review: "bg-info/15 text-info border-info/20",
  ready: "bg-primary/15 text-primary border-primary/20",
};

function getStatusLabel(status: string) {
  return statusLabels[status] ?? (status ? status.replace(/_/g, " ") : "Pending");
}

function getStatusColor(status: string) {
  return statusColors[status] ?? "bg-muted text-muted-foreground border-border";
}

export const PROJECT_IMAGE_PRESETS = [
  { label: "Prime Tower (Default)", url: "/image.png" },
  { label: "Metropolitan", url: "/notan4.png" },
  { label: "Grand Atrium", url: "/notan1.png" },
  { label: "Modern Complex", url: "/notan2.png" },
  { label: "Glass Plaza", url: "/notan3.png" },
];

export function getProjectCoverImage(project: ApiProject | null | undefined): string {
  if (!project) return "/image.png";
  try {
    const saved = localStorage.getItem("project_custom_images");
    if (saved) {
      const map = JSON.parse(saved);
      if (project.id && map[String(project.id)]) return map[String(project.id)];
      if (project.name && map[project.name.trim()]) return map[project.name.trim()];
    }
  } catch {}
  return "/image.png";
}

export function saveProjectCoverImage(idOrName: string | number, imageUrl: string, fallbackName?: string) {
  try {
    const saved = localStorage.getItem("project_custom_images");
    const map = saved ? JSON.parse(saved) : {};
    map[String(idOrName)] = imageUrl;
    if (fallbackName) {
      map[fallbackName.trim()] = imageUrl;
    }
    localStorage.setItem("project_custom_images", JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save project cover image", e);
  }
}

interface ProjectFormValues {
  name: string;
  location: string;
  status: string;
  startDate: string;
  endDate: string;
  totalUnits: string;
  reraNumber: string;
  budgetCr: string;
  progress: string;
  organizationId: string;
  companyId: string;
  entityId: string;
  hierarchyMode: "full" | "direct_task"; // ✅ NEW
  imageUrl: string;
}

const defaultForm: ProjectFormValues = {
  name: "",
  location: "",
  status: "",
  startDate: "",
  endDate: "",
  totalUnits: "100",
  reraNumber: "",
  budgetCr: "100",
  progress: "0",
  organizationId: "",
  companyId: "",
  entityId: "",
  hierarchyMode: "full", // ✅ NEW
  imageUrl: "/image.png",
};

interface TowerFormValues {
  name: string;
  status: TowerStatus;
  totalFloors: string;
  progress: string;
  unitsPerFloor: string;
}

const defaultTowerForm: TowerFormValues = {
  name: "",
  status: "",
  totalFloors: "",
  progress: "0",
  unitsPerFloor: "",
};

interface FloorFormValues {
  number: string;
  name: string;
  status: string;
  progress: string;
  unitsPerFloor: string;
}

const defaultFloorForm: FloorFormValues = {
  number: "1",
  name: "",
  status: "",
  progress: "0",
  unitsPerFloor: "",
};

interface UnitFormValues {
  unitNumber: string;
  type: string;
  areaSqFt: string;
  status: string;
  progress: string;
}

const defaultUnitForm: UnitFormValues = {
  unitNumber: "",
  type: "2BHK",
  areaSqFt: "1000",
  status: "",
  progress: "0",
};

interface TaskFormValues {
  title: string;
  description: string;
  department: string;
  phase: string;
  priority: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: string;
  delayDays: string;
}

const defaultTaskForm: TaskFormValues = {
  title: "",
  description: "",
  department: "",
  phase: "",
  priority: "medium",
  startDate: "",
  endDate: "",
  status: "",
  progress: "0",
  delayDays: "0",
};

interface ChecklistFormValues {
  name: string;
  status: string;
  progress: string;
}

const defaultChecklistForm: ChecklistFormValues = {
  name: "",
  status: "",
  progress: "0",
};

interface SubTaskFormValues {
  name: string;
  status: string;
  progress: string;
  startDate?: string;
  endDate?: string;
}

const defaultSubTaskForm: SubTaskFormValues = {
  name: "",
  status: "pending",
  progress: "0",
  startDate: "",
  endDate: "",
};

// ==================== Project Dialog ====================
function ProjectDialog({
  isOpen,
  onOpenChange,
  onSave,
  initialProject,
  saving,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ProjectFormValues) => void;
  initialProject: ApiProject | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProjectFormValues>(defaultForm);

  useEffect(() => {
    if (!isOpen) return;
    if (!initialProject) {
      setForm(defaultForm);
      return;
    }

    setForm({
      name: initialProject.name,
      location: initialProject.location,
      status: initialProject.status,
      startDate: initialProject.startDate ?? "",
      endDate: initialProject.endDate ?? "",
      totalUnits: String(initialProject.totalUnits),
      reraNumber: initialProject.reraNumber,
      budgetCr: String(Math.round(initialProject.budget / 10000000)),
      progress: String(initialProject.progress),
      organizationId: initialProject.organizationId ? String(initialProject.organizationId) : "",
      companyId: initialProject.companyId ? String(initialProject.companyId) : "",
      entityId: initialProject.entityId ? String(initialProject.entityId) : "",
      hierarchyMode: initialProject.hierarchyMode ?? "full", // ✅ NEW
      imageUrl: getProjectCoverImage(initialProject),
    });
  }, [isOpen, initialProject]);

  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: organizationApi.list,
    enabled: isOpen,
  });

  const orgId = form.organizationId ? Number(form.organizationId) : null;

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["organization-companies", orgId],
    queryFn: () => companyApi.list(orgId as number),
    enabled: isOpen && orgId !== null,
  });

  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ["organization-entities", orgId],
    queryFn: () => entityApi.list(orgId as number),
    enabled: isOpen && orgId !== null,
  });

  const handleOrgChange = (value: string) => {
    setForm((prev) => ({ ...prev, organizationId: value, companyId: "", entityId: "" }));
  };

  const selectedOrg = useMemo(() => {
    return organizations.find((org: Organization) => String(org.id) === form.organizationId);
  }, [organizations, form.organizationId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.location.trim()) return;
    if (!form.organizationId || !form.companyId) return;
    onSave(form);
  };

  const canSubmit = Boolean(
    form.name.trim() && form.location.trim() && form.organizationId && form.companyId
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl p-5 sm:p-6 max-h-[95vh] overflow-y-auto sm:overflow-visible">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-display font-bold">
            {initialProject ? "Edit Project" : "New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Organization, Company, Entity (Clean 3-column grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Organization</Label>
              <Select value={form.organizationId} onValueChange={handleOrgChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={orgsLoading ? "Loading…" : "Select organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org: Organization) => {
                    const orgLogo = resolveImageUrl(org.logo);
                    return (
                      <SelectItem key={org.id} value={String(org.id)}>
                        <div className="flex items-center gap-2">
                          {orgLogo ? (
                            <img
                              src={orgLogo}
                              alt=""
                              className="w-4 h-4 rounded object-contain bg-white dark:bg-card shrink-0"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{org.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Company</Label>
              <Select
                value={form.companyId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}
                disabled={!form.organizationId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={
                      !form.organizationId
                        ? "Select org first"
                        : companiesLoading
                        ? "Loading…"
                        : "Select company"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c: OrganizationCompany) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Entity</Label>
              <Select
                value={form.entityId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, entityId: value }))}
                disabled={!form.organizationId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={
                      !form.organizationId
                        ? "Select org first"
                        : entitiesLoading
                        ? "Loading…"
                        : "Select entity (opt)"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e: Entity) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.entity_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Organization preview badge - Compact inline bar */}
          {selectedOrg && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              {selectedOrg.logo ? (
                <img
                  src={resolveImageUrl(selectedOrg.logo) || ""}
                  alt={selectedOrg.name}
                  className="w-5 h-5 rounded object-contain bg-white dark:bg-card p-0.5 border shadow-xs shrink-0"
                />
              ) : (
                <Building2 className="w-4 h-4 text-primary shrink-0" />
              )}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-semibold text-foreground truncate">{selectedOrg.name}</span>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  {selectedOrg.address || "Assigned Organization"}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0 font-medium h-5">
                Assigned Org
              </Badge>
            </div>
          )}

          {/* Row 2: Project Name & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name" className="text-xs font-semibold">Project Name</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Marina Heights"
                className="h-9"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-location" className="text-xs font-semibold">Location</Label>
              <Input
                id="project-location"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. Worli, Mumbai"
                className="h-9"
                required
              />
            </div>
          </div>

          {/* Row 3: Structure, Status, Progress % */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Project Flow Structure</Label>
              <Select
                value={form.hierarchyMode}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, hierarchyMode: value as "full" | "direct_task" }))
                }
                disabled={!!initialProject}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Flow (Tower → Floor → Unit → Task → Checklist → Sub Task)</SelectItem>
                  <SelectItem value="direct_task">Direct Flow (Tasks directly under Project)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-status" className="text-xs font-semibold">Status</Label>
              <Input
                id="project-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Planning, Active, Completed"
                className="h-9"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-progress" className="text-xs font-semibold">Progress %</Label>
              <Input
                id="project-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          {/* Row 4: Start Date, End Date, Total Units, Budget, RERA */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-start" className="text-xs font-semibold">Start Date</Label>
              <Input
                id="project-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-end" className="text-xs font-semibold">End Date</Label>
              <Input
                id="project-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-units" className="text-xs font-semibold">Total Units</Label>
              <Input
                id="project-units"
                type="number"
                min={1}
                value={form.totalUnits}
                onChange={(e) => setForm((prev) => ({ ...prev, totalUnits: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-budget" className="text-xs font-semibold">Budget (Cr)</Label>
              <Input
                id="project-budget"
                type="number"
                min={1}
                value={form.budgetCr}
                onChange={(e) => setForm((prev) => ({ ...prev, budgetCr: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="grid gap-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="project-rera" className="text-xs font-semibold">RERA Number</Label>
              <Input
                id="project-rera"
                value={form.reraNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, reraNumber: e.target.value }))}
                placeholder="e.g. P51900028372"
                className="h-9"
              />
            </div>
          </div>

          {/* Dynamic Project Cover Photo (Displayed behind card) */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <span>Project Card Background Image</span>
                <Badge variant="outline" className="text-[10px] font-normal py-0">Behind Card Only</Badge>
              </Label>
              <span className="text-[11px] text-muted-foreground">Dynamic theme photo</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PROJECT_IMAGE_PRESETS.map((preset) => {
                const isSelected = form.imageUrl === preset.url;
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageUrl: preset.url }))}
                    className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer group text-left ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30 shadow-md scale-[1.02]"
                        : "border-border/60 hover:border-primary/50 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-xs">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <p className="text-[9px] font-medium text-white truncate text-center leading-tight">
                        {preset.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2 sm:pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? "Saving…" : initialProject ? "Update Project" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Tower Dialog ====================
function TowerDialog({
  open,
  onOpenChange,
  onSave,
  initialTower,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TowerFormValues) => void;
  initialTower: ApiTower | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<TowerFormValues>(defaultTowerForm);

  useEffect(() => {
    if (!open) return;
    if (!initialTower) {
      setForm(defaultTowerForm);
      return;
    }
    setForm({
      name: initialTower.name,
      status: (initialTower.status as TowerStatus) ?? "planning",
      totalFloors: String(initialTower.totalFloors),
      progress: String(initialTower.progress),
      unitsPerFloor: "0",
    });
  }, [open, initialTower]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialTower ? "Edit Tower" : "New Tower"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="tower-name">Tower Name</Label>
            <Input
              id="tower-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tower-status">Status</Label>
              <Input
                id="tower-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Planning, Active, Completed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tower-floors">Total Floors</Label>
              <Input
                id="tower-floors"
                type="number"
                min={1}
                value={form.totalFloors}
                onChange={(e) => setForm((prev) => ({ ...prev, totalFloors: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tower-progress">Progress %</Label>
            <Input
              id="tower-progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
            />
          </div>

          {!initialTower && (
            <div className="grid gap-2">
              <Label htmlFor="tower-units-per-floor">Units per Floor</Label>
              <Input
                id="tower-units-per-floor"
                type="number"
                min={0}
                value={form.unitsPerFloor}
                onChange={(e) => setForm((prev) => ({ ...prev, unitsPerFloor: e.target.value }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialTower ? "Update Tower" : "Create Tower"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Floor Dialog ====================
function FloorDialog({
  open,
  onOpenChange,
  onSave,
  initialFloor,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FloorFormValues) => void;
  initialFloor: ApiFloor | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<FloorFormValues>(defaultFloorForm);

  useEffect(() => {
    if (!open) return;
    if (!initialFloor) {
      setForm(defaultFloorForm);
      return;
    }
    setForm({
      number: String(initialFloor.number),
      name: initialFloor.name ?? "",
      status: initialFloor.status ?? "active",
      progress: String(initialFloor.progress ?? 0),
      unitsPerFloor: "0",
    });
  }, [open, initialFloor]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.number.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialFloor ? "Edit Floor" : "New Floor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="floor-number">Floor Number</Label>
              <Input
                id="floor-number"
                type="number"
                value={form.number}
                onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floor-name">Floor Name</Label>
              <Input
                id="floor-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Ground Floor"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="floor-status">Status</Label>
              <Input
                id="floor-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floor-progress">Progress %</Label>
              <Input
                id="floor-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
              />
            </div>
          </div>

          {!initialFloor && (
            <div className="grid gap-2">
              <Label htmlFor="floor-units-per-floor">Units on this Floor</Label>
              <Input
                id="floor-units-per-floor"
                type="number"
                min={0}
                value={form.unitsPerFloor}
                onChange={(e) => setForm((prev) => ({ ...prev, unitsPerFloor: e.target.value }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialFloor ? "Update Floor" : "Create Floor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Unit Dialog ====================
function UnitDialog({
  open,
  onOpenChange,
  onSave,
  initialUnit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: UnitFormValues) => void;
  initialUnit: ApiUnit | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<UnitFormValues>(defaultUnitForm);

  useEffect(() => {
    if (!open) return;
    if (!initialUnit) {
      setForm(defaultUnitForm);
      return;
    }
    setForm({
      unitNumber: initialUnit.unitNumber,
      type: initialUnit.type ?? "",
      areaSqFt: String(initialUnit.areaSqFt ?? 0),
      status: initialUnit.status ?? "available",
      progress: String(initialUnit.progress ?? 0),
    });
  }, [open, initialUnit]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.unitNumber.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialUnit ? "Edit Unit" : "New Unit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="unit-number">Unit Number</Label>
              <Input
                id="unit-number"
                value={form.unitNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, unitNumber: e.target.value }))}
                placeholder="e.g. 1204"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-type">Type</Label>
              <Input
                id="unit-type"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                placeholder="e.g. 2BHK"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="unit-area">Area (sq ft)</Label>
              <Input
                id="unit-area"
                type="number"
                min={0}
                value={form.areaSqFt}
                onChange={(e) => setForm((prev) => ({ ...prev, areaSqFt: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-status">Status</Label>
              <Input
                id="unit-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. available, sold"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="unit-progress">Progress %</Label>
            <Input
              id="unit-progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialUnit ? "Update Unit" : "Create Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Task Dialog (for full-hierarchy tasks under a Unit) ====================
function TaskDialog({
  open,
  onOpenChange,
  onSave,
  initialTask,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TaskFormValues) => void;
  initialTask: ApiTask | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<TaskFormValues>(defaultTaskForm);

  useEffect(() => {
    if (!open) return;
    if (!initialTask) {
      setForm(defaultTaskForm);
      return;
    }
    setForm({
      title: initialTask.title,
      description: initialTask.description ?? "",
      department: initialTask.department ?? "",
      phase: initialTask.phase ?? "",
      priority: initialTask.priority ?? "medium",
      startDate: initialTask.startDate ?? "",
      endDate: initialTask.endDate ?? "",
      status: (initialTask.status as TaskStatus) ?? "not_started",
      progress: String(initialTask.progress ?? 0),
      delayDays: String(initialTask.delayDays ?? 0),
    });
  }, [open, initialTask]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initialTask ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Task Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-department">Department</Label>
              <Input
                id="task-department"
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. Civil, Electrical"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-phase">Phase</Label>
              <Input
                id="task-phase"
                value={form.phase}
                onChange={(e) => setForm((prev) => ({ ...prev, phase: e.target.value }))}
                placeholder="e.g. Foundation"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-start">Start Date</Label>
              <Input
                id="task-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-end">End Date</Label>
              <Input
                id="task-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            <textarea
              id="task-description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Optional notes about this task"
            />
          </div>

          {initialTask && (
            <div className="grid md:grid-cols-3 gap-4 pt-2 border-t">
              <div className="grid gap-2 pt-2">
                <Label htmlFor="task-status">Status</Label>
                <Input
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  placeholder="e.g. Not Started, In Progress, Delayed, Completed"
                />
              </div>
              <div className="grid gap-2 pt-2">
                <Label htmlFor="task-progress">Progress %</Label>
                <Input
                  id="task-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 pt-2">
                <Label htmlFor="task-delay">Delay (days)</Label>
                <Input
                  id="task-delay"
                  type="number"
                  min={0}
                  value={form.delayDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, delayDays: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialTask ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Checklist Dialog ====================
function ChecklistDialog({
  open,
  onOpenChange,
  onSave,
  initialChecklist,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ChecklistFormValues) => void;
  initialChecklist: ApiChecklist | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<ChecklistFormValues>(defaultChecklistForm);

  useEffect(() => {
    if (!open) return;
    if (!initialChecklist) {
      setForm(defaultChecklistForm);
      return;
    }
    setForm({
      name: initialChecklist.name,
      status: initialChecklist.status ?? "pending",
      progress: String(initialChecklist.progress ?? 0),
    });
  }, [open, initialChecklist]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialChecklist ? "Edit Checklist" : "New Checklist"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="checklist-name">Checklist Name</Label>
            <Input
              id="checklist-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="checklist-status">Status</Label>
              <Input
                id="checklist-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Pending, Completed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checklist-progress">Progress %</Label>
              <Input
                id="checklist-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialChecklist ? "Update Checklist" : "Create Checklist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SubTask Dialog ====================
function SubTaskDialog({
  open,
  onOpenChange,
  onSave,
  initialSubTask,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SubTaskFormValues) => void;
  initialSubTask: ApiSubTask | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<SubTaskFormValues>(defaultSubTaskForm);

  useEffect(() => {
    if (!open) return;
    if (!initialSubTask) {
      setForm(defaultSubTaskForm);
      return;
    }
    setForm({
      name: initialSubTask.name,
      status: initialSubTask.status ?? "pending",
      progress: String(initialSubTask.progress ?? 0),
      startDate: initialSubTask.startDate ?? "",
      endDate: initialSubTask.endDate ?? "",
    });
  }, [open, initialSubTask]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialSubTask ? "Edit Subtask" : "New Subtask"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="subtask-name">Subtask Name</Label>
            <Input
              id="subtask-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subtask-start">Start Date (Configured in MPP)</Label>
              <Input
                id="subtask-start"
                type="date"
                value={form.startDate || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subtask-end">End Date (Configured in MPP)</Label>
              <Input
                id="subtask-end"
                type="date"
                value={form.endDate || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subtask-status">Status</Label>
              <Input
                id="subtask-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. pending, completed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subtask-progress">Progress %</Label>
              <Input
                id="subtask-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialSubTask ? "Update Subtask" : "Create Subtask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Organization Combobox ====================
// Supports:
// 1. Simultaneous writing/typing to search organizations with live reactive updates
// 2. Ranked match ordering: exact and prefix matches automatically come to the top
// 3. Dynamic project deletion: organizations with 0 projects (or whose projects are deleted)
//    are excluded from the dropdown by default
// 4. Fully configurable:
//    - "Hide empty organizations" toggle (persisted)
//    - "Pin matches to top" vs "Filter only matches" toggle (persisted)
//    - Clear organization selection button
function OrganizationCombobox({
  organizations = [],
  projectList = [],
  selectedOrgId = "",
  onSelectOrg,
}: {
  organizations?: Organization[];
  projectList?: ApiProject[];
  selectedOrgId?: string;
  onSelectOrg: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Compute live project counts per organization from active project list
  const orgProjectCounts = useMemo(() => {
    const counts = new Map<number, number>();
    projectList.forEach((p) => {
      if (p.organizationId) {
        counts.set(p.organizationId, (counts.get(p.organizationId) || 0) + 1);
      }
    });
    return counts;
  }, [projectList]);

  // Strictly include only organizations that have at least 1 active project.
  // If an organization gets deleted (or has 0 projects), it will NOT appear in the dropdown.
  // If only 1 organization is there with projects, keep ONLY that 1 organization!
  const activeOrganizations = useMemo(() => {
    return organizations.filter((org) => (orgProjectCounts.get(org.id) || 0) > 0);
  }, [organizations, orgProjectCounts]);

  // If projects of currently selected organization were deleted and count is now 0,
  // automatically reset to "All organizations"
  useEffect(() => {
    if (selectedOrgId) {
      const count = orgProjectCounts.get(Number(selectedOrgId)) || 0;
      if (count === 0) {
        onSelectOrg("");
      }
    }
  }, [selectedOrgId, orgProjectCounts, onSelectOrg]);

  // Ranked matching: exact & prefix matches automatically sort to the very top
  const rankedOrgs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [...activeOrganizations].sort((a, b) => {
        const countA = orgProjectCounts.get(a.id) || 0;
        const countB = orgProjectCounts.get(b.id) || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
      });
    }

    const scored = activeOrganizations.map((org) => {
      const name = org.name.toLowerCase();
      let score = 0;
      if (name === q) score = 1000;
      else if (name.startsWith(q)) score = 800;
      else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 600;
      else if (name.includes(q)) score = 400;

      return { org, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.org.name.localeCompare(b.org.name))
      .map((item) => item.org);
  }, [activeOrganizations, orgProjectCounts, searchQuery]);

  const selectedOrg = useMemo(
    () => organizations.find((o) => String(o.id) === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const selectedCount = selectedOrg ? orgProjectCounts.get(selectedOrg.id) || 0 : projectList.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[260px] justify-between h-9 px-3 font-normal bg-card hover:bg-accent/50 text-left border-border shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {selectedOrg ? (
              <>
                {resolveImageUrl(selectedOrg.logo) ? (
                  <img
                    src={resolveImageUrl(selectedOrg.logo)!}
                    alt=""
                    className="w-4 h-4 rounded object-contain bg-white dark:bg-card shrink-0"
                  />
                ) : (
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-medium">{selectedOrg.name}</span>
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                  {selectedCount}
                </Badge>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">All organizations</span>
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                  {projectList.length}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedOrgId && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOrg("");
                }}
                className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 shadow-xl border-border/80" align="end">
        {/* Search Input for simultaneous typing */}
        <div className="p-2 border-b border-border/60 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or type organization..."
              className="pl-8 pr-8 h-8 text-xs bg-background"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Organizations List */}
        <div className="max-h-[280px] overflow-y-auto p-1 text-sm">
          {/* All Organizations item */}
          <button
            type="button"
            onClick={() => {
              onSelectOrg("");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
              !selectedOrgId
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/70 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Check className={`w-4 h-4 shrink-0 ${!selectedOrgId ? "opacity-100" : "opacity-0"}`} />
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">All organizations</span>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0">
              {projectList.length} {projectList.length === 1 ? "project" : "projects"}
            </Badge>
          </button>

          <div className="my-1 border-t border-border/40" />

          {rankedOrgs.length === 0 ? (
            <div className="py-6 px-3 text-center text-xs text-muted-foreground space-y-1.5">
              <p>No organizations found matching "{searchQuery}"</p>
            </div>
          ) : (
            rankedOrgs.map((org) => {
              const orgLogo = resolveImageUrl(org.logo);
              const isSelected = String(org.id) === selectedOrgId;
              const count = orgProjectCounts.get(org.id) || 0;

              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    onSelectOrg(String(org.id));
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/70 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <Check className={`w-4 h-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                    {orgLogo ? (
                      <img
                        src={orgLogo}
                        alt=""
                        className="w-4 h-4 rounded object-contain bg-white dark:bg-card shrink-0"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{org.name}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
                  >
                    {count} {count === 1 ? "project" : "projects"}
                  </Badge>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-3 py-1.5 bg-muted/30 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>{rankedOrgs.length} organization{rankedOrgs.length !== 1 ? "s" : ""}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==================== Project List ====================
function ProjectList({
  projectList,
  towers,
  floors = [],
  tasks,
  units = [],
  subTasks = [],
  organizations = [],
  selectedOrgId = "",
  onSelectOrg,
  onCreate,
  onEdit,
  onDelete,
}: {
  projectList: ApiProject[];
  towers: ApiTower[];
  floors?: ApiFloor[];
  tasks: ApiTask[];
  units?: ApiUnit[];
  subTasks?: ApiSubTask[];
  organizations?: Organization[];
  selectedOrgId?: string;
  onSelectOrg?: (value: string) => void;
  onCreate: () => void;
  onEdit: (project: ApiProject) => void;
  onDelete?: (project: ApiProject) => void;
}) {
  const navigate = useNavigate();
  const [projectSearch, setProjectSearch] = useState("");

  // Dynamic search, organization filtering, and ranked sorting
  const sortedProjectList = useMemo(() => {
    // 1. Organization filtering
    let baseList = projectList;
    if (selectedOrgId) {
      const selectedId = Number(selectedOrgId);
      baseList = baseList.filter((p) => p.organizationId === selectedId);
    }

    const q = projectSearch.trim().toLowerCase();
    if (!q) {
      return baseList;
    }

    // Score projects by query match - best match at the top
    const scored = baseList.map((project) => {
      const name = project.name.toLowerCase();
      const loc = (project.location || "").toLowerCase();
      const rera = (project.reraNumber || "").toLowerCase();

      let score = 0;
      if (name === q) score = 1000;
      else if (name.startsWith(q)) score = 800;
      else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 600;
      else if (name.includes(q)) score = 400;
      else if (loc.startsWith(q)) score = 300;
      else if (loc.includes(q)) score = 200;
      else if (rera.includes(q)) score = 150;

      return { project, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.project.name.localeCompare(b.project.name))
      .map((item) => item.project);
  }, [projectList, selectedOrgId, projectSearch]);

  return (
    <div className="space-y-6">
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, active: true },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {sortedProjectList.length} of {projectList.length} projects in portfolio
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dynamic Project Search Bar */}
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-8 pr-8 h-9 text-xs bg-card"
            />
            {projectSearch && (
              <button
                type="button"
                onClick={() => setProjectSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Configurable Organization Combobox */}
          {onSelectOrg && (
            <OrganizationCombobox
              organizations={organizations}
              projectList={projectList}
              selectedOrgId={selectedOrgId}
              onSelectOrg={onSelectOrg}
            />
          )}

          <Button onClick={onCreate} className="w-full sm:w-auto shadow-sm">
            + New Project
          </Button>
        </div>
      </div>

      {sortedProjectList.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold">No matching projects</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {projectSearch
              ? `No projects match "${projectSearch}".`
              : "No projects found for the selected organization."}
          </p>
          <div className="flex justify-center gap-2 pt-1">
            {projectSearch && (
              <Button variant="outline" size="sm" onClick={() => setProjectSearch("")}>
                Clear Search
              </Button>
            )}
            {selectedOrgId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectOrg && onSelectOrg("")}
              >
                Show All Organizations
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {sortedProjectList.map((project) => {
          const pTowers = towers.filter((t) => t.projectId === project.id);
          const pTasks = tasks.filter((t) => t.projectId === project.id);
          const delayed = pTasks.filter((task) => task.status === "delayed" || task.delayDays > 0).length;

          // Find the organization for this project
          const matchedOrg = organizations.find(
            (o: Organization) =>
              o.id === project.organizationId ||
              (project.organizationName && o.name.toLowerCase() === project.organizationName.toLowerCase())
          );
          const projectCoverImg = getProjectCoverImage(project);

          return (
            <Card
              key={project.id}
              className="relative overflow-hidden rounded-2xl border border-border/80 hover:border-primary/50 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full group bg-card"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              {/* Dynamic Photo displayed behind the cards only */}
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img
                  src={projectCoverImg}
                  alt={project.name}
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                {/* Translucent glass backdrop overlay for crystal clear contrast & text readability */}
                <div className="absolute inset-0 bg-background/88 dark:bg-background/90 backdrop-blur-[2px] transition-colors group-hover:bg-background/82 dark:group-hover:bg-background/85" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90" />
              </div>

              <CardContent className="relative z-10 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant={
                        project.status === "active"
                          ? "default"
                          : project.status === "planning"
                          ? "secondary"
                          : "outline"
                      }
                      className="capitalize font-semibold text-xs shadow-xs"
                    >
                      {project.status.replace("_", " ")}
                    </Badge>
                    {project.hierarchyMode === "direct_task" && (
                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 text-primary bg-background/70 backdrop-blur-xs">
                        Direct
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background/60 hover:bg-background/90 backdrop-blur-xs rounded-lg transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(project);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                  </div>
                </div>

                <div>
                  <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors truncate">
                    {project.name}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{project.location}</span>
                  </p>
                  {(project.organizationName || matchedOrg?.name || project.companyName) && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectOrg) {
                            const orgIdToSelect = matchedOrg?.id
                              ? String(matchedOrg.id)
                              : project.organizationId
                              ? String(project.organizationId)
                              : "";
                            if (orgIdToSelect) {
                              onSelectOrg(orgIdToSelect);
                            }
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-xs truncate max-w-full hover:bg-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                        title="Click to filter and bring this organization's projects to the top"
                      >
                        🏢 {[project.organizationName || matchedOrg?.name, project.companyName].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}?tab=towers`);
                    }}
                    className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs hover:border-primary/50 hover:bg-background/90 transition-all cursor-pointer group/stat"
                    title="View Towers"
                  >
                    <p className="text-lg font-display font-bold group-hover/stat:text-primary transition-colors">{pTowers.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Towers</p>
                  </div>
                  {(() => {
                    const pFloors = (floors || []).filter((f) => f.projectId === project.id);
                    const properFloorsCount = countProperFloors(pFloors);
                    return (
                      <div
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}?tab=towers`);
                        }}
                        className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs hover:border-primary/50 hover:bg-background/90 transition-all cursor-pointer group/stat"
                        title="View Floors"
                      >
                        <p className="text-lg font-display font-bold group-hover/stat:text-primary transition-colors">
                          {properFloorsCount > 0
                            ? properFloorsCount
                            : (pFloors.length > 0 ? countProperFloors(pFloors) : "—")}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Floors
                        </p>
                      </div>
                    );
                  })()}
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}?tab=tasks`);
                    }}
                    className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs hover:border-primary/50 hover:bg-background/90 transition-all cursor-pointer group/stat"
                    title="View Tasks"
                  >
                    <p className="text-lg font-display font-bold group-hover/stat:text-primary transition-colors">{pTasks.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tasks</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                {delayed > 0 && <p className="text-xs text-destructive font-medium">{delayed} delayed tasks</p>}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>
                    {project.startDate || "--"} — {project.endDate || "--"}
                  </span>
                </div>

                {/* ✅ Created date & time */}
                {project.createdAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Created {new Date(project.createdAt).toLocaleString(undefined, {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}


// ==================== Task Schedule & Details Modal (MPP Configured Dates) ====================
function TaskScheduleModal({
  open,
  onOpenChange,
  task,
  subTasks = [],
  onEditTask,
  onEditSubTask,
  onCreateSubTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ApiTask | null;
  subTasks?: ApiSubTask[];
  onEditTask: (task: ApiTask) => void;
  onEditSubTask: (subTask: ApiSubTask) => void;
  onCreateSubTask?: () => void;
}) {
  if (!task) return null;

  const linkedSubTasks = subTasks.filter((s) => s.taskId === task.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pr-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold font-display flex items-center gap-2 text-foreground">
                  <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                  <span>{task.title}</span>
                </DialogTitle>
                <Badge className={`${getStatusColor(task.status)} text-[10px]`}>
                  {getStatusLabel(task.status)}
                </Badge>
                {task.priority && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {task.priority} Priority
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {task.department || "General"} · {task.phase || "Phase"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 self-start text-xs h-8"
              onClick={() => {
                onOpenChange(false);
                onEditTask(task);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Task
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Configured MPP Schedule Grid */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Configured Schedule (MPP File)
              </h4>
              <Badge variant="secondary" className="text-[11px] font-mono">
                Duration: {task.durationDays != null ? `${task.durationDays} Days` : "—"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" /> Start Date
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {task.startDate
                    ? new Date(task.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                    : "Not specified"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" /> End Date
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {task.endDate
                    ? new Date(task.endDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                    : "Ongoing"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground">Progress</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={task.progress || 0} className="h-2 flex-1" />
                  <span className="text-xs font-bold text-foreground">{task.progress || 0}%</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground">Baseline Start</p>
                <p className="text-sm font-medium mt-1">
                  {task.baselineStartDate
                    ? new Date(task.baselineStartDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground">Baseline End</p>
                <p className="text-sm font-medium mt-1">
                  {task.baselineEndDate
                    ? new Date(task.baselineEndDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] text-muted-foreground">Schedule Variance</p>
                <p className={`text-sm font-bold mt-1 ${task.delayDays && task.delayDays > 0 ? "text-destructive" : "text-emerald-500"}`}>
                  {task.delayDays && task.delayDays > 0 ? `+${task.delayDays}d Delay` : "On Schedule"}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="p-3.5 rounded-xl border border-border/70 bg-card">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Description / Scope
              </h5>
              <p className="text-sm text-foreground">{task.description}</p>
            </div>
          )}

          {/* Subtasks Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ListChecks className="h-4 w-4 text-primary" />
                Configured Subtasks ({linkedSubTasks.length})
              </h4>
              {onCreateSubTask && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    onOpenChange(false);
                    onCreateSubTask();
                  }}
                >
                  <Plus className="h-3 w-3" /> Add Subtask
                </Button>
              )}
            </div>

            {linkedSubTasks.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">No subtasks configured for this task.</p>
                <p>Click "Add Subtask" or "Edit Task" to configure work items.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {linkedSubTasks.map((subTask) => {
                  const isDone = subTask.status?.toLowerCase() === "completed" || subTask.progress === 100;
                  return (
                    <div
                      key={subTask.id}
                      onClick={() => {
                        onOpenChange(false);
                        onEditSubTask(subTask);
                      }}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-150 cursor-pointer group shadow-2xs"
                      title="Click to view & edit subtask dates and details"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate group-hover:text-primary transition-colors ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {subTask.name}
                          </p>
                          <Badge variant={isDone ? "default" : "outline"} className="text-[10px] capitalize shrink-0">
                            {subTask.status || "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            <CalendarDays className="h-3 w-3" />
                            {subTask.startDate || "No start date"} → {subTask.endDate || "No end date"}
                          </span>
                          <span>Progress: {subTask.progress || 0}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Progress value={subTask.progress || 0} className="h-1.5 w-16 hidden sm:flex" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground group-hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                            onEditSubTask(subTask);
                          }}
                          title="Edit Subtask"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-3 border-t flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              onOpenChange(false);
              onEditTask(task);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Task Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Project Detail ====================
function ProjectDetail({
  project,
  towers,
  floors = [],
  units = [],
  tasks = [],
  checklists = [],
  subTasks = [],
  organizations,
  onCreateTower,
  onEditTower,
  onDeleteTower,
  onSelectTask,
  onEditTask,
  onEditSubTask,
}: {
  project: ApiProject | undefined;
  towers: ApiTower[];
  floors?: ApiFloor[];
  units?: ApiUnit[];
  tasks: ApiTask[];
  checklists?: ApiChecklist[];
  subTasks?: ApiSubTask[];
  organizations?: Organization[];
  onCreateTower: () => void;
  onEditTower: (tower: ApiTower) => void;
  onDeleteTower: (tower: ApiTower) => void;
  onSelectTask?: (task: ApiTask) => void;
  onEditTask?: (task: ApiTask) => void;
  onEditSubTask?: (subTask: ApiSubTask) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!project) return <div className="text-center py-12">Project not found</div>;

  const isDirect = project.hierarchyMode === "direct_task";
  const pTowers = towers.filter((t) => t.projectId === project.id);
  const pTasks = tasks.filter((t) => t.projectId === project.id);

  // Tab navigation state synced with URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (urlTab && ["towers", "tasks", "budget"].includes(urlTab)) {
      return urlTab;
    }
    return isDirect ? "tasks" : "towers";
  });

  useEffect(() => {
    if (urlTab && ["towers", "tasks", "budget"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", val);
        return next;
      },
      { replace: true }
    );
  };

  const matchedOrg = organizations?.find(
    (o: Organization) =>
      o.id === project.organizationId ||
      (project.organizationName && o.name.toLowerCase() === project.organizationName.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Dynamic Breadcrumbs at the top */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project.name, icon: <Building2 className="h-4 w-4" />, active: true },
        ]}
        onBack={() => navigate("/projects")}
        backLabel="Projects"
        actions={
          isDirect ? (
            <NewTaskDialog
              lockedProjectId={project.id}
              trigger={<Button size="sm">+ New Task</Button>}
              onCreated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
            />
          ) : (
            <Button size="sm" onClick={onCreateTower}>+ New Tower</Button>
          )
        }
      />

      {/* 2. Project Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span>{project.location} · RERA: {project.reraNumber || "NA"}</span>
          </p>
          {(project.organizationName || matchedOrg?.name || project.companyName) && (
            <p className="text-xs font-semibold text-primary mt-1">
              {[project.organizationName || matchedOrg?.name, project.companyName].filter(Boolean).join(" · ")}
            </p>
          )}
          {project.createdAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {new Date(project.createdAt).toLocaleString(undefined, {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize self-start sm:self-center">
          {project.status.replace("_", " ")}
        </Badge>
      </div>

      {/* 3. Summary Stat Cards */}
      {(() => {
        const pUnits = units.filter((u) => u.projectId === project.id);
        const pSubTasks = subTasks.filter((s) => s.projectId === project.id || pTasks.some((t) => t.id === s.taskId));
        const hasConfiguredUnits = pUnits.length > 0;

        const statCards = [
          ...(hasConfiguredUnits
            ? [
                {
                  label: "Total Units",
                  value: pUnits.length.toLocaleString(),
                  action: () => handleTabChange(isDirect ? "tasks" : "towers"),
                },
              ]
            : []),
          {
            label: isDirect ? "Direct Mode" : "Towers",
            value: isDirect ? "—" : pTowers.length,
            action: () => {
              if (!isDirect) handleTabChange("towers");
            },
          },
          {
            label: "Tasks",
            value: pTasks.length.toLocaleString(),
            action: () => handleTabChange("tasks"),
          },
          ...(pSubTasks.length > 0
            ? [
                {
                  label: "Subtasks",
                  value: pSubTasks.length.toLocaleString(),
                  action: () => handleTabChange("tasks"),
                },
              ]
            : []),
          {
            label: "Progress",
            value: `${project.progress}%`,
            action: () => handleTabChange(isDirect ? "tasks" : "towers"),
          },
        ];

        const gridColsClass =
          statCards.length === 3
            ? "grid-cols-1 sm:grid-cols-3"
            : statCards.length === 4
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-5";

        return (
          <div className={`grid ${gridColsClass} gap-3 md:gap-4`}>
            {statCards.map((stat) => (
              <Card
                key={stat.label}
                role="button"
                onClick={stat.action}
                className="cursor-pointer transition-all duration-200 hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group border-border/80 bg-card select-none"
                title={`View ${stat.label}`}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-display font-bold group-hover:text-primary transition-colors">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <span>{stat.label}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* 4. Active Level Content Container */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-muted/60 p-1">
            {!isDirect && (
              <TabsTrigger value="towers" className="gap-1.5 font-semibold">
                <Boxes className="h-4 w-4" />
                Towers ({pTowers.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="tasks" className="gap-1.5">
              <CheckSquare className="h-4 w-4" />
              Tasks ({pTasks.length})
            </TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
          </TabsList>
        </div>

        {/* TOWERS VIEW (Replaces previous listing, does NOT stack vertically) */}
        {!isDirect && (
          <TabsContent value="towers" className="mt-4 space-y-4">
            {pTowers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                    <Boxes className="h-6 w-6" />
                  </div>
                  <p>No towers mapped yet for this project.</p>
                  <Button size="sm" onClick={onCreateTower}>+ Add First Tower</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pTowers.map((tower) => {
                  const tFloors = floors.filter((f) => f.towerId === tower.id);
                  const tUnits = units.filter((u) => u.towerId === tower.id);
                  const tTasks = tasks.filter((t) => t.towerId === tower.id);
                  return (
                    <Card
                      key={tower.id}
                      className="hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer group bg-card border-border/80"
                      onClick={() => navigate(`/projects/${project.id}/towers/${tower.id}`)}
                    >
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                              <Boxes className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                                {tower.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {tower.totalFloors} Floors planned · {tFloors.length} mapped
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {tower.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditTower(tower);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteTower(tower);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-border/50">
                          <div>
                            <span className="text-muted-foreground">Units: </span>
                            <span className="font-semibold text-foreground">{tUnits.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tasks: </span>
                            <span className="font-semibold text-foreground">{tTasks.length}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold text-foreground">{tower.progress}%</span>
                          </div>
                          <Progress value={tower.progress} className="h-2" />
                        </div>

                        <div className="pt-1 flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                          <span>Explore Floors</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* TASKS VIEW */}
        <TabsContent value="tasks" className="mt-4">
          <div className="space-y-2">
            {pTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No tasks mapped yet for this project.
                </CardContent>
              </Card>
            ) : (
              pTasks.map((task) => {
                const taskSubTasks = subTasks.filter((s) => s.taskId === task.id);
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask?.(task)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 cursor-pointer group shadow-2xs"
                    title="Click to view task configured schedule & subtasks"
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        task.status === "completed"
                          ? "bg-emerald-500"
                          : task.status === "in_progress"
                          ? "bg-amber-500"
                          : task.status === "delayed"
                          ? "bg-rose-500"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</p>
                        {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>{task.department || "General"} · {task.phase || "Phase"}</span>
                        {(task.startDate || task.endDate) && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            <CalendarDays className="h-3 w-3" />
                            {task.startDate || "—"} to {task.endDate || "—"}
                            {task.durationDays ? ` (${task.durationDays}d)` : ""}
                          </span>
                        )}
                        {taskSubTasks.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-muted/80 text-foreground px-1.5 py-0.5 rounded">
                            <ListChecks className="h-3 w-3 text-primary" />
                            {taskSubTasks.length} Subtasks
                          </span>
                        )}
                      </div>
                    </div>
                    <Progress value={task.progress} className="h-1.5 w-20 hidden md:flex shrink-0" />
                    <span className="text-xs font-semibold shrink-0">{task.progress}%</span>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onEditTask && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onEditTask(task)}
                          title="Edit Task"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* BUDGET VIEW */}
        <TabsContent value="budget" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Budget</span>
                <span className="font-display font-bold">₹{(project.budget / 10000000).toFixed(0)} Cr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spent</span>
                <span className="font-display font-bold">₹{(project.spent / 10000000).toFixed(0)} Cr</span>
              </div>
              <Progress value={(project.spent / Math.max(project.budget, 1)) * 100} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round((project.spent / Math.max(project.budget, 1)) * 100)}% utilized
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Tower Detail ====================
function TowerDetail({
  tower,
  project,
  floors,
  units = [],
  tasks = [],
  onBack,
  projectId,
  onCreateFloor,
  onEditFloor,
  onDeleteFloor,
}: {
  tower: ApiTower | undefined;
  project?: ApiProject;
  floors: ApiFloor[];
  units?: ApiUnit[];
  tasks?: ApiTask[];
  onBack: () => void;
  projectId: number;
  onCreateFloor: () => void;
  onEditFloor: (floor: ApiFloor) => void;
  onDeleteFloor: (floor: ApiFloor) => void;
}) {
  const navigate = useNavigate();

  if (!tower) return <div className="text-center py-12">Tower not found</div>;

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => getFloorSortRank(a) - getFloorSortRank(b)),
    [floors]
  );
  const towerUnits = useMemo(() => units.filter((u) => u.towerId === tower.id), [units, tower.id]);
  const towerTasks = useMemo(() => tasks.filter((t) => t.towerId === tower.id), [tasks, tower.id]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Dynamic Clickable Breadcrumbs */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project?.name || "Project", icon: <Building2 className="h-4 w-4" />, href: `/projects/${projectId}` },
          { label: tower.name, icon: <Boxes className="h-4 w-4" />, active: true },
        ]}
        onBack={onBack}
        backLabel="Project"
        actions={<Button size="sm" onClick={onCreateFloor}>+ New Floor</Button>}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{tower.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{countProperFloors(sortedFloors)} Floors planned · {sortedFloors.length} active levels</p>
        </div>
        <Badge variant={tower.status === "active" ? "default" : "secondary"} className="capitalize self-start sm:self-center">
          {tower.status}
        </Badge>
      </div>

      {/* Summary Stat Cards */}
      <div className={`grid grid-cols-2 ${towerUnits.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{countProperFloors(sortedFloors)}</p>
            <p className="text-xs text-muted-foreground mt-1">Floors</p>
          </CardContent>
        </Card>
        {towerUnits.length > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-display font-bold">{towerUnits.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Mapped Units</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{towerTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tower.progress}%</p>
            <p className="text-xs text-muted-foreground mt-1">Tower Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Floors Grid (Replaces previous listing) */}
      {sortedFloors.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Layers className="h-6 w-6" />
            </div>
            <p>No floors mapped yet for this tower.</p>
            <Button size="sm" onClick={onCreateFloor}>+ Add First Floor</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFloors.map((floor) => {
            const fUnits = units.filter((u) => u.floorId === floor.id);
            const fTasks = tasks.filter((t) => t.floorId === floor.id);
            return (
              <Card
                key={floor.id}
                className="hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer group bg-card border-border/80"
                onClick={() => navigate(`/projects/${projectId}/towers/${tower.id}/floors/${floor.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-all duration-200 ${getFloorIconColorClass(floor)}`}>
                        {getFloorIcon(floor, "h-5 w-5")}
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                          {getFloorDisplayName(floor)}
                        </h3>
                        <p className="text-xs text-muted-foreground">{getFloorSubtitle(floor)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {floor.status || "Active"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditFloor(floor);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                    </div>
                  </div>

                  <div className="text-xs py-1 border-y border-border/50">
                    {fUnits.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Units: </span>
                          <span className="font-semibold text-foreground">{fUnits.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tasks: </span>
                          <span className="font-semibold text-foreground">{fTasks.length}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tasks: </span>
                        <span className="font-semibold text-foreground">{fTasks.length}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold text-foreground">{floor.progress || 0}%</span>
                    </div>
                    <Progress value={floor.progress || 0} className="h-2" />
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>{fUnits.length > 0 ? "Explore Units" : `Explore Tasks (${fTasks.length})`}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== Floor Detail ====================
function FloorDetail({
  floor,
  project,
  tower,
  units,
  tasks = [],
  onBack,
  projectId,
  towerId,
  onCreateUnit,
  onEditUnit,
  onDeleteUnit,
  onCreateTask,
  onEditTask,
}: {
  floor: ApiFloor | undefined;
  project?: ApiProject;
  tower?: ApiTower;
  units: ApiUnit[];
  tasks?: ApiTask[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  onCreateUnit: () => void;
  onEditUnit: (unit: ApiUnit) => void;
  onDeleteUnit?: (unit: ApiUnit) => void;
  onCreateTask?: () => void;
  onEditTask?: (task: ApiTask) => void;
}) {
  const navigate = useNavigate();

  if (!floor) return <div className="text-center py-12">Floor not found</div>;

  const sortedUnits = useMemo(
    () =>
      [...units].sort((a, b) =>
        a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })
      ),
    [units]
  );
  const floorTasks = useMemo(() => tasks.filter((t) => t.floorId === floor.id), [tasks, floor.id]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Dynamic Clickable Breadcrumbs */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project?.name || "Project", icon: <Building2 className="h-4 w-4" />, href: `/projects/${projectId}` },
          { label: tower?.name || "Tower", icon: <Boxes className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}` },
          { label: getFloorDisplayName(floor), icon: getFloorIcon(floor, "h-4 w-4"), active: true },
        ]}
        onBack={onBack}
        backLabel="Tower"
        actions={<Button size="sm" onClick={onCreateUnit}>+ New Unit</Button>}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{getFloorDisplayName(floor)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {getFloorSubtitle(floor)}{sortedUnits.length > 0 ? ` · ${sortedUnits.length} Units Mapped` : ""} · {floorTasks.length} Tasks
          </p>
        </div>
        <Badge variant={floor.status === "active" ? "default" : "secondary"} className="capitalize self-start sm:self-center">
          {floor.status || "Active"}
        </Badge>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{sortedUnits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{floorTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Floor Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{floorTasks.filter((t) => t.status === "completed").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{floor.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Units or Dynamic Tasks */}
      {sortedUnits.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div>
              <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                Floor Tasks ({floorTasks.length})
                <Badge variant="secondary" className="text-[10px]">No Units Configured — Tasks Active</Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Since no units are mapped on this floor, floor-level tasks and activities appear dynamically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onCreateUnit}>+ Map A Unit</Button>
              {onCreateTask && <Button size="sm" onClick={onCreateTask}>+ New Task</Button>}
            </div>
          </div>

          {floorTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                  <CheckSquare className="h-6 w-6" />
                </div>
                <p className="font-medium text-foreground">No tasks or units mapped yet for this floor.</p>
                <p className="text-xs">You can either create units or add tasks directly to this floor.</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={onCreateUnit}>+ Add Unit</Button>
                  {onCreateTask && <Button size="sm" onClick={onCreateTask}>+ Add Floor Task</Button>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {floorTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floor.id}/tasks/${task.id}`)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 cursor-pointer group shadow-2xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</p>
                      {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{task.department || "General"} · {task.phase || "Phase"} · Priority: {task.priority}</span>
                      {(task.startDate || task.endDate) && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          <CalendarDays className="h-3 w-3" />
                          {task.startDate || "—"} to {task.endDate || "—"}
                          {task.durationDays ? ` (${task.durationDays}d)` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(task.status)} text-[10px]`}>{getStatusLabel(task.status)}</Badge>
                  <Progress value={task.progress || 0} className="h-1.5 w-20 hidden md:flex shrink-0" />
                  <span className="text-xs font-semibold shrink-0">{task.progress || 0}%</span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onEditTask && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEditTask(task)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedUnits.map((unit) => {
            const uTasks = tasks.filter((t) => t.unitId === unit.id);
            return (
              <Card
                key={unit.id}
                className="hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer group bg-card border-border/80"
                onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floor.id}/units/${unit.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                        <Home className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                          Unit {unit.unitNumber}
                        </h3>
                        <p className="text-xs text-muted-foreground">{unit.type || "Standard"} · {unit.areaSqFt || 0} sq ft</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {unit.status || "Available"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditUnit(unit);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-border/50">
                    <div>
                      <span className="text-muted-foreground">Tasks: </span>
                      <span className="font-semibold text-foreground">{uTasks.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Done: </span>
                      <span className="font-semibold text-foreground">{uTasks.filter((t) => t.status === "completed").length}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold text-foreground">{unit.progress || 0}%</span>
                    </div>
                    <Progress value={unit.progress || 0} className="h-2" />
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>View Unit Tasks & Activities</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== Unit Detail ====================
function UnitDetail({
  unit,
  project,
  tower,
  floor,
  tasks,
  checklists = [],
  onBack,
  projectId,
  towerId,
  floorId,
  onCreateTask,
  onEditTask,
  onDeleteTask,
}: {
  unit: ApiUnit | undefined;
  project?: ApiProject;
  tower?: ApiTower;
  floor?: ApiFloor;
  tasks: ApiTask[];
  checklists?: ApiChecklist[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  floorId: number;
  onCreateTask: () => void;
  onEditTask: (task: ApiTask) => void;
  onDeleteTask: (task: ApiTask) => void;
}) {
  const navigate = useNavigate();

  if (!unit) return <div className="text-center py-12">Unit not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Dynamic Clickable Breadcrumbs */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project?.name || "Project", icon: <Building2 className="h-4 w-4" />, href: `/projects/${projectId}` },
          { label: tower?.name || "Tower", icon: <Boxes className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}` },
          { label: floor?.name || `Floor ${floor?.number || ""}`, icon: <Layers className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}` },
          { label: `Unit ${unit.unitNumber}`, icon: <Home className="h-4 w-4" />, active: true },
        ]}
        onBack={onBack}
        backLabel="Floor"
        actions={<Button size="sm" onClick={onCreateTask}>+ New Task</Button>}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Unit {unit.unitNumber}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{unit.type || "Standard"} · {unit.areaSqFt || 0} sq ft · Status: {unit.status || "Available"}</p>
        </div>
        <Badge variant={unit.status === "available" ? "default" : "secondary"} className="capitalize self-start sm:self-center">
          {unit.status || "Available"}
        </Badge>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tasks.filter((t) => t.status === "completed").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tasks.filter((t) => t.status !== "completed").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending / Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{unit.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Unit Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Tasks list (Replaces previous listing) */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Unit Tasks & Work Packages
        </h3>

        {tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                <CheckSquare className="h-6 w-6" />
              </div>
              <p>No tasks mapped yet for this unit.</p>
              <Button size="sm" onClick={onCreateTask}>+ Add First Task</Button>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const taskChecklistsCount = checklists.filter((c) => c.taskId === task.id).length;
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 cursor-pointer group shadow-2xs"
                onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unit.id}/tasks/${task.id}`)}
              >
                <div
                  className={`h-3 w-3 rounded-full shrink-0 ${
                    task.status === "completed"
                      ? "bg-emerald-500"
                      : task.status === "in_progress"
                      ? "bg-amber-500"
                      : task.status === "delayed"
                      ? "bg-rose-500"
                      : "bg-muted-foreground/40"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</p>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{task.department || "General"} · {task.phase || "Phase"} · {taskChecklistsCount} Checklists</span>
                    {(task.startDate || task.endDate) && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        <CalendarDays className="h-3 w-3" />
                        {task.startDate || "—"} to {task.endDate || "—"}
                        {task.durationDays ? ` (${task.durationDays}d)` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <Progress value={task.progress} className="h-2 w-24 hidden md:flex shrink-0" />
                <span className="text-xs font-semibold shrink-0">{task.progress}%</span>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditTask(task)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== Task Detail ====================
function TaskDetail({
  task,
  project,
  tower,
  floor,
  unit,
  checklists,
  subTasks = [],
  onBack,
  projectId,
  towerId,
  floorId,
  unitId,
  onCreateChecklist,
  onEditChecklist,
  onDeleteChecklist,
  onCreateSubTask,
  onEditSubTask,
  onToggleSubTask,
  onEditTask,
}: {
  task: ApiTask | undefined;
  project?: ApiProject;
  tower?: ApiTower;
  floor?: ApiFloor;
  unit?: ApiUnit;
  checklists: ApiChecklist[];
  subTasks?: ApiSubTask[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  floorId: number;
  unitId: number;
  onCreateChecklist: () => void;
  onEditChecklist: (checklist: ApiChecklist) => void;
  onDeleteChecklist?: (checklist: ApiChecklist) => void;
  onCreateSubTask?: () => void;
  onEditSubTask?: (subTask: ApiSubTask) => void;
  onToggleSubTask?: (subTask: ApiSubTask) => void;
  onEditTask?: (task: ApiTask) => void;
}) {
  const navigate = useNavigate();

  if (!task) return <div className="text-center py-12">Task not found</div>;

  const taskSubTasks = subTasks.filter((s) => checklists.some((c) => c.id === s.checklistId));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Dynamic Clickable Breadcrumbs */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project?.name || "Project", icon: <Building2 className="h-4 w-4" />, href: `/projects/${projectId}` },
          { label: tower?.name || "Tower", icon: <Boxes className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}` },
          { label: floor?.name || `Floor ${floor?.number || ""}`, icon: <Layers className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}` },
          { label: `Unit ${unit?.unitNumber || ""}`, icon: <Home className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}` },
          { label: task.title, icon: <CheckSquare className="h-4 w-4" />, active: true },
        ]}
        onBack={onBack}
        backLabel="Unit"
        actions={<Button size="sm" onClick={onCreateChecklist}>+ New Checklist</Button>}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{task.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {task.department || "General"} · {task.phase || "Phase"} · Priority: {task.priority}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge
            variant={
              task.status === "completed"
                ? "default"
                : task.status === "in_progress"
                ? "secondary"
                : "outline"
            }
            className="capitalize"
          >
            {task.status.replace("_", " ")}
          </Badge>
          {onEditTask && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onEditTask(task)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Task
            </Button>
          )}
        </div>
      </div>

      {/* Configured MPP Schedule Grid */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Configured Schedule (MPP File)
          </h4>
          <Badge variant="secondary" className="text-[11px] font-mono">
            Duration: {task.durationDays != null ? `${task.durationDays} Days` : "—"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" /> Start Date
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {task.startDate
                ? new Date(task.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                : "Not specified"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" /> End Date
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {task.endDate
                ? new Date(task.endDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                : "Ongoing"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <p className="text-[11px] text-muted-foreground">Baseline Schedule</p>
            <p className="text-xs font-medium text-foreground mt-1">
              {task.baselineStartDate || "—"} to {task.baselineEndDate || "—"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <p className="text-[11px] text-muted-foreground">Schedule Variance</p>
            <p className={`text-sm font-bold mt-1 ${task.delayDays && task.delayDays > 0 ? "text-destructive" : "text-emerald-500"}`}>
              {task.delayDays && task.delayDays > 0 ? `+${task.delayDays}d Delay` : "On Schedule"}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{checklists.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Checklists</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{taskSubTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Subtasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{task.delayDays || 0}d</p>
            <p className="text-xs text-muted-foreground mt-1">Delay Impact</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{task.progress}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      {task.description && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-1 text-foreground">Task Scope & Description</h4>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content: Checklists or Direct Subtasks */}
      <div className="space-y-3">
        {checklists.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div>
                <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Direct Subtasks ({subTasks.filter(s => s.taskId === task.id).length})
                  <Badge variant="secondary" className="text-[10px]">No Checklists Configured — Subtasks Active</Badge>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subtasks directly linked to this task appear dynamically without requiring an intermediate checklist.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={onCreateChecklist}>+ Add Checklist</Button>
                {onCreateSubTask && <Button size="sm" onClick={onCreateSubTask}>+ New Subtask</Button>}
              </div>
            </div>

            {subTasks.filter(s => s.taskId === task.id).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <p className="font-medium text-foreground">No checklists or subtasks mapped yet for this task.</p>
                  <p className="text-xs">You can either create a checklist or add direct subtasks.</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={onCreateChecklist}>+ Add Checklist</Button>
                    {onCreateSubTask && <Button size="sm" onClick={onCreateSubTask}>+ Add Subtask</Button>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {subTasks.filter(s => s.taskId === task.id).map((subTask) => {
                  const isDone = subTask.status === "Completed" || subTask.status === "completed" || subTask.progress === 100;
                  return (
                    <div
                      key={subTask.id}
                      onClick={() => onEditSubTask?.(subTask)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 shadow-2xs cursor-pointer group"
                      title="Click to view & edit subtask schedule"
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubTask?.(subTask);
                        }}
                        className={`h-5 w-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                          isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"
                        }`}
                      >
                        {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate group-hover:text-primary transition-colors ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {subTask.name}
                        </p>
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>Status: {subTask.status || "Pending"}</span>
                          {(subTask.startDate || subTask.endDate) && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              <CalendarDays className="h-3 w-3" />
                              {subTask.startDate || "No start"} → {subTask.endDate || "No end"}
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress value={subTask.progress || 0} className="h-1.5 w-20 hidden md:flex shrink-0" />
                      <span className="text-xs font-semibold shrink-0">{subTask.progress || 0}%</span>
                      <Badge variant={isDone ? "default" : "outline"} className="text-[10px] capitalize shrink-0">
                        {subTask.status || "Pending"}
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        {onEditSubTask && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onEditSubTask(subTask)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          checklists.map((checklist) => {
            const chkSubTasks = subTasks.filter((s) => s.checklistId === checklist.id);
            return (
              <div
                key={checklist.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 cursor-pointer group shadow-2xs"
                onClick={() =>
                  navigate(
                    `/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${task.id}/checklists/${checklist.id}`
                  )
                }
              >
                <div
                  className={`h-3 w-3 rounded-full shrink-0 ${
                    checklist.status === "completed" ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{checklist.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {chkSubTasks.length} Sub Tasks · Status: {checklist.status || "Pending"}
                  </p>
                </div>
                <Progress value={checklist.progress || 0} className="h-1.5 w-20 hidden md:flex shrink-0" />
                <span className="text-xs font-semibold shrink-0">{checklist.progress || 0}%</span>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditChecklist(checklist)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== Checklist Detail ====================
function ChecklistDetail({
  checklist,
  project,
  tower,
  floor,
  unit,
  task,
  subTasks,
  onBack,
  projectId,
  towerId,
  floorId,
  unitId,
  taskId,
  onCreateSubTask,
  onEditSubTask,
  onDeleteSubTask,
  onToggleSubTask,
}: {
  checklist: ApiChecklist | undefined;
  project?: ApiProject;
  tower?: ApiTower;
  floor?: ApiFloor;
  unit?: ApiUnit;
  task?: ApiTask;
  subTasks: ApiSubTask[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  floorId: number;
  unitId: number;
  taskId: number;
  onCreateSubTask: () => void;
  onEditSubTask: (subTask: ApiSubTask) => void;
  onDeleteSubTask: (subTask: ApiSubTask) => void;
  onToggleSubTask?: (subTask: ApiSubTask) => void;
}) {
  if (!checklist) return <div className="text-center py-12">Checklist not found</div>;

  const completedCount = subTasks.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Dynamic Clickable Breadcrumbs */}
      <HierarchicalBreadcrumb
        items={[
          { label: "Projects", icon: <Building2 className="h-4 w-4" />, href: "/projects" },
          { label: project?.name || "Project", icon: <Building2 className="h-4 w-4" />, href: `/projects/${projectId}` },
          { label: tower?.name || "Tower", icon: <Boxes className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}` },
          { label: floor?.name || `Floor ${floor?.number || ""}`, icon: <Layers className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}` },
          { label: `Unit ${unit?.unitNumber || ""}`, icon: <Home className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}` },
          { label: task?.title || "Task", icon: <CheckSquare className="h-4 w-4" />, href: `/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${taskId}` },
          { label: checklist.name, icon: <ListChecks className="h-4 w-4" />, active: true },
        ]}
        onBack={onBack}
        backLabel="Task"
        actions={<Button size="sm" onClick={onCreateSubTask}>+ New Sub Task</Button>}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{checklist.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Status: {checklist.status || "Pending"}</p>
        </div>
        <Badge variant={checklist.status === "completed" ? "default" : "secondary"} className="capitalize self-start sm:self-center">
          {checklist.status || "Pending"}
        </Badge>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{subTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Sub Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{subTasks.length - completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{checklist.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Checklist Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Subtasks list */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Sub Tasks ({subTasks.length})
        </h3>

        {subTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p>No sub tasks mapped yet for this checklist.</p>
              <Button size="sm" onClick={onCreateSubTask}>+ Add First Sub Task</Button>
            </CardContent>
          </Card>
        ) : (
          subTasks.map((subTask) => {
            const isDone = subTask.status === "completed";
            return (
              <div
                key={subTask.id}
                onClick={() => onEditSubTask(subTask)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors shadow-2xs cursor-pointer group"
                title="Click to view & edit subtask schedule"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubTask?.(subTask);
                  }}
                  className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border hover:border-primary bg-background"
                  }`}
                  title={isDone ? "Mark as pending" : "Mark as completed"}
                >
                  {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate group-hover:text-primary transition-colors ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {subTask.name}
                  </p>
                  {(subTask.startDate || subTask.endDate) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        <CalendarDays className="h-3 w-3" />
                        {subTask.startDate || "No start"} → {subTask.endDate || "No end"}
                      </span>
                    </div>
                  )}
                </div>
                <Progress value={subTask.progress || 0} className="h-1.5 w-20 hidden md:flex shrink-0" />
                <Badge variant={isDone ? "default" : "outline"} className="text-[10px] shrink-0">
                  {subTask.status || "Pending"}
                </Badge>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditSubTask(subTask)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== Main Projects Component ====================
const Projects = () => {
  const { projectId, towerId, floorId, unitId, taskId, checklistId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);

  const [towerDialogOpen, setTowerDialogOpen] = useState(false);
  const [editingTower, setEditingTower] = useState<ApiTower | null>(null);

  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<ApiFloor | null>(null);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ApiUnit | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ApiTask | null>(null);
  const [viewingTask, setViewingTask] = useState<ApiTask | null>(null);

  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ApiChecklist | null>(null);

  const [subTaskDialogOpen, setSubTaskDialogOpen] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<ApiSubTask | null>(null);

  const { data: projects = [], isLoading, isError, error } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  // ✅ NEW: organization filter — selected org's projects are pinned to the top of the list
  const [projectOrgFilter, setProjectOrgFilter] = useState<string>("");
  const { data: projectListOrganizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: organizationApi.list,
  });
  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list
  });
  const { data: floors = [] } = useQuery({
    queryKey: ["floors"],
    queryFn: floorsApi.list
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: unitsApi.list
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list
  });
  const { data: checklists = [] } = useQuery({
    queryKey: ["checklists"],
    queryFn: checklistsApi.list
  });
  const { data: subTasks = [] } = useQuery({
    queryKey: ["subtasks"],
    queryFn: subTasksApi.list
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === Number(projectId)),
    [projects, projectId]
  );
  const selectedTower = useMemo(
    () => towers.find((t) => t.id === Number(towerId)),
    [towers, towerId]
  );
  const selectedFloor = useMemo(
    () => floors.find((f) => f.id === Number(floorId)),
    [floors, floorId]
  );
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === Number(unitId)),
    [units, unitId]
  );
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === Number(taskId)),
    [tasks, taskId]
  );
  const selectedChecklist = useMemo(
    () => checklists.find((c) => c.id === Number(checklistId)),
    [checklists, checklistId]
  );

  const towerFloors = useMemo(
    () => floors.filter((f) => f.towerId === Number(towerId)),
    [floors, towerId]
  );
  const floorUnits = useMemo(
    () => units.filter((u) => u.floorId === Number(floorId)),
    [units, floorId]
  );
  const unitTasks = useMemo(
    () => tasks.filter((t) => t.unitId === Number(unitId)),
    [tasks, unitId]
  );
  const taskChecklists = useMemo(
    () => checklists.filter((c) => c.taskId === Number(taskId)),
    [checklists, taskId]
  );
  const checklistSubTasks = useMemo(
    () => subTasks.filter((s) => s.checklistId === Number(checklistId)),
    [subTasks, checklistId]
  );

  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: ProjectPayload) => projectsApi.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project created", description: `"${project.name}" has been added.` });
    },
    onError: onMutationError("Couldn't create project"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProjectPayload> }) =>
      projectsApi.update(id, data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project updated", description: `"${project.name}" has been saved.` });
    },
    onError: onMutationError("Couldn't update project"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Project deleted" });
    },
    onError: onMutationError("Couldn't delete project"),
  });

  const createTowerMutation = useMutation({
    mutationFn: ({ payload }: { payload: TowerPayload; unitsPerFloor: number }) =>
      towersApi.create(payload),
    onSuccess: async (tower, variables) => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      toast({ title: "Tower created", description: `"${tower.name}" has been added.` });

      const totalFloors = variables.payload.totalFloors || 0;
      const unitsPerFloor = variables.unitsPerFloor || 0;
      if (totalFloors > 0) {
        try {
          const createdFloors = await Promise.all(
            Array.from({ length: totalFloors }, (_, i) => i + 1).map((floorNumber) =>
              floorsApi.create({
                towerId: tower.id,
                projectId: tower.projectId,
                number: floorNumber,
                name: `Floor ${floorNumber}`,
                status: "active",
                progress: 0,
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: ["floors"] });

          if (unitsPerFloor > 0) {
            try {
              await Promise.all(
                createdFloors.flatMap((floor) =>
                  Array.from({ length: unitsPerFloor }, (_, i) => i + 1).map((seq) =>
                    unitsApi.create({
                      floorId: floor.id,
                      towerId: floor.towerId,
                      projectId: floor.projectId,
                      unitNumber: `${floor.number}${String(seq).padStart(2, "0")}`,
                      type: "2BHK",
                      areaSqFt: 1000,
                      status: "available",
                      progress: 0,
                    })
                  )
                )
              );
              queryClient.invalidateQueries({ queryKey: ["units"] });
            } catch (err) {
              toast({
                title: "Floors created, but couldn't auto-generate all units",
                description: err instanceof ApiError ? err.message : "You can add the remaining units manually.",
                variant: "destructive",
              });
            }
          }
        } catch (err) {
          toast({
            title: "Tower created, but couldn't auto-generate all floors",
            description: err instanceof ApiError ? err.message : "You can add the remaining floors manually.",
            variant: "destructive",
          });
        }
      }
    },
    onError: onMutationError("Couldn't create tower"),
  });

  const updateTowerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TowerPayload> }) =>
      towersApi.update(id, data),
    onSuccess: (tower) => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      toast({ title: "Tower updated", description: `"${tower.name}" has been saved.` });
    },
    onError: onMutationError("Couldn't update tower"),
  });

  const deleteTowerMutation = useMutation({
    mutationFn: (id: number) => towersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Tower deleted" });
    },
    onError: onMutationError("Couldn't delete tower"),
  });

  const createFloorMutation = useMutation({
    mutationFn: ({ payload }: { payload: FloorPayload; unitsPerFloor: number }) =>
      floorsApi.create(payload),
    onSuccess: async (floor, variables) => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Floor created" });

      const unitsPerFloor = variables.unitsPerFloor || 0;
      if (unitsPerFloor > 0) {
        try {
          await Promise.all(
            Array.from({ length: unitsPerFloor }, (_, i) => i + 1).map((seq) =>
              unitsApi.create({
                floorId: floor.id,
                towerId: floor.towerId,
                projectId: floor.projectId,
                unitNumber: `${floor.number}${String(seq).padStart(2, "0")}`,
                type: "2BHK",
                areaSqFt: 1000,
                status: "available",
                progress: 0,
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: ["units"] });
        } catch (err) {
          toast({
            title: "Floor created, but couldn't auto-generate all units",
            description: err instanceof ApiError ? err.message : "You can add the remaining units manually.",
            variant: "destructive",
          });
        }
      }
    },
    onError: onMutationError("Couldn't create floor"),
  });

  const updateFloorMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FloorPayload> }) =>
      floorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Floor updated" });
    },
    onError: onMutationError("Couldn't update floor"),
  });

  const deleteFloorMutation = useMutation({
    mutationFn: (id: number) => floorsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Floor deleted" });
    },
    onError: onMutationError("Couldn't delete floor"),
  });

  const createUnitMutation = useMutation({
    mutationFn: (data: UnitPayload) => unitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast({ title: "Unit created" });
    },
    onError: onMutationError("Couldn't create unit"),
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UnitPayload> }) =>
      unitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast({ title: "Unit updated" });
    },
    onError: onMutationError("Couldn't update unit"),
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (id: number) => unitsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Unit deleted" });
    },
    onError: onMutationError("Couldn't delete unit"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: NewTaskPayload) => tasksApi.create(data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task created", description: `"${task.title}" has been added.` });
    },
    onError: onMutationError("Couldn't create task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ApiTask> }) =>
      tasksApi.update(id, data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task updated", description: `"${task.title}" has been saved.` });
    },
    onError: onMutationError("Couldn't update task"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Task deleted" });
    },
    onError: onMutationError("Couldn't delete task"),
  });

  const createChecklistMutation = useMutation({
    mutationFn: (data: ChecklistPayload) => checklistsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({ title: "Checklist created" });
    },
    onError: onMutationError("Couldn't create checklist"),
  });

  const updateChecklistMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ChecklistPayload> }) =>
      checklistsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({ title: "Checklist updated" });
    },
    onError: onMutationError("Couldn't update checklist"),
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (id: number) => checklistsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Checklist deleted" });
    },
    onError: onMutationError("Couldn't delete checklist"),
  });

  const createSubTaskMutation = useMutation({
    mutationFn: (data: SubTaskPayload) => subTasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Sub task created" });
    },
    onError: onMutationError("Couldn't create sub task"),
  });

  const updateSubTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SubTaskPayload> }) =>
      subTasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Sub task updated" });
    },
    onError: onMutationError("Couldn't update sub task"),
  });

  const deleteSubTaskMutation = useMutation({
    mutationFn: (id: number) => subTasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast({ title: "Sub task deleted" });
    },
    onError: onMutationError("Couldn't delete sub task"),
  });

  const handleSaveProject = (values: ProjectFormValues) => {
    if (!values.organizationId || !values.companyId) return;

    const payload: ProjectPayload = {
      name: values.name.trim(),
      location: values.location.trim(),
      status: values.status,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      totalUnits: Number(values.totalUnits || 0),
      reraNumber: values.reraNumber.trim(),
      budget: Number(values.budgetCr || 0) * 10000000,
      progress: Number(values.progress || 0),
      organizationId: Number(values.organizationId),
      companyId: Number(values.companyId),
      entityId: values.entityId ? Number(values.entityId) : null,
      hierarchyMode: values.hierarchyMode, // ✅ NEW
    };

    if (editingProject) {
      if (values.imageUrl) {
        saveProjectCoverImage(editingProject.id, values.imageUrl, values.name);
      }
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      if (values.imageUrl) {
        saveProjectCoverImage(values.name, values.imageUrl);
      }
      createMutation.mutate(payload, {
        onSuccess: (newProj) => {
          if (values.imageUrl && newProj?.id) {
            saveProjectCoverImage(newProj.id, values.imageUrl, values.name);
          }
        },
      });
    }
    setDialogOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (project: ApiProject) => {
    if (!window.confirm(`Delete ${project.name}? This will also delete all associated data.`)) return;
    deleteMutation.mutate(project.id);
  };

  const handleSaveTower = (values: TowerFormValues) => {
    if (!projectId) return;
    const payload: TowerPayload = {
      projectId: Number(projectId),
      name: values.name.trim(),
      status: values.status.trim() || "planning",
      totalFloors: Number(values.totalFloors || 0),
      progress: Number(values.progress || 0),
    };
    if (editingTower) {
      updateTowerMutation.mutate({ id: editingTower.id, data: payload });
    } else {
      createTowerMutation.mutate({
        payload,
        unitsPerFloor: Number(values.unitsPerFloor || 0),
      });
    }
    setTowerDialogOpen(false);
    setEditingTower(null);
  };

  const handleDeleteTower = (tower: ApiTower) => {
    if (!window.confirm(`Delete ${tower.name}? This will also delete all associated floors, units, and tasks.`)) return;
    deleteTowerMutation.mutate(tower.id);
  };

  const handleSaveFloor = (values: FloorFormValues) => {
    if (!projectId || !towerId) return;
    const payload: FloorPayload = {
      towerId: Number(towerId),
      projectId: Number(projectId),
      number: Number(values.number || 0),
      name: values.name.trim(),
      status: values.status.trim() || "active",
      progress: Number(values.progress || 0),
    };
    if (editingFloor) {
      updateFloorMutation.mutate({ id: editingFloor.id, data: payload });
    } else {
      createFloorMutation.mutate({ payload, unitsPerFloor: Number(values.unitsPerFloor || 0) });
    }
    setFloorDialogOpen(false);
    setEditingFloor(null);
  };

  const handleDeleteFloor = (floor: ApiFloor) => {
    if (!window.confirm(`Delete Floor ${floor.number}? This will also delete all associated units and tasks.`)) return;
    deleteFloorMutation.mutate(floor.id);
  };

  const handleSaveUnit = (values: UnitFormValues) => {
    if (!projectId || !towerId || !floorId) return;
    const payload: UnitPayload = {
      floorId: Number(floorId),
      towerId: Number(towerId),
      projectId: Number(projectId),
      unitNumber: values.unitNumber.trim(),
      type: values.type.trim(),
      areaSqFt: Number(values.areaSqFt || 0),
      status: values.status.trim() || "available",
      progress: Number(values.progress || 0),
    };
    if (editingUnit) {
      updateUnitMutation.mutate({ id: editingUnit.id, data: payload });
    } else {
      createUnitMutation.mutate(payload);
    }
    setUnitDialogOpen(false);
    setEditingUnit(null);
  };

  const handleDeleteUnit = (unit: ApiUnit) => {
    if (!window.confirm(`Delete ${unit.unitNumber}? This will also delete all associated tasks.`)) return;
    deleteUnitMutation.mutate(unit.id);
  };

  const handleSaveTask = (values: TaskFormValues) => {
    if (editingTask) {
      const payload: Partial<ApiTask> = {
        title: values.title.trim(),
        description: values.description.trim(),
        department: values.department.trim(),
        phase: values.phase.trim(),
        priority: values.priority,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        status: values.status,
        progress: Number(values.progress || 0),
        delayDays: Number(values.delayDays || 0),
      };
      updateTaskMutation.mutate({ id: editingTask.id, data: payload });
      if (viewingTask?.id === editingTask.id) {
        setViewingTask((prev) => (prev ? { ...prev, ...payload } : null));
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
      return;
    }

    if (!projectId || !unitId) return;

    const payload: NewTaskPayload = {
      title: values.title.trim(),
      description: values.description.trim(),
      department: values.department.trim(),
      phase: values.phase.trim(),
      priority: values.priority,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      projectId: Number(projectId),
      towerId: towerId ? Number(towerId) : undefined,
      floorId: floorId ? Number(floorId) : undefined,
      unitId: Number(unitId),
    };
    createTaskMutation.mutate(payload);
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (task: ApiTask) => {
    if (!window.confirm(`Delete "${task.title}"? This will also delete all associated checklists.`)) return;
    deleteTaskMutation.mutate(task.id);
  };

  const handleSaveChecklist = (values: ChecklistFormValues) => {
    if (!projectId || !towerId || !floorId || !unitId || !taskId) return;
    const payload: ChecklistPayload = {
      taskId: Number(taskId),
      unitId: Number(unitId),
      floorId: Number(floorId),
      towerId: Number(towerId),
      projectId: Number(projectId),
      name: values.name.trim(),
      status: values.status,
      progress: Number(values.progress || 0),
    };
    if (editingChecklist) {
      updateChecklistMutation.mutate({ id: editingChecklist.id, data: payload });
    } else {
      createChecklistMutation.mutate(payload);
    }
    setChecklistDialogOpen(false);
    setEditingChecklist(null);
  };

  const handleDeleteChecklist = (checklist: ApiChecklist) => {
    if (!window.confirm(`Delete "${checklist.name}"? This will also delete all associated sub tasks.`)) return;
    deleteChecklistMutation.mutate(checklist.id);
  };

  const handleSaveSubTask = (values: SubTaskFormValues) => {
    if (editingSubTask) {
      const payload: Partial<SubTaskPayload> = {
        name: values.name.trim(),
        status: values.status,
        progress: Number(values.progress || 0),
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      };
      updateSubTaskMutation.mutate({ id: editingSubTask.id, data: payload });
      setSubTaskDialogOpen(false);
      setEditingSubTask(null);
      return;
    }

    const payload: SubTaskPayload = {
      checklistId: checklistId ? Number(checklistId) : undefined,
      taskId: taskId ? Number(taskId) : (viewingTask ? viewingTask.id : 0),
      unitId: unitId ? Number(unitId) : undefined,
      floorId: floorId ? Number(floorId) : undefined,
      towerId: towerId ? Number(towerId) : undefined,
      projectId: projectId ? Number(projectId) : undefined,
      name: values.name.trim(),
      status: values.status,
      progress: Number(values.progress || 0),
      startDate: values.startDate || null,
      endDate: values.endDate || null,
    };
    createSubTaskMutation.mutate(payload);
    setSubTaskDialogOpen(false);
    setEditingSubTask(null);
  };

  const handleDeleteSubTask = (subTask: ApiSubTask) => {
    if (!window.confirm(`Delete "${subTask.name}"?`)) return;
    deleteSubTaskMutation.mutate(subTask.id);
  };

  const goToProject = (id: number) => navigate(`/projects/${id}`);
  const goToTower = (projectId: number, towerId: number) =>
    navigate(`/projects/${projectId}/towers/${towerId}`);
  const goToFloor = (projectId: number, towerId: number, floorId: number) =>
    navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}`);
  const goToUnit = (projectId: number, towerId: number, floorId: number, unitId: number) =>
    navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}`);
  const goToTask = (projectId: number, towerId: number, floorId: number, unitId: number, taskId: number) =>
    navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${taskId}`);
  const goToChecklist = (projectId: number, towerId: number, floorId: number, unitId: number, taskId: number, checklistId: number) =>
    navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${taskId}/checklists/${checklistId}`);

  const handleToggleSubTask = (subTask: ApiSubTask) => {
    const nextStatus = subTask.status === "completed" ? "pending" : "completed";
    const nextProgress = nextStatus === "completed" ? 100 : 0;
    updateSubTaskMutation.mutate({
      id: subTask.id,
      data: { status: nextStatus, progress: nextProgress },
    });
  };

  const renderView = () => {
    if (projectId && taskId && checklistId) {
      return (
        <ChecklistDetail
          checklist={selectedChecklist}
          project={selectedProject}
          tower={selectedTower}
          floor={selectedFloor}
          unit={selectedUnit}
          task={selectedTask}
          subTasks={checklistSubTasks}
          onBack={() => {
            if (unitId && Number(unitId) > 0) {
              goToTask(Number(projectId), Number(towerId || selectedTask?.towerId), Number(floorId || selectedTask?.floorId), Number(unitId), Number(taskId));
            } else if (floorId || selectedTask?.floorId) {
              navigate(`/projects/${projectId}/towers/${towerId || selectedTask?.towerId}/floors/${floorId || selectedTask?.floorId}/tasks/${taskId}`);
            } else {
              navigate(`/projects/${projectId}/tasks/${taskId}`);
            }
          }}
          projectId={Number(projectId)}
          towerId={Number(towerId || selectedTask?.towerId || 0)}
          floorId={Number(floorId || selectedTask?.floorId || 0)}
          unitId={Number(unitId || selectedTask?.unitId || 0)}
          taskId={Number(taskId)}
          onCreateSubTask={() => {
            setEditingSubTask(null);
            setSubTaskDialogOpen(true);
          }}
          onEditSubTask={(subTask) => {
            setEditingSubTask(subTask);
            setSubTaskDialogOpen(true);
          }}
          onDeleteSubTask={handleDeleteSubTask}
          onToggleSubTask={handleToggleSubTask}
        />
      );
    }

    if (projectId && taskId) {
      return (
        <TaskDetail
          task={selectedTask}
          project={selectedProject}
          tower={selectedTower}
          floor={selectedFloor}
          unit={selectedUnit}
          checklists={taskChecklists}
          subTasks={subTasks}
          onBack={() => {
            if (unitId && Number(unitId) > 0) {
              goToUnit(Number(projectId), Number(towerId || selectedTask?.towerId), Number(floorId || selectedTask?.floorId), Number(unitId));
            } else if (floorId || selectedTask?.floorId) {
              goToFloor(Number(projectId), Number(towerId || selectedTask?.towerId), Number(floorId || selectedTask?.floorId));
            } else if (towerId || selectedTask?.towerId) {
              goToTower(Number(projectId), Number(towerId || selectedTask?.towerId));
            } else {
              goToProject(Number(projectId));
            }
          }}
          projectId={Number(projectId)}
          towerId={Number(towerId || selectedTask?.towerId || 0)}
          floorId={Number(floorId || selectedTask?.floorId || 0)}
          unitId={Number(unitId || selectedTask?.unitId || 0)}
          onCreateChecklist={() => {
            setEditingChecklist(null);
            setChecklistDialogOpen(true);
          }}
          onEditChecklist={(checklist) => {
            setEditingChecklist(checklist);
            setChecklistDialogOpen(true);
          }}
          onDeleteChecklist={handleDeleteChecklist}
          onCreateSubTask={() => {
            setEditingSubTask(null);
            setSubTaskDialogOpen(true);
          }}
          onEditSubTask={(subTask) => {
            setEditingSubTask(subTask);
            setSubTaskDialogOpen(true);
          }}
          onToggleSubTask={handleToggleSubTask}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskDialogOpen(true);
          }}
        />
      );
    }

    if (projectId && towerId && floorId && unitId) {
      return (
        <UnitDetail
          unit={selectedUnit}
          project={selectedProject}
          tower={selectedTower}
          floor={selectedFloor}
          tasks={unitTasks}
          checklists={checklists}
          onBack={() => goToFloor(
            Number(projectId),
            Number(towerId),
            Number(floorId)
          )}
          projectId={Number(projectId)}
          towerId={Number(towerId)}
          floorId={Number(floorId)}
          onCreateTask={() => {
            setEditingTask(null);
            setTaskDialogOpen(true);
          }}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskDialogOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
        />
      );
    }

    if (projectId && towerId && floorId) {
      return (
        <FloorDetail
          floor={selectedFloor}
          project={selectedProject}
          tower={selectedTower}
          units={floorUnits}
          tasks={tasks}
          onBack={() => goToTower(Number(projectId), Number(towerId))}
          projectId={Number(projectId)}
          towerId={Number(towerId)}
          onCreateUnit={() => {
            setEditingUnit(null);
            setUnitDialogOpen(true);
          }}
          onEditUnit={(unit) => {
            setEditingUnit(unit);
            setUnitDialogOpen(true);
          }}
          onDeleteUnit={handleDeleteUnit}
          onCreateTask={() => {
            setEditingTask(null);
            setTaskDialogOpen(true);
          }}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskDialogOpen(true);
          }}
        />
      );
    }

    if (projectId && towerId) {
      return (
        <TowerDetail
          tower={selectedTower}
          project={selectedProject}
          floors={towerFloors}
          units={units}
          tasks={tasks}
          onBack={() => goToProject(Number(projectId))}
          projectId={Number(projectId)}
          onCreateFloor={() => {
            setEditingFloor(null);
            setFloorDialogOpen(true);
          }}
          onEditFloor={(floor) => {
            setEditingFloor(floor);
            setFloorDialogOpen(true);
          }}
          onDeleteFloor={handleDeleteFloor}
        />
      );
    }

    if (projectId) {
      return (
        <ProjectDetail
          project={selectedProject}
          towers={towers}
          floors={floors}
          units={units}
          tasks={tasks}
          checklists={checklists}
          subTasks={subTasks}
          organizations={projectListOrganizations}
          onCreateTower={() => {
            setEditingTower(null);
            setTowerDialogOpen(true);
          }}
          onEditTower={(tower) => {
            setEditingTower(tower);
            setTowerDialogOpen(true);
          }}
          onDeleteTower={handleDeleteTower}
          onSelectTask={(task) => setViewingTask(task)}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskDialogOpen(true);
          }}
          onEditSubTask={(subTask) => {
            setEditingSubTask(subTask);
            setSubTaskDialogOpen(true);
          }}
        />
      );
    }

    return (
      <ProjectList
        projectList={projects}
        towers={towers}
        floors={floors}
        tasks={tasks}
        units={units}
        subTasks={subTasks}
        organizations={projectListOrganizations}
        selectedOrgId={projectOrgFilter}
        onSelectOrg={setProjectOrgFilter}
        onCreate={() => {
          setEditingProject(null);
          setDialogOpen(true);
        }}
        onEdit={(project) => {
          setEditingProject(project);
          setDialogOpen(true);
        }}
        onDelete={handleDeleteProject}
      />
    );
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading projects…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load projects{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  return (
    <>
      {renderView()}

      <ProjectDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        onSave={handleSaveProject}
        initialProject={editingProject}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <TowerDialog
        open={towerDialogOpen}
        onOpenChange={(open) => {
          setTowerDialogOpen(open);
          if (!open) setEditingTower(null);
        }}
        onSave={handleSaveTower}
        initialTower={editingTower}
        saving={createTowerMutation.isPending || updateTowerMutation.isPending}
      />

      <FloorDialog
        open={floorDialogOpen}
        onOpenChange={(open) => {
          setFloorDialogOpen(open);
          if (!open) setEditingFloor(null);
        }}
        onSave={handleSaveFloor}
        initialFloor={editingFloor}
        saving={createFloorMutation.isPending || updateFloorMutation.isPending}
      />

      <UnitDialog
        open={unitDialogOpen}
        onOpenChange={(open) => {
          setUnitDialogOpen(open);
          if (!open) setEditingUnit(null);
        }}
        onSave={handleSaveUnit}
        initialUnit={editingUnit}
        saving={createUnitMutation.isPending || updateUnitMutation.isPending}
      />

      <TaskScheduleModal
        open={!!viewingTask}
        onOpenChange={(open) => {
          if (!open) setViewingTask(null);
        }}
        task={viewingTask ? (tasks.find((t) => t.id === viewingTask.id) || viewingTask) : null}
        subTasks={subTasks}
        onEditTask={(task) => {
          setEditingTask(task);
          setTaskDialogOpen(true);
        }}
        onEditSubTask={(subTask) => {
          setEditingSubTask(subTask);
          setSubTaskDialogOpen(true);
        }}
        onCreateSubTask={() => {
          setEditingSubTask(null);
          setSubTaskDialogOpen(true);
        }}
      />

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        saving={createTaskMutation.isPending || updateTaskMutation.isPending}
      />

      <ChecklistDialog
        open={checklistDialogOpen}
        onOpenChange={(open) => {
          setChecklistDialogOpen(open);
          if (!open) setEditingChecklist(null);
        }}
        onSave={handleSaveChecklist}
        initialChecklist={editingChecklist}
        saving={createChecklistMutation.isPending || updateChecklistMutation.isPending}
      />

      <SubTaskDialog
        open={subTaskDialogOpen}
        onOpenChange={(open) => {
          setSubTaskDialogOpen(open);
          if (!open) setEditingSubTask(null);
        }}
        onSave={handleSaveSubTask}
        initialSubTask={editingSubTask}
        saving={createSubTaskMutation.isPending || updateSubTaskMutation.isPending}
      />
    </>
  );
};

export default Projects;