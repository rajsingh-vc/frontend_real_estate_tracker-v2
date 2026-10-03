import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, MapPin, Calendar, ArrowRight, Pencil, Trash2, ChevronLeft } from "lucide-react";
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
  organizationApi, companyApi, entityApi,
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initialProject ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Organization</Label>
              <Select value={form.organizationId} onValueChange={handleOrgChange}>
                <SelectTrigger>
                  <SelectValue placeholder={orgsLoading ? "Loading…" : "Select organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org: Organization) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Company</Label>
              <Select
                value={form.companyId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}
                disabled={!form.organizationId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.organizationId
                        ? "Select organization first"
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

            <div className="grid gap-2">
              <Label>Entity</Label>
              <Select
                value={form.entityId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, entityId: value }))}
                disabled={!form.organizationId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.organizationId
                        ? "Select organization first"
                        : entitiesLoading
                        ? "Loading…"
                        : "Select entity (optional)"
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

          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-location">Location</Label>
            <Input
              id="project-location"
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              required
            />
          </div>

          {/* ✅ NEW: Project Structure toggle */}
          <div className="grid gap-2">
            <Label>Project Structure</Label>
            <Select
              value={form.hierarchyMode}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, hierarchyMode: value as "full" | "direct_task" }))
              }
              disabled={!!initialProject}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full hierarchy (Tower → Floor → Unit → Task)</SelectItem>
                <SelectItem value="direct_task">Direct to Task (skip Tower/Floor/Unit)</SelectItem>
              </SelectContent>
            </Select>
            {initialProject && (
              <p className="text-xs text-muted-foreground">
                Structure is locked after creation to avoid orphaning existing data.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-status">Status</Label>
              <Input
                id="project-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Planning, Active, Completed"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-progress">Progress %</Label>
              <Input
                id="project-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-start">Start Date</Label>
              <Input
                id="project-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-end">End Date</Label>
              <Input
                id="project-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-units">Total Units</Label>
              <Input
                id="project-units"
                type="number"
                min={1}
                value={form.totalUnits}
                onChange={(e) => setForm((prev) => ({ ...prev, totalUnits: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-rera">RERA Number</Label>
              <Input
                id="project-rera"
                value={form.reraNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, reraNumber: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-budget">Budget (Cr)</Label>
              <Input
                id="project-budget"
                type="number"
                min={1}
                value={form.budgetCr}
                onChange={(e) => setForm((prev) => ({ ...prev, budgetCr: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">{projectList.length} projects in portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          {onSelectOrg && (
            <Select
              value={selectedOrgId || "all"}
              onValueChange={(value) => onSelectOrg(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {organizations.map((org: Organization) => (
                  <SelectItem key={org.id} value={String(org.id)}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={onCreate}>+ New Project</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {sortedProjectList.map((project) => {
          const pTowers = towers.filter((t) => t.projectId === project.id);
          const pTasks = tasks.filter((t) => t.projectId === project.id);
          const delayed = pTasks.filter((task) => task.status === "delayed" || task.delayDays > 0).length;

          return (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow cursor-pointer h-full"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        project.status === "active"
                          ? "default"
                          : project.status === "planning"
                          ? "secondary"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {project.status.replace("_", " ")}
                    </Badge>
                    {/* ✅ Small structure indicator */}
                    {project.hierarchyMode === "direct_task" && (
                      <Badge variant="outline" className="text-[10px]">Direct</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
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
                      className="h-8 w-8"
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
                  <h3 className="font-display font-bold text-lg">{project.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {project.location}
                  </p>
                  {(project.organizationName || project.companyName) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[project.organizationName, project.companyName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-display font-bold">{pTowers.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Towers</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-display font-bold">{project.totalUnits}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Units</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-display font-bold">{pTasks.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Tasks</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                {delayed > 0 && <p className="text-xs text-destructive font-medium">{delayed} delayed tasks</p>}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {project.startDate || "--"} — {project.endDate || "--"}
                  </span>
                </div>

                {/* ✅ NEW — created date & time */}
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
  tasks,
  onCreateTower,
  onEditTower,
  onDeleteTower,
}: {
  project: ApiProject | undefined;
  towers: ApiTower[];
  tasks: ApiTask[];
  onCreateTower: () => void;
  onEditTower: (tower: ApiTower) => void;
  onDeleteTower: (tower: ApiTower) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!project) return <div className="text-center py-12">Project not found</div>;

  const isDirect = project.hierarchyMode === "direct_task"; // ✅ NEW
  const pTowers = towers.filter((t) => t.projectId === project.id);
  const pTasks = tasks.filter((t) => t.projectId === project.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" />
            {project.location} · RERA: {project.reraNumber || "NA"}
          </p>
          {/* ✅ NEW — created date & time */}
          {project.createdAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {new Date(project.createdAt).toLocaleString(undefined, {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize self-start">
          {project.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <Tabs defaultValue={isDirect ? "tasks" : "towers"}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            {!isDirect && <TabsTrigger value="towers">Towers</TabsTrigger>}
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{tower.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{tower.name}</h1>
          <p className="text-muted-foreground mt-1">{tower.totalFloors} Floors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Project
          </Button>
          <Button onClick={onCreateFloor}>+ New Floor</Button>
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Floor {floor.number}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{floor.name}</h1>
          <p className="text-muted-foreground mt-1">Floor {floor.number}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Tower
          </Button>
          <Button onClick={onCreateUnit}>+ New Unit</Button>
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}`} className="hover:text-foreground">Tower</Link>
        <ArrowRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}/towers/${towerId}/floors/${floorId}`} className="hover:text-foreground">Floor</Link>
        <ArrowRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{unit.unitNumber}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{unit.unitNumber}</h1>
          <p className="text-muted-foreground mt-1">{unit.type || "Standard"} · {unit.areaSqFt || 0} sq ft</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Floor
          </Button>
          <Button onClick={onCreateTask}>+ New Task</Button>
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
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
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
          tasks={tasks}
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