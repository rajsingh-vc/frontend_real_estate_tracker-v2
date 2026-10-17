import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2, MapPin, Calendar, ArrowRight, Pencil, Trash2, ChevronLeft,
  ChevronRight, ChevronDown, Layers, Boxes, GitFork, ListTree, ArrowDown,
  Sparkles, CheckCircle2, Clock, CheckSquare, Split, ArrowDownRight, CornerDownRight,
  ListChecks, Plus, Check, Circle, ExternalLink
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
}

const defaultSubTaskForm: SubTaskFormValues = {
  name: "",
  status: "",
  progress: "0",
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
          <DialogTitle>{initialSubTask ? "Edit Sub Task" : "New Sub Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="subtask-name">Sub Task Name</Label>
            <Input
              id="subtask-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subtask-status">Status</Label>
              <Input
                id="subtask-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Pending, Completed"
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
              {saving ? "Saving…" : initialSubTask ? "Update Sub Task" : "Create Sub Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Project List ====================
function ProjectList({
  projectList,
  towers,
  tasks,
  organizations = [],
  selectedOrgId = "",
  onSelectOrg,
  onCreate,
  onEdit,
  onDelete,
}: {
  projectList: ApiProject[];
  towers: ApiTower[];
  tasks: ApiTask[];
  organizations?: Organization[];
  selectedOrgId?: string;
  onSelectOrg?: (value: string) => void;
  onCreate: () => void;
  onEdit: (project: ApiProject) => void;
  onDelete: (project: ApiProject) => void;
}) {
  const navigate = useNavigate();

  // ✅ NEW: whichever organization the user selects is pinned to the top of the list,
  // without removing/reordering anything else beyond that.
  const sortedProjectList = useMemo(() => {
    if (!selectedOrgId) return projectList;
    const selectedId = Number(selectedOrgId);
    const matched = projectList.filter((p) => p.organizationId === selectedId);
    const rest = projectList.filter((p) => p.organizationId !== selectedId);
    return [...matched, ...rest];
  }, [projectList, selectedOrgId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">{projectList.length} projects in portfolio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {onSelectOrg && (
            <Select
              value={selectedOrgId || "all"}
              onValueChange={(value) => onSelectOrg(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏢 All organizations</SelectItem>
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
          )}
          <Button onClick={onCreate} className="w-full sm:w-auto shadow-sm">+ New Project</Button>
        </div>
      </div>

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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive bg-background/60 hover:bg-background/90 backdrop-blur-xs rounded-lg transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(project);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-xs truncate max-w-full">
                        🏢 {[project.organizationName || matchedOrg?.name, project.companyName].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs">
                    <p className="text-lg font-display font-bold">{pTowers.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Towers</p>
                  </div>
                  <div className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs">
                    <p className="text-lg font-display font-bold">{project.totalUnits}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Units</p>
                  </div>
                  <div className="rounded-lg bg-background/70 dark:bg-card/70 backdrop-blur-xs border border-border/50 p-2 shadow-2xs">
                    <p className="text-lg font-display font-bold">{pTasks.length}</p>
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
    </div>
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
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!project) return <div className="text-center py-12">Project not found</div>;

  const isDirect = project.hierarchyMode === "direct_task";
  const pTowers = towers.filter((t) => t.projectId === project.id);
  const pTasks = tasks.filter((t) => t.projectId === project.id);
  const pFloors = floors.filter((f) => f.projectId === project.id);
  const pUnits = units.filter((u) => u.projectId === project.id);

  // Flow Interactive Selection States
  const [activeTowerId, setActiveTowerId] = useState<number | null>(() => pTowers[0]?.id ?? null);
  const [activeFloorId, setActiveFloorId] = useState<number | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<number | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);
  const [activeSubTaskId, setActiveSubTaskId] = useState<number | null>(null);

  // Flow View Mode & Expandable Tree states
  const [flowMode, setFlowMode] = useState<"cascading" | "tree">("cascading");
  const [expandedTowers, setExpandedTowers] = useState<Record<number, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});
  const [expandedChecklists, setExpandedChecklists] = useState<Record<number, boolean>>({});

  // Dynamic quick-add states
  const [newChecklistName, setNewChecklistName] = useState("");
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const [newSubTaskName, setNewSubTaskName] = useState("");
  const [creatingSubTask, setCreatingSubTask] = useState(false);
  const [updatingSubTaskId, setUpdatingSubTaskId] = useState<number | null>(null);

  // 1. Auto-sync Active Tower
  useEffect(() => {
    if (pTowers.length > 0 && (!activeTowerId || !pTowers.some((t) => t.id === activeTowerId))) {
      setActiveTowerId(pTowers[0].id);
    }
  }, [pTowers, activeTowerId]);

  const selectedTower = useMemo(
    () => pTowers.find((t) => t.id === activeTowerId) || pTowers[0],
    [pTowers, activeTowerId]
  );

  // 2. Auto-sync Active Floor
  const selectedTowerFloors = useMemo(() => {
    if (!selectedTower) return [];
    return floors
      .filter((f) => f.towerId === selectedTower.id)
      .sort((a, b) => a.number - b.number);
  }, [floors, selectedTower]);

  useEffect(() => {
    if (selectedTowerFloors.length > 0) {
      if (!activeFloorId || !selectedTowerFloors.some((f) => f.id === activeFloorId)) {
        setActiveFloorId(selectedTowerFloors[0].id);
      }
    } else {
      setActiveFloorId(null);
    }
  }, [selectedTowerFloors, activeFloorId]);

  const selectedFloor = useMemo(
    () => selectedTowerFloors.find((f) => f.id === activeFloorId) || selectedTowerFloors[0],
    [selectedTowerFloors, activeFloorId]
  );

  // 3. Auto-sync Active Unit
  const selectedFloorUnits = useMemo(() => {
    if (!selectedFloor) return [];
    return units.filter((u) => u.floorId === selectedFloor.id);
  }, [units, selectedFloor]);

  useEffect(() => {
    if (selectedFloorUnits.length > 0) {
      if (!activeUnitId || !selectedFloorUnits.some((u) => u.id === activeUnitId)) {
        setActiveUnitId(selectedFloorUnits[0].id);
      }
    } else {
      setActiveUnitId(null);
    }
  }, [selectedFloorUnits, activeUnitId]);

  const selectedUnit = useMemo(
    () => selectedFloorUnits.find((u) => u.id === activeUnitId) || selectedFloorUnits[0],
    [selectedFloorUnits, activeUnitId]
  );

  // 4. Auto-sync Active Task:
  // If unit selected, search unit tasks; otherwise search floor tasks; fallback to tower tasks.
  // Prioritizes parent tasks (tasks with subtasks or top-level tasks) so main work packages appear first.
  const selectedUnitTasks = useMemo(() => {
    let list: ApiTask[] = [];
    if (selectedUnit) {
      const uTasks = tasks.filter((t) => t.unitId === selectedUnit.id);
      if (uTasks.length > 0) list = uTasks;
    }
    if (list.length === 0 && selectedFloor) {
      list = tasks.filter((t) => t.floorId === selectedFloor.id);
    }
    if (list.length === 0 && selectedTower) {
      list = tasks.filter((t) => t.towerId === selectedTower.id);
    }

    return [...list].sort((a, b) => {
      const aSubCount = (a.subtasks?.length || 0) + tasks.filter((t) => t.parentId === a.id).length;
      const bSubCount = (b.subtasks?.length || 0) + tasks.filter((t) => t.parentId === b.id).length;
      if (aSubCount > 0 && bSubCount === 0) return -1;
      if (bSubCount > 0 && aSubCount === 0) return 1;
      return a.id - b.id;
    });
  }, [tasks, selectedUnit, selectedFloor, selectedTower]);

  useEffect(() => {
    if (selectedUnitTasks.length > 0) {
      if (!activeTaskId || !selectedUnitTasks.some((t) => t.id === activeTaskId)) {
        setActiveTaskId(selectedUnitTasks[0].id);
      }
    } else {
      setActiveTaskId(null);
    }
  }, [selectedUnitTasks, activeTaskId]);

  const selectedTask = useMemo(
    () => selectedUnitTasks.find((t) => t.id === activeTaskId) || selectedUnitTasks[0],
    [selectedUnitTasks, activeTaskId]
  );

  // 5. Auto-sync Active Checklist:
  // Combines custom checklists from checklistsApi AND automated task inspection items on the task
  const selectedTaskChecklists = useMemo(() => {
    if (!selectedTask) return [];

    const map = new Map<number, any>();

    // 1. Checklists from checklistsApi table (for this task or its parent task)
    checklists
      .filter((c) => c.taskId === selectedTask.id || (selectedTask.parentId && c.taskId === selectedTask.parentId))
      .forEach((c) => map.set(c.id, c));

    // 2. Inspection checklist items directly on the task
    (selectedTask.checklist || []).forEach((ci: any, idx: number) => {
      const id = ci.id ? -Math.abs(ci.id) : -(idx + 1000);
      map.set(id, {
        id,
        name: ci.title,
        status: ci.completed ? "completed" : "pending",
        progress: ci.completed ? 100 : 0,
        taskId: selectedTask.id,
        unitId: selectedTask.unitId,
        floorId: selectedTask.floorId,
        towerId: selectedTask.towerId,
        projectId: selectedTask.projectId,
        isTaskChecklistItem: true,
        rawItem: ci,
      });
    });

    // 3. Fallback to parent task's checklist items if leaf task has none
    if (map.size === 0 && selectedTask.parentId) {
      const parentTask = tasks.find((t) => t.id === selectedTask.parentId);
      if (parentTask && parentTask.checklist?.length) {
        parentTask.checklist.forEach((ci: any, idx: number) => {
          const id = ci.id ? -Math.abs(ci.id) : -(idx + 2000);
          map.set(id, {
            id,
            name: ci.title,
            status: ci.completed ? "completed" : "pending",
            progress: ci.completed ? 100 : 0,
            taskId: parentTask.id,
            unitId: parentTask.unitId,
            floorId: parentTask.floorId,
            towerId: parentTask.towerId,
            projectId: parentTask.projectId,
            isTaskChecklistItem: true,
            rawItem: ci,
          });
        });
      }
    }

    return Array.from(map.values());
  }, [checklists, selectedTask, tasks]);

  useEffect(() => {
    if (selectedTaskChecklists.length > 0) {
      if (!activeChecklistId || !selectedTaskChecklists.some((c) => c.id === activeChecklistId)) {
        setActiveChecklistId(selectedTaskChecklists[0].id);
      }
    } else {
      setActiveChecklistId(null);
    }
  }, [selectedTaskChecklists, activeChecklistId]);

  const selectedChecklist = useMemo(
    () => selectedTaskChecklists.find((c) => c.id === activeChecklistId) || selectedTaskChecklists[0],
    [selectedTaskChecklists, activeChecklistId]
  );

  // 6. SubTasks under Active Task & Checklist:
  // Subtasks are selected directly from the task OR from the checklist (if checklist is selected)
  // Even if no checklist is selected, subtasks are ALWAYS selected from the task
  const selectedChecklistSubTasks = useMemo(() => {
    if (!selectedTask) return [];

    const map = new Map<number, any>();

    const addSubTask = (item: any, parentTaskId: number) => {
      map.set(item.id, {
        id: item.id,
        name: item.title || item.name,
        status: item.status || "not_started",
        progress: item.progress ?? 0,
        priority: item.priority || "medium",
        startDate: item.startDate || item.start_date,
        endDate: item.endDate || item.end_date,
        taskId: parentTaskId,
        checklistId: item.checklistId ?? null,
        unitId: item.unitId,
        floorId: item.floorId,
        towerId: item.towerId,
        projectId: item.projectId,
      });
    };

    // 1. Direct subtasks on the task object (from TaskSerializer / MPP schedule)
    (selectedTask.subtasks || []).forEach((st: any) => addSubTask(st, selectedTask.id));

    // 2. Child tasks in tasks list where parentId === selectedTask.id
    tasks
      .filter((t) => t.parentId === selectedTask.id)
      .forEach((ct: any) => addSubTask(ct, selectedTask.id));

    // 3. Subtasks from subTasks API table matching this task
    subTasks
      .filter((s) => s.taskId === selectedTask.id)
      .forEach((s) => map.set(s.id, s));

    // 4. If a specific checklist is selected, also query subtasks by checklistId
    if (selectedChecklist && !selectedChecklist.isTaskChecklistItem) {
      subTasks
        .filter((s) => s.checklistId === selectedChecklist.id)
        .forEach((s) => map.set(s.id, s));
    }

    // 5. Fallback for leaf tasks: if selectedTask itself has 0 child tasks but has a parent task,
    // load the parent task's subtasks (the sibling work items in this slab / package)
    if (map.size === 0 && selectedTask.parentId) {
      const parentTask = tasks.find((t) => t.id === selectedTask.parentId);
      if (parentTask) {
        (parentTask.subtasks || []).forEach((st: any) => addSubTask(st, parentTask.id));
        tasks
          .filter((t) => t.parentId === parentTask.id)
          .forEach((ct: any) => addSubTask(ct, parentTask.id));
        subTasks
          .filter((s) => s.taskId === parentTask.id)
          .forEach((s) => map.set(s.id, s));
      }
    }

    return Array.from(map.values());
  }, [selectedTask, tasks, subTasks, selectedChecklist]);

  // 7. Auto-sync Active SubTask
  useEffect(() => {
    if (selectedChecklistSubTasks.length > 0) {
      if (!activeSubTaskId || !selectedChecklistSubTasks.some((s) => s.id === activeSubTaskId)) {
        setActiveSubTaskId(selectedChecklistSubTasks[0].id);
      }
    } else {
      setActiveSubTaskId(null);
    }
  }, [selectedChecklistSubTasks, activeSubTaskId]);

  const selectedSubTask = useMemo(
    () => selectedChecklistSubTasks.find((s) => s.id === activeSubTaskId) || selectedChecklistSubTasks[0],
    [selectedChecklistSubTasks, activeSubTaskId]
  );

  // Tree Expand / Collapse Toggles
  const toggleExpandTower = (id: number) => {
    setExpandedTowers((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleExpandFloor = (id: number) => {
    setExpandedFloors((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleExpandUnit = (id: number) => {
    setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleExpandTask = (id: number) => {
    setExpandedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleExpandChecklist = (id: number) => {
    setExpandedChecklists((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Jump scroll helper for Stepper breadcrumb pills
  const scrollToStage = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Dynamic SubTask Toggle
  const handleToggleSubTask = async (st: any) => {
    setUpdatingSubTaskId(st.id);
    const isCompleted = st.status === "completed";
    const nextStatus = isCompleted ? "pending" : "completed";
    const nextProgress = isCompleted ? 0 : 100;
    try {
      if (tasks.some((t) => t.id === st.id)) {
        await tasksApi.update(st.id, {
          status: isCompleted ? "not_started" : "completed",
          progress: nextProgress,
        });
      } else {
        await subTasksApi.update(st.id, {
          name: st.name,
          status: nextStatus,
          progress: nextProgress,
          checklistId: st.checklistId,
          taskId: st.taskId,
          unitId: st.unitId,
          floorId: st.floorId,
          towerId: st.towerId,
          projectId: st.projectId,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
        queryClient.invalidateQueries({ queryKey: ["checklists"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast({
        title: nextStatus === "completed" ? "Sub Task Completed ✓" : "Sub Task Reopened",
        description: `"${st.name}" marked as ${nextStatus}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err?.message || "Could not update sub task",
      });
    } finally {
      setUpdatingSubTaskId(null);
    }
  };

  // Dynamic Quick Add Checklist
  const handleQuickAddChecklist = async () => {
    if (!newChecklistName.trim() || !selectedTask) return;
    setCreatingChecklist(true);
    try {
      await checklistsApi.create({
        name: newChecklistName.trim(),
        taskId: selectedTask.id,
        unitId: selectedUnit?.id,
        floorId: selectedFloor?.id,
        towerId: selectedTower?.id,
        projectId: project.id,
        status: "pending",
        progress: 0,
      });
      setNewChecklistName("");
      await queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({
        title: "Checklist Created",
        description: `Added "${newChecklistName.trim()}" to task ${selectedTask.title}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: err?.message || "Could not create checklist",
      });
    } finally {
      setCreatingChecklist(false);
    }
  };

  // Dynamic Quick Add SubTask
  const handleQuickAddSubTask = async () => {
    if (!newSubTaskName.trim()) return;
    setCreatingSubTask(true);
    try {
      await subTasksApi.create({
        name: newSubTaskName.trim(),
        checklistId: selectedChecklist && !selectedChecklist.isTaskChecklistItem ? selectedChecklist.id : undefined,
        taskId: selectedTask?.id,
        unitId: selectedUnit?.id,
        floorId: selectedFloor?.id,
        towerId: selectedTower?.id,
        projectId: project.id,
        status: "pending",
        progress: 0,
      });
      setNewSubTaskName("");
      await queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Sub Task Created",
        description: `Added "${newSubTaskName.trim()}" to task ${selectedTask?.title}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: err?.message || "Could not create sub task",
      });
    } finally {
      setCreatingSubTask(false);
    }
  };

  // Dynamic Delete Checklist
  const handleDeleteChecklistInFlow = async (chk: any) => {
    if (chk.isTaskChecklistItem) {
      toast({
        title: "Task Inspection Checkpoint",
        description: "This checkpoint is generated from the task schedule inspection scope.",
      });
      return;
    }
    if (!window.confirm(`Delete checklist "${chk.name}" and all its sub tasks?`)) return;
    try {
      await checklistsApi.remove(chk.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checklists"] }),
        queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
      ]);
      toast({
        title: "Checklist Deleted",
        description: `Removed "${chk.name}"`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err?.message || "Could not delete checklist",
      });
    }
  };

  // Dynamic Delete SubTask
  const handleDeleteSubTaskInFlow = async (st: any) => {
    if (!window.confirm(`Delete sub task "${st.name}"?`)) return;
    try {
      if (tasks.some((t) => t.id === st.id)) {
        await tasksApi.remove(st.id);
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } else {
        await subTasksApi.remove(st.id);
        await queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      }
      toast({
        title: "Sub Task Deleted",
        description: `Removed "${st.name}"`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err?.message || "Could not delete sub task",
      });
    }
  };

  // Tree mode helper to render any task branch (used for both floor-level and unit-level tasks)
  const renderTreeTaskBranch = (task: any) => {
    const isTaskExpanded = expandedTasks[task.id] ?? false;
    const taskChecklistsList = checklists.filter((c) => c.taskId === task.id);
    const taskDirectSubTasks = [
      ...(task.subtasks || []).map((st: any) => ({
        id: st.id,
        name: st.title || st.name,
        status: st.status || "not_started",
      })),
      ...tasks.filter((t) => t.parentId === task.id).map((ct) => ({
        id: ct.id,
        name: ct.title,
        status: ct.status || "not_started",
      })),
    ];
    const totalSubItemsCount = taskChecklistsList.length + taskDirectSubTasks.length;

    return (
      <div key={task.id} className="border-l-2 border-indigo-500/30 pl-3 ml-2 space-y-1.5 py-0.5">
        <div
          className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors text-xs"
          onClick={() => toggleExpandTask(task.id)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-muted-foreground shrink-0">
              {isTaskExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            <CheckSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
              {task.title}
            </span>
          </div>
          <Badge variant="outline" className="text-[9px] h-3.5 shrink-0">
            {taskChecklistsList.length > 0 ? `${taskChecklistsList.length} checklists` : `${taskDirectSubTasks.length} sub tasks`}
          </Badge>
        </div>

        {/* Nested Checklists and Subtasks Branch */}
        {isTaskExpanded && (
          <div className="border-l-2 border-indigo-500/40 pl-3 ml-2 space-y-1.5 pt-1">
            {totalSubItemsCount === 0 ? (
              <p className="text-[11px] text-muted-foreground py-0.5">
                No checklists or sub tasks in this task.
              </p>
            ) : (
              <>
                {taskChecklistsList.map((chk) => {
                  const isChkExpanded = expandedChecklists[chk.id] ?? false;
                  const chkSubTasksList = subTasks.filter((s) => s.checklistId === chk.id);

                  return (
                    <div key={chk.id} className="border-l-2 border-violet-500/30 pl-3 ml-2 space-y-1 py-0.5">
                      <div
                        className="flex items-center justify-between p-1.5 rounded bg-background border border-border/80 cursor-pointer hover:border-violet-500/40 transition-colors text-xs"
                        onClick={() => toggleExpandChecklist(chk.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-muted-foreground">
                            {isChkExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                          <ListChecks className="h-3.5 w-3.5 text-violet-500" />
                          <span className="font-medium text-foreground">{chk.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {chkSubTasksList.length} sub tasks
                        </span>
                      </div>

                      {isChkExpanded && (
                        <div className="border-l-2 border-violet-500/40 pl-3 ml-2 space-y-1 pt-1">
                          {chkSubTasksList.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground py-0.5">No sub tasks.</p>
                          ) : (
                            chkSubTasksList.map((st) => {
                              const isDone = st.status === "completed";
                              return (
                                <div
                                  key={st.id}
                                  className="flex items-center justify-between p-1.5 rounded bg-card border border-border/60 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSubTask(st)}
                                      className={`h-4 w-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                                        isDone
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : "border-border hover:border-violet-500 bg-background"
                                      }`}
                                    >
                                      {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                                    </button>
                                    <span className={isDone ? "line-through text-muted-foreground" : "text-foreground"}>
                                      {st.name}
                                    </span>
                                  </div>
                                  <Badge variant={isDone ? "default" : "outline"} className="text-[9px] h-3.5">
                                    {st.status || "Pending"}
                                  </Badge>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Direct Schedule Subtasks from MPP */}
                {taskDirectSubTasks.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    {taskDirectSubTasks.map((st) => {
                      const isDone = st.status === "completed";
                      return (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-1.5 rounded bg-card border border-border/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSubTask(st)}
                              className={`h-4 w-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                                isDone
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-border hover:border-violet-500 bg-background"
                              }`}
                            >
                              {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>
                            <span className={isDone ? "line-through text-muted-foreground" : "text-foreground"}>
                              {st.name}
                            </span>
                          </div>
                          <Badge variant={isDone ? "default" : "outline"} className="text-[9px] h-3.5">
                            {st.status || "Pending"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const matchedOrg = organizations?.find(
    (o: Organization) =>
      o.id === project.organizationId ||
      (project.organizationName && o.name.toLowerCase() === project.organizationName.toLowerCase())
  );
  const detailOrgLogo = resolveImageUrl(project.organizationLogo || matchedOrg?.logo);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link to="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Units", value: project.totalUnits },
          { label: isDirect ? "Direct Mode" : "Towers", value: isDirect ? "—" : pTowers.length },
          { label: "Tasks", value: pTasks.length },
          { label: "Progress", value: `${project.progress}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={isDirect ? "tasks" : "flow"}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-muted/60 p-1">
            {!isDirect && (
              <TabsTrigger value="flow" className="gap-1.5 font-semibold">
                <GitFork className="h-4 w-4 text-primary" />
                Flow
              </TabsTrigger>
            )}
            {!isDirect && (
              <TabsTrigger value="towers" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                Towers ({pTowers.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="tasks" className="gap-1.5">
              <CheckSquare className="h-4 w-4" />
              Tasks ({pTasks.length})
            </TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
          </TabsList>

          {isDirect ? (
            <NewTaskDialog
              lockedProjectId={project.id}
              trigger={<Button size="sm">+ New Task</Button>}
              onCreated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
            />
          ) : (
            <Button size="sm" onClick={onCreateTower}>+ New Tower</Button>
          )}
        </div>

        {/* ================= COMPLETE DYNAMIC FLOW ================= */}
        {!isDirect && (
          <TabsContent value="flow" className="mt-4 space-y-5 animate-in fade-in-50 duration-300">
            {/* Flow Header with Pipeline Breadcrumbs & View Toggle */}
            <div className="bg-card/75 backdrop-blur-md border border-border rounded-2xl p-4 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                    <GitFork className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-1.5">
                      <span>Flow Pipeline</span>
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Cascading construction flow: Project ➔ Tower ➔ Floor ➔ Unit ➔ Task ➔ Checklist ➔ Sub Task
                    </p>
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl self-start sm:self-center">
                  <Button
                    size="sm"
                    variant={flowMode === "cascading" ? "secondary" : "ghost"}
                    className="h-7 text-xs gap-1 px-2.5 font-medium shadow-2xs"
                    onClick={() => setFlowMode("cascading")}
                  >
                    <Split className="h-3.5 w-3.5" />
                    Cascading Flow
                  </Button>
                  <Button
                    size="sm"
                    variant={flowMode === "tree" ? "secondary" : "ghost"}
                    className="h-7 text-xs gap-1 px-2.5 font-medium shadow-2xs"
                    onClick={() => setFlowMode("tree")}
                  >
                    <ListTree className="h-3.5 w-3.5" />
                    Full Flow Tree
                  </Button>
                </div>
              </div>

              {/* Complete 7-Stage Interactive Stepper Breadcrumb Bar */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none text-xs">
                {/* 1. Project */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-towers")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border/80 shrink-0 font-medium text-foreground shadow-2xs hover:border-primary/50 transition-colors cursor-pointer"
                  title="Project Level"
                >
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>{project.name}</span>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 2. Tower */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-towers")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedTower
                      ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-2xs hover:bg-primary/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Towers"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  <span>{selectedTower ? selectedTower.name : "Select Tower"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30">
                    {pTowers.length}
                  </Badge>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 3. Floor */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-floors")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedFloor
                      ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-2xs hover:bg-primary/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Floors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{selectedFloor ? (selectedFloor.name || `Floor ${selectedFloor.number}`) : "Select Floor"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30">
                    {selectedTowerFloors.length}
                  </Badge>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 4. Unit */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-units")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedUnit
                      ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-2xs hover:bg-primary/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Units"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  <span>{selectedUnit ? `Unit ${selectedUnit.unitNumber}` : selectedFloorUnits.length > 0 ? "Select Unit" : "Floor Scope"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30">
                    {selectedFloorUnits.length}
                  </Badge>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 5. Task */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-tasks")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedTask
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs hover:bg-emerald-500/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Tasks"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>{selectedTask ? selectedTask.title : "Select Task"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-emerald-500/30">
                    {selectedUnitTasks.length}
                  </Badge>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 6. Checklist */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-checklists")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedChecklist
                      ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs hover:bg-indigo-500/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Checklists"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>{selectedChecklist ? selectedChecklist.name : selectedTaskChecklists.length > 0 ? "Select Checklist" : "Task Scope"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-indigo-500/30">
                    {selectedTaskChecklists.length}
                  </Badge>
                </button>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* 7. Sub Task */}
                <button
                  type="button"
                  onClick={() => scrollToStage("flow-stage-subtasks")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium cursor-pointer ${
                    selectedSubTask
                      ? "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400 font-semibold shadow-2xs hover:bg-violet-500/15"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Click to jump to Sub Tasks"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{selectedSubTask ? selectedSubTask.name : `${selectedChecklistSubTasks.length} Sub Tasks`}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-violet-500/30">
                    {selectedChecklistSubTasks.length}
                  </Badge>
                </button>
              </div>
            </div>

            {/* FLOW VIEW 1: CASCADING PIPELINE FLOW */}
            {flowMode === "cascading" ? (
              <div className="space-y-6">
                {/* ================= LEVEL 1: TOWERS ================= */}
                <div id="flow-stage-towers" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <h4 className="font-display font-bold text-sm text-foreground">
                        Towers in {project.name}
                      </h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {pTowers.length} Total
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Click a tower to flow into its floors
                    </span>
                  </div>

                  {pTowers.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-sm text-muted-foreground text-center">
                        No towers added yet. Click "+ New Tower" to begin building the flow.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {pTowers.map((tower, idx) => {
                        const isSelected = selectedTower?.id === tower.id;
                        const towerFloorsCount = floors.filter((f) => f.towerId === tower.id).length;
                        return (
                          <Card
                            key={tower.id}
                            className={`cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md select-none overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 ${
                              isSelected
                                ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                                : "hover:border-primary/40 bg-card"
                            }`}
                            style={{ animationDelay: `${idx * 50}ms` }}
                            onClick={() => {
                              setActiveTowerId(tower.id);
                              setActiveFloorId(null);
                              setActiveUnitId(null);
                              setActiveTaskId(null);
                              setActiveChecklistId(null);
                            }}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-muted text-muted-foreground"
                                  }`}>
                                    <Building2 className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h5 className="font-display font-bold text-base text-foreground">
                                      {tower.name}
                                    </h5>
                                    <p className="text-xs text-muted-foreground">
                                      {tower.totalFloors} Floors planned · {towerFloorsCount} mapped
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] capitalize">
                                  {tower.status}
                                </Badge>
                              </div>

                              <div className="space-y-1 pt-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Progress</span>
                                  <span className="font-bold text-foreground">{tower.progress}%</span>
                                </div>
                                <Progress value={tower.progress} className="h-2" />
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                <span className={`text-[11px] font-medium flex items-center gap-1 ${
                                  isSelected ? "text-primary font-bold" : "text-muted-foreground"
                                }`}>
                                  {isSelected ? "Active Flow Target ✓" : "Click to select ↘"}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${project.id}/towers/${tower.id}`);
                                  }}
                                  title="Open dedicated tower view"
                                >
                                  Open Page ↗
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Animated Flow Connector Arrow */}
                {selectedTower && (
                  <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in zoom-in duration-300">
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold shadow-2xs">
                      <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                      <span>Flowing into {selectedTower.name} Floors</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent flex-1" />
                  </div>
                )}

                {/* ================= LEVEL 2: FLOORS ================= */}
                {selectedTower && (
                  <div id="flow-stage-floors" className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                          2
                        </div>
                        <h4 className="font-display font-bold text-sm text-foreground">
                          Floors under {selectedTower.name}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedTowerFloors.length} Floors
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Click a floor to flow into its units
                      </span>
                    </div>

                    {selectedTowerFloors.length === 0 ? (
                      <Card className="bg-muted/30">
                        <CardContent className="p-6 text-sm text-muted-foreground text-center">
                          No floors mapped yet under {selectedTower.name}.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {selectedTowerFloors.map((floor, idx) => {
                          const isSelected = selectedFloor?.id === floor.id;
                          const floorUnitCount = units.filter((u) => u.floorId === floor.id).length;
                          return (
                            <Card
                              key={floor.id}
                              className={`cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md select-none overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 ${
                                isSelected
                                  ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                                  : "hover:border-primary/40 bg-card"
                              }`}
                              style={{ animationDelay: `${idx * 30}ms` }}
                              onClick={() => {
                                setActiveFloorId(floor.id);
                                setActiveUnitId(null);
                                setActiveTaskId(null);
                                setActiveChecklistId(null);
                              }}
                            >
                              <CardContent className="p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span className="font-display font-bold text-sm text-foreground">
                                      {floor.name || `Floor ${floor.number}`}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    #{floor.number}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Units</span>
                                  <span className="font-bold text-foreground">{floorUnitCount}</span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Progress</span>
                                    <span>{floor.progress}%</span>
                                  </div>
                                  <Progress value={floor.progress} className="h-1.5" />
                                </div>

                                <div className="pt-1 text-[10px] text-center font-medium">
                                  <span className={isSelected ? "text-primary font-bold" : "text-muted-foreground"}>
                                    {isSelected ? "Active Floor ✓" : "Select ↘"}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Animated Flow Connector Arrow */}
                {selectedFloor && (
                  <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in zoom-in duration-300">
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold shadow-2xs">
                      <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                      <span>Flowing into {selectedFloor.name} Units</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent flex-1" />
                  </div>
                )}

                {/* ================= LEVEL 3: UNITS ================= */}
                {selectedFloor && (
                  <div id="flow-stage-units" className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                          3
                        </div>
                        <h4 className="font-display font-bold text-sm text-foreground">
                          Units on {selectedFloor.name}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedFloorUnits.length} Units
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Click a unit to flow into its tasks
                      </span>
                    </div>

                    {selectedFloorUnits.length === 0 ? (
                      <Card className="bg-muted/20 border-dashed border-border/80">
                        <CardContent className="p-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary shrink-0" />
                            <span>
                              <strong>{selectedFloor.name}</strong> is an open structural level ({selectedUnitTasks.length} tasks). No residential units are partitioned on this level.
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">
                            Direct Floor Scope
                          </Badge>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {selectedFloorUnits.map((unit, idx) => {
                          const isSelected = selectedUnit?.id === unit.id;
                          const unitTasksCount = tasks.filter((t) => t.unitId === unit.id).length;
                          return (
                            <Card
                              key={unit.id}
                              className={`cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md select-none overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 ${
                                isSelected
                                  ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                                  : "hover:border-primary/40 bg-card"
                              }`}
                              style={{ animationDelay: `${idx * 30}ms` }}
                              onClick={() => {
                                setActiveUnitId(unit.id);
                                setActiveTaskId(null);
                                setActiveChecklistId(null);
                              }}
                            >
                              <CardContent className="p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-display font-bold text-sm text-foreground">
                                    Unit {unit.unitNumber}
                                  </span>
                                  <Badge
                                    variant={
                                      unit.status === "available"
                                        ? "outline"
                                        : unit.status === "booked"
                                        ? "secondary"
                                        : "default"
                                    }
                                    className="text-[9px] px-1 py-0 h-4 capitalize"
                                  >
                                    {unit.status}
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{unit.type || "2BHK"}</span>
                                  <span>{unit.areaSqFt} sq ft</span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Tasks</span>
                                    <span className="font-bold text-foreground">{unitTasksCount}</span>
                                  </div>
                                  <Progress value={unit.progress} className="h-1.5" />
                                </div>

                                <div className="pt-1 text-[10px] text-center font-medium">
                                  <span className={isSelected ? "text-primary font-bold" : "text-muted-foreground"}>
                                    {isSelected ? "Active Unit ✓" : "Select ↘"}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Animated Flow Connector Arrow */}
                {(selectedUnit || (selectedFloor && selectedFloorUnits.length === 0)) && (
                  <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in zoom-in duration-300">
                    <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-2xs">
                      <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                      <span>Flowing into {selectedUnit ? `Unit ${selectedUnit.unitNumber}` : selectedFloor?.name} Tasks</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent flex-1" />
                  </div>
                )}

                {/* ================= LEVEL 4: TASKS ================= */}
                {(selectedUnit || selectedFloor) && (
                  <div id="flow-stage-tasks" className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                          4
                        </div>
                        <h4 className="font-display font-bold text-sm text-foreground">
                          Tasks {selectedUnit ? `under Unit ${selectedUnit.unitNumber}` : `on ${selectedFloor?.name || "Floor"}`}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedUnitTasks.length} Tasks
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <NewTaskDialog
                          lockedProjectId={project.id}
                          trigger={
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Plus className="h-3 w-3" />
                              New Task
                            </Button>
                          }
                          onCreated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
                        />
                      </div>
                    </div>

                    {selectedUnitTasks.length === 0 ? (
                      <Card className="bg-muted/30">
                        <CardContent className="p-6 text-sm text-muted-foreground text-center space-y-2">
                          <p>No tasks directly mapped to {selectedUnit ? `Unit ${selectedUnit.unitNumber}` : selectedFloor?.name} yet.</p>
                          <NewTaskDialog
                            lockedProjectId={project.id}
                            trigger={<Button size="sm">+ Create First Task</Button>}
                            onCreated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
                          />
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedUnitTasks.map((task, idx) => {
                          const isSelected = selectedTask?.id === task.id;
                          const taskChecklistsCount = checklists.filter((c) => c.taskId === task.id).length;
                          return (
                            <Card
                              key={task.id}
                              className={`cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md select-none overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 ${
                                isSelected
                                  ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5 shadow-sm"
                                  : "hover:border-emerald-500/40 bg-card"
                              }`}
                              style={{ animationDelay: `${idx * 40}ms` }}
                              onClick={() => {
                                setActiveTaskId(task.id);
                                setActiveChecklistId(null);
                              }}
                            >
                              <CardContent className="p-3.5 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div
                                      className={`h-3 w-3 rounded-full shrink-0 mt-1 ${
                                        task.status === "completed"
                                          ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                                          : task.status === "in_progress"
                                          ? "bg-amber-500 ring-2 ring-amber-500/20"
                                          : task.status === "delayed"
                                          ? "bg-rose-500 ring-2 ring-rose-500/20"
                                          : "bg-muted-foreground/40"
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {task.department || "General"} · {task.phase || "Construction"}
                                      </p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                                    {task.priority || "Normal"}
                                  </Badge>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Checklists: <strong className="text-foreground">{taskChecklistsCount}</strong></span>
                                    <span className="font-bold text-foreground">{task.progress}%</span>
                                  </div>
                                  <Progress value={task.progress} className="h-1.5" />
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                  <span className={`text-[11px] font-medium flex items-center gap-1 ${
                                    isSelected ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"
                                  }`}>
                                    {isSelected ? "Active Task Target ✓" : "Click to select ↘"}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedUnit) {
                                        navigate(
                                          `/projects/${project.id}/towers/${selectedTower.id}/floors/${selectedFloor.id}/units/${selectedUnit.id}/tasks/${task.id}`
                                        );
                                      } else {
                                        navigate(`/tasks`);
                                      }
                                    }}
                                  >
                                    Open Page ↗
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Animated Flow Connector Arrow */}
                {selectedTask && (
                  <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in zoom-in duration-300">
                    <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-2xs">
                      <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                      <span>Flowing into "{selectedTask.title}" Checklists</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent flex-1" />
                  </div>
                )}

                {/* ================= LEVEL 5: CHECKLISTS ================= */}
                {selectedTask && (
                  <div id="flow-stage-checklists" className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                          5
                        </div>
                        <h4 className="font-display font-bold text-sm text-foreground">
                          Checklists for "{selectedTask.title}"
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedTaskChecklists.length} Checklists
                        </Badge>
                      </div>

                      {/* Quick Add Checklist Input */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <Input
                          placeholder="New checklist name..."
                          value={newChecklistName}
                          onChange={(e) => setNewChecklistName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickAddChecklist();
                            }
                          }}
                          className="h-8 text-xs w-48 sm:w-56"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={handleQuickAddChecklist}
                          disabled={creatingChecklist || !newChecklistName.trim()}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {creatingChecklist ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </div>

                    {selectedTaskChecklists.length === 0 ? (
                      <Card className="bg-muted/30">
                        <CardContent className="p-6 text-sm text-muted-foreground text-center">
                          No checklists mapped for this task yet. Type a name above and click <strong>Add</strong> to create one.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedTaskChecklists.map((chk, idx) => {
                          const isSelected = selectedChecklist?.id === chk.id;
                          const chkSubTasksCount = subTasks.filter((s) => s.checklistId === chk.id).length;
                          return (
                            <Card
                              key={chk.id}
                              className={`cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md select-none overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 ${
                                isSelected
                                  ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-500/5 shadow-sm"
                                  : "hover:border-indigo-500/40 bg-card"
                              }`}
                              style={{ animationDelay: `${idx * 40}ms` }}
                              onClick={() => setActiveChecklistId(chk.id)}
                            >
                              <CardContent className="p-3.5 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ListChecks className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <span className="font-display font-bold text-sm text-foreground truncate">
                                      {chk.name}
                                    </span>
                                  </div>
                                  <Badge
                                    variant={chk.status === "completed" ? "default" : "secondary"}
                                    className="text-[9px] px-1 py-0 h-4 capitalize"
                                  >
                                    {chk.status || "Pending"}
                                  </Badge>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Sub Tasks: <strong className="text-foreground">{chkSubTasksCount}</strong></span>
                                    <span className="font-bold text-foreground">{chk.progress}%</span>
                                  </div>
                                  <Progress value={chk.progress} className="h-1.5" />
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                  <span className={`text-[11px] font-medium flex items-center gap-1 ${
                                    isSelected ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-muted-foreground"
                                  }`}>
                                    {isSelected ? "Active Checklist Target ✓" : "Click to select ↘"}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteChecklistInFlow(chk);
                                      }}
                                      title="Delete Checklist"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedUnit) {
                                          navigate(
                                            `/projects/${project.id}/towers/${selectedTower.id}/floors/${selectedFloor.id}/units/${selectedUnit.id}/tasks/${selectedTask.id}/checklists/${chk.id}`
                                          );
                                        } else {
                                          toast({
                                            title: chk.name,
                                            description: `Checklist for ${selectedTask.title}`,
                                          });
                                        }
                                      }}
                                    >
                                      Open ↗
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Animated Flow Connector Arrow */}
                {(selectedTask || selectedChecklist) && selectedChecklistSubTasks.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in zoom-in duration-300">
                    <div className="h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-xs font-semibold shadow-2xs">
                      <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                      <span>Flowing into "{selectedTask?.title}" Sub Tasks</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent flex-1" />
                  </div>
                )}

                {/* ================= LEVEL 6: SUB TASKS ================= */}
                {(selectedTask || selectedChecklist) && (
                  <div id="flow-stage-subtasks" className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">
                          6
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-sm text-foreground">
                            Sub Tasks for "{selectedTask?.title}"
                            {selectedChecklist && !selectedChecklist.isTaskChecklistItem && (
                              <span className="text-muted-foreground font-normal text-xs ml-2">({selectedChecklist.name})</span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {selectedChecklist ? `Filtered by: "${selectedChecklist.name}"` : "Directly selected from Task work package"}
                            </span>
                            {selectedChecklist && (
                              <button
                                type="button"
                                onClick={() => setActiveChecklistId(null)}
                                className="text-primary hover:underline text-[11px] font-medium cursor-pointer"
                              >
                                (Show All Task Sub Tasks)
                              </button>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] ml-auto sm:ml-0">
                          {selectedChecklistSubTasks.filter((s) => s.status === "completed").length} / {selectedChecklistSubTasks.length} Completed
                        </Badge>
                      </div>

                      {/* Quick Add SubTask Input */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <Input
                          placeholder="New sub task name..."
                          value={newSubTaskName}
                          onChange={(e) => setNewSubTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickAddSubTask();
                            }
                          }}
                          className="h-8 text-xs w-48 sm:w-56"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                          onClick={handleQuickAddSubTask}
                          disabled={creatingSubTask || !newSubTaskName.trim()}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {creatingSubTask ? "Adding..." : "Add Sub Task"}
                        </Button>
                      </div>
                    </div>

                    {selectedChecklistSubTasks.length === 0 ? (
                      <Card className="bg-muted/30">
                        <CardContent className="p-6 text-sm text-muted-foreground text-center">
                          No sub tasks mapped for this task yet. Type a name above and click <strong>Add Sub Task</strong> to track individual items!
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {selectedChecklistSubTasks.map((st, idx) => {
                          const isDone = st.status === "completed";
                          const isUpdating = updatingSubTaskId === st.id;
                          const isSubTaskActive = selectedSubTask?.id === st.id;
                          return (
                            <div
                              key={st.id}
                              onClick={() => setActiveSubTaskId(st.id)}
                              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer animate-in fade-in-50 slide-in-from-bottom-2 ${
                                isSubTaskActive
                                  ? "ring-2 ring-violet-500 border-violet-500 bg-violet-500/5 shadow-xs"
                                  : isDone
                                  ? "bg-muted/30 border-border/60 text-muted-foreground hover:border-violet-500/30"
                                  : "bg-card border-border hover:border-violet-500/40 shadow-2xs"
                              }`}
                              style={{ animationDelay: `${idx * 30}ms` }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Interactive Completion Checkbox */}
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSubTask(st);
                                  }}
                                  className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                    isDone
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-border hover:border-violet-500 bg-background"
                                  }`}
                                  title={isDone ? "Mark Pending" : "Mark Completed"}
                                >
                                  {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                </button>

                                <span
                                  className={`text-sm select-none truncate ${
                                    isDone ? "line-through text-muted-foreground" : "font-medium text-foreground"
                                  }`}
                                >
                                  {st.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isSubTaskActive && (
                                  <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-600 dark:text-violet-400">
                                    Selected ✓
                                  </Badge>
                                )}
                                <Badge
                                  variant={isDone ? "default" : "outline"}
                                  className={`text-[10px] capitalize ${
                                    isDone
                                      ? "bg-emerald-600 text-white"
                                      : "border-violet-500/30 text-violet-600 dark:text-violet-400"
                                  }`}
                                >
                                  {st.status || "Pending"}
                                </Badge>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubTaskInFlow(st);
                                  }}
                                  title="Delete Sub Task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* FLOW VIEW 2: FULL EXPANDABLE FLOW TREE */
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                {pTowers.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground text-center">
                      No towers mapped yet for this project.
                    </CardContent>
                  </Card>
                ) : (
                  pTowers.map((tower) => {
                    const isExpanded = expandedTowers[tower.id] ?? true;
                    const towerFloorsList = floors
                      .filter((f) => f.towerId === tower.id)
                      .sort((a, b) => a.number - b.number);

                    return (
                      <Card key={tower.id} className="overflow-hidden border-border/80 shadow-xs">
                        <div
                          className="flex items-center justify-between p-4 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors select-none"
                          onClick={() => toggleExpandTower(tower.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground p-0"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-display font-bold text-base text-foreground">
                                {tower.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {towerFloorsList.length} Floors · {tower.progress}% Progress
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {tower.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projects/${project.id}/towers/${tower.id}`);
                              }}
                            >
                              Details ↗
                            </Button>
                          </div>
                        </div>

                        {/* Nested Floors Branch */}
                        {isExpanded && (
                          <div className="p-4 pt-2 border-t border-border/60 space-y-3 bg-card/60">
                            {towerFloorsList.length === 0 ? (
                              <p className="text-xs text-muted-foreground pl-10 py-2">
                                No floors mapped under this tower.
                              </p>
                            ) : (
                              towerFloorsList.map((floor) => {
                                const isFloorExpanded = expandedFloors[floor.id] ?? false;
                                const floorUnitsList = units.filter((u) => u.floorId === floor.id);

                                return (
                                  <div
                                    key={floor.id}
                                    className="border-l-2 border-primary/30 pl-4 ml-4 space-y-2 py-1"
                                  >
                                    <div
                                      className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                                      onClick={() => toggleExpandFloor(floor.id)}
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground">
                                          {isFloorExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Layers className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-sm text-foreground">
                                          {floor.name || `Floor ${floor.number}`}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-4">
                                          {floorUnitsList.length > 0 ? `${floorUnitsList.length} Units` : `${tasks.filter((t) => t.floorId === floor.id).length} Tasks`}
                                        </Badge>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">{floor.progress}%</span>
                                        <Progress value={floor.progress} className="h-1.5 w-16 hidden sm:flex" />
                                      </div>
                                    </div>

                                    {/* Nested Units or Floor Tasks Branch */}
                                    {isFloorExpanded && (
                                      <div className="border-l-2 border-border/80 pl-4 ml-4 space-y-2 pt-1">
                                        {floorUnitsList.length === 0 ? (
                                          (() => {
                                            const floorTasksList = tasks.filter((t) => t.floorId === floor.id);
                                            if (floorTasksList.length === 0) {
                                              return (
                                                <p className="text-xs text-muted-foreground py-1">
                                                  No units or tasks mapped on this floor.
                                                </p>
                                              );
                                            }
                                            return (
                                              <div className="space-y-1.5 pt-1">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground pb-1">
                                                  <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                                                  <span>Floor Level Tasks ({floorTasksList.length})</span>
                                                </div>
                                                {floorTasksList.map((task) => renderTreeTaskBranch(task))}
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          floorUnitsList.map((unit) => {
                                            const isUnitExpanded = expandedUnits[unit.id] ?? false;
                                            const unitTasksList = tasks.filter((t) => t.unitId === unit.id);

                                            return (
                                              <div
                                                key={unit.id}
                                                className="border-l-2 border-emerald-500/30 pl-3 ml-2 space-y-2 py-1"
                                              >
                                                <div
                                                  className="flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:border-primary/40 cursor-pointer transition-colors"
                                                  onClick={() => toggleExpandUnit(unit.id)}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground">
                                                      {isUnitExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                    </Button>
                                                    <Boxes className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="font-bold text-xs text-foreground">
                                                      Unit {unit.unitNumber}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                                      {unit.status}
                                                    </Badge>
                                                  </div>
                                                  <span className="text-[11px] text-muted-foreground">
                                                    {unitTasksList.length} tasks
                                                  </span>
                                                </div>

                                                {/* Nested Tasks Branch */}
                                                {isUnitExpanded && (
                                                  <div className="border-l-2 border-emerald-500/40 pl-3 ml-2 space-y-2 pt-1">
                                                    {unitTasksList.length === 0 ? (
                                                      <p className="text-[11px] text-muted-foreground py-1">
                                                        No tasks mapped to this unit.
                                                      </p>
                                                    ) : (
                                                      unitTasksList.map((task) => renderTreeTaskBranch(task))
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </TabsContent>
        )}

        {!isDirect && (
          <TabsContent value="towers" className="mt-4 space-y-4">
            {pTowers.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No towers mapped yet for this project.</CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pTowers.map((tower) => (
                  <Card
                    key={tower.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}/towers/${tower.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-bold">{tower.name}</h3>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary">{tower.status}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
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
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteTower(tower);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{tower.totalFloors} Floors</p>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{tower.progress}%</span>
                        </div>
                        <Progress value={tower.progress} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="tasks" className="mt-4">
          <div className="space-y-2">
            {pTasks.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No tasks mapped yet for this project.</CardContent>
              </Card>
            ) : isDirect ? (
              // ✅ Direct mode: reuse the full-featured row (chat, camera,
              // attachments, dependencies, assignee, checklist, comments,
              // hurdles, compliance)
              pTasks.map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              // Full-hierarchy mode: unchanged lightweight summary row
              pTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      task.status === "completed"
                        ? "bg-success"
                        : task.status === "in_progress"
                        ? "bg-warning"
                        : task.status === "delayed"
                        ? "bg-destructive"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.department} · {task.phase}
                    </p>
                  </div>
                  <Progress value={task.progress} className="h-1.5 w-20 hidden md:flex" />
                  <span className="text-xs font-medium">{task.progress}%</span>
                </div>
              ))
            )}
          </div>
        </TabsContent>

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
  floors,
  onBack,
  projectId,
  onCreateFloor,
  onEditFloor,
  onDeleteFloor,
}: {
  tower: ApiTower | undefined;
  floors: ApiFloor[];
  onBack: () => void;
  projectId: number;
  onCreateFloor: () => void;
  onEditFloor: (floor: ApiFloor) => void;
  onDeleteFloor: (floor: ApiFloor) => void;
}) {
  const navigate = useNavigate();

  if (!tower) return <div className="text-center py-12">Tower not found</div>;

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.number - b.number),
    [floors]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground font-medium">{tower.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{tower.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{tower.totalFloors} Floors</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-initial">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Project
          </Button>
          <Button onClick={onCreateFloor} className="flex-1 sm:flex-initial">+ New Floor</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{sortedFloors.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Floors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tower.progress}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      {sortedFloors.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No floors mapped yet for this tower.</CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFloors.map((floor) => (
            <Card
              key={floor.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${projectId}/towers/${tower.id}/floors/${floor.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold">Floor {floor.number}</h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{floor.status || "Active"}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditFloor(floor);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteFloor(floor);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{floor.name}</p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{floor.progress || 0}%</span>
                  </div>
                  <Progress value={floor.progress || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Floor Detail ====================
function FloorDetail({
  floor,
  units,
  onBack,
  projectId,
  towerId,
  onCreateUnit,
  onEditUnit,
  onDeleteUnit,
}: {
  floor: ApiFloor | undefined;
  units: ApiUnit[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  onCreateUnit: () => void;
  onEditUnit: (unit: ApiUnit) => void;
  onDeleteUnit: (unit: ApiUnit) => void;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground font-medium">Floor {floor.number}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{floor.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Floor {floor.number}</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-initial">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Tower
          </Button>
          <Button onClick={onCreateUnit} className="flex-1 sm:flex-initial">+ New Unit</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{sortedUnits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{floor.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      {sortedUnits.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No units mapped yet for this floor.</CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedUnits.map((unit) => (
            <Card
              key={unit.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floor.id}/units/${unit.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold">{unit.unitNumber}</h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{unit.status || "Available"}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditUnit(unit);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteUnit(unit);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{unit.type || "Standard"} · {unit.areaSqFt || 0} sq ft</p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{unit.progress || 0}%</span>
                  </div>
                  <Progress value={unit.progress || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Unit Detail ====================
function UnitDetail({
  unit,
  tasks,
  onBack,
  projectId,
  towerId,
  floorId,
  onCreateTask,
  onEditTask,
  onDeleteTask,
}: {
  unit: ApiUnit | undefined;
  tasks: ApiTask[];
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
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}`} className="hover:text-foreground">Floor</Link>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground font-medium">{unit.unitNumber}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{unit.unitNumber}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{unit.type || "Standard"} · {unit.areaSqFt || 0} sq ft</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-initial">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Floor
          </Button>
          <Button onClick={onCreateTask} className="flex-1 sm:flex-initial">+ New Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{unit.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No tasks mapped yet for this unit.</CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unit.id}/tasks/${task.id}`)}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  task.status === "completed"
                    ? "bg-success"
                    : task.status === "in_progress"
                    ? "bg-warning"
                    : task.status === "delayed"
                    ? "bg-destructive"
                    : "bg-muted-foreground/30"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.department} · {task.phase}
                </p>
              </div>
              <Progress value={task.progress} className="h-1.5 w-20 hidden md:flex" />
              <span className="text-xs font-medium">{task.progress}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditTask(task);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteTask(task);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== Task Detail (full-hierarchy path) ====================
function TaskDetail({
  task,
  checklists,
  onBack,
  projectId,
  towerId,
  floorId,
  unitId,
  onCreateChecklist,
  onEditChecklist,
  onDeleteChecklist,
}: {
  task: ApiTask | undefined;
  checklists: ApiChecklist[];
  onBack: () => void;
  projectId: number;
  towerId: number;
  floorId: number;
  unitId: number;
  onCreateChecklist: () => void;
  onEditChecklist: (checklist: ApiChecklist) => void;
  onDeleteChecklist: (checklist: ApiChecklist) => void;
}) {
  const navigate = useNavigate();

  if (!task) return <div className="text-center py-12">Task not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}`} className="hover:text-foreground">Floor</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}`} className="hover:text-foreground">Unit</Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{task.title}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{task.title}</h1>
          <p className="text-muted-foreground mt-1">{task.department} · {task.phase}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Unit
          </Button>
          <Button onClick={onCreateChecklist}>+ New Checklist</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{checklists.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Checklists</p>
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
            <h4 className="font-medium text-sm mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {checklists.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No checklists mapped yet for this task.</CardContent>
          </Card>
        ) : (
          checklists.map((checklist) => (
            <div
              key={checklist.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => navigate(`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${task.id}/checklists/${checklist.id}`)}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  checklist.status === "completed" ? "bg-success" : "bg-muted-foreground/30"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{checklist.name}</p>
              </div>
              <Progress value={checklist.progress || 0} className="h-1.5 w-20 hidden md:flex" />
              <span className="text-xs font-medium">{checklist.progress || 0}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditChecklist(checklist);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteChecklist(checklist);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== Checklist Detail ====================
function ChecklistDetail({
  checklist,
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
}: {
  checklist: ApiChecklist | undefined;
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
}) {
  if (!checklist) return <div className="text-center py-12">Checklist not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}`} className="hover:text-foreground">Floor</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}`} className="hover:text-foreground">Unit</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}/units/${unitId}/tasks/${taskId}`} className="hover:text-foreground">Task</Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{checklist.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{checklist.name}</h1>
          <p className="text-muted-foreground mt-1">Status: {checklist.status || "Pending"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Task
          </Button>
          <Button onClick={onCreateSubTask}>+ New Sub Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{subTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sub Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-display font-bold">{checklist.progress || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {subTasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No sub tasks mapped yet for this checklist.</CardContent>
          </Card>
        ) : (
          subTasks.map((subTask) => (
            <div key={subTask.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  subTask.status === "completed" ? "bg-success" : "bg-muted-foreground/30"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{subTask.name}</p>
              </div>
              <Progress value={subTask.progress || 0} className="h-1.5 w-20 hidden md:flex" />
              <span className="text-xs font-medium">{subTask.progress || 0}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEditSubTask(subTask)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDeleteSubTask(subTask)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
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
    if (!projectId || !unitId) return;

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
    } else {
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
    }
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
    if (!projectId || !towerId || !floorId || !unitId || !taskId || !checklistId) return;
    const payload: SubTaskPayload = {
      checklistId: Number(checklistId),
      taskId: Number(taskId),
      unitId: Number(unitId),
      floorId: Number(floorId),
      towerId: Number(towerId),
      projectId: Number(projectId),
      name: values.name.trim(),
      status: values.status,
      progress: Number(values.progress || 0),
    };
    if (editingSubTask) {
      updateSubTaskMutation.mutate({ id: editingSubTask.id, data: payload });
    } else {
      createSubTaskMutation.mutate(payload);
    }
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

  const renderView = () => {
    if (projectId && towerId && floorId && unitId && taskId && checklistId) {
      return (
        <ChecklistDetail
          checklist={selectedChecklist}
          subTasks={checklistSubTasks}
          onBack={() => goToTask(
            Number(projectId),
            Number(towerId),
            Number(floorId),
            Number(unitId),
            Number(taskId)
          )}
          projectId={Number(projectId)}
          towerId={Number(towerId)}
          floorId={Number(floorId)}
          unitId={Number(unitId)}
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
        />
      );
    }

    if (projectId && towerId && floorId && unitId && taskId) {
      return (
        <TaskDetail
          task={selectedTask}
          checklists={taskChecklists}
          onBack={() => goToUnit(
            Number(projectId),
            Number(towerId),
            Number(floorId),
            Number(unitId)
          )}
          projectId={Number(projectId)}
          towerId={Number(towerId)}
          floorId={Number(floorId)}
          unitId={Number(unitId)}
          onCreateChecklist={() => {
            setEditingChecklist(null);
            setChecklistDialogOpen(true);
          }}
          onEditChecklist={(checklist) => {
            setEditingChecklist(checklist);
            setChecklistDialogOpen(true);
          }}
          onDeleteChecklist={handleDeleteChecklist}
        />
      );
    }

    if (projectId && towerId && floorId && unitId) {
      return (
        <UnitDetail
          unit={selectedUnit}
          tasks={unitTasks}
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
          units={floorUnits}
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
        />
      );
    }

    if (projectId && towerId) {
      return (
        <TowerDetail
          tower={selectedTower}
          floors={towerFloors}
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
        />
      );
    }

    return (
      <ProjectList
        projectList={projects}
        towers={towers}
        tasks={tasks}
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