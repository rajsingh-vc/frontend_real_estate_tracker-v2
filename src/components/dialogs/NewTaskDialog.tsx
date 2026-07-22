import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  tasksApi, projectsApi, towersApi, floorsApi, unitsApi, checklistTemplatesApi,
  organizationApi, companyApi, entityApi, statusesApi, usersApi,
  type NewTaskPayload, type Organization, type OrganizationCompany, type Entity,
  ApiError,
} from "@/lib/api";

// ✅ FIXED: was FALLBACK_STATUSES using project-stage labels; now matches
// task status values so the fallback (when the /statuses/?entity=task
// endpoint has no data yet) still lines up with TaskStatus on the backend.
const FALLBACK_TASK_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
  { value: "delayed", label: "Delayed" },
];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

interface NewTaskDialogProps {
  /** Called after the task is successfully created, so the caller can refresh its own view. */
  onCreated?: () => void;
  trigger?: React.ReactNode;
  /** When provided, the dialog skips org/company/project pickers
   * and locks the task to this project. Tower/Floor/Unit are also hidden if
   * the locked project is in "direct_task" mode. */
  lockedProjectId?: number;
}

const emptyForm = {
  title: '', description: '',
  organizationId: '', companyId: '', entityId: '',
  startDate: '', endDate: '', priority: '', status: '',
  projectId: '', towerId: '', floorId: '', unitId: '',
  phase: '', department: '', assignedHodId: '', checklistTemplateId: '',
};

export function NewTaskDialog({ onCreated, trigger, lockedProjectId }: NewTaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    projectId: lockedProjectId ? String(lockedProjectId) : '',
  });

  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"], queryFn: organizationApi.list, enabled: open && !lockedProjectId,
  });
  const orgId = form.organizationId ? Number(form.organizationId) : null;
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["organization-companies", orgId],
    queryFn: () => companyApi.list(orgId as number),
    enabled: open && !lockedProjectId && orgId !== null,
  });
  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ["organization-entities", orgId],
    queryFn: () => entityApi.list(orgId as number),
    enabled: open && !lockedProjectId && orgId !== null,
  });

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: open });
  const { data: towers = [] } = useQuery({ queryKey: ["towers"], queryFn: towersApi.list, enabled: open });
  const { data: floors = [] } = useQuery({ queryKey: ["floors"], queryFn: floorsApi.list, enabled: open });
  // ✅ NEW: units, needed to fill the missing Unit selector below.
  const { data: units = [] } = useQuery({ queryKey: ["units"], queryFn: unitsApi.list, enabled: open });
  const { data: checklistTemplates = [] } = useQuery({
    queryKey: ["checklist-templates"], queryFn: checklistTemplatesApi.list, enabled: open,
  });
  // ✅ NEW: users list, needed for the Assign to HOD picker below.
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"], queryFn: usersApi.list, enabled: open,
  });

  // ✅ FIXED: was entity="project" — this dropdown is for a TASK's status,
  // so it must read the task status list, not the project status list.
  const { data: taskStatuses = [] } = useQuery({
    queryKey: ["statuses", "task"],
    queryFn: () => statusesApi.list("task"),
    enabled: open,
  });
  const statusOptions = taskStatuses.length > 0 ? taskStatuses : FALLBACK_TASK_STATUSES;

  // Resolve the active project (locked or picked) and read its
  // hierarchy mode straight from the record — single source of truth.
  const activeProjectId = lockedProjectId ?? (form.projectId ? Number(form.projectId) : null);
  const activeProject = projects.find(p => p.id === activeProjectId);
  const isDirectMode = activeProject?.hierarchyMode === "direct_task";

  const filteredProjects = projects.filter(p => {
    if (orgId !== null && p.organizationId !== orgId) return false;
    if (form.companyId && p.companyId !== Number(form.companyId)) return false;
    if (form.entityId && p.entityId !== Number(form.entityId)) return false;
    return true;
  });
  const projectTowers = towers.filter(t => String(t.projectId) === form.projectId);
  const towerFloors = floors.filter(f => String(f.towerId) === form.towerId);
  // ✅ NEW: units cascade from the chosen floor, same pattern as floors from tower.
  const floorUnits = units.filter(u => String(u.floorId) === form.floorId);

  const handleOrgChange = (value: string) => {
    setForm(prev => ({
      ...prev, organizationId: value, companyId: '', entityId: '',
      projectId: '', towerId: '', floorId: '', unitId: '',
    }));
  };

  const createMutation = useMutation({
    mutationFn: (payload: NewTaskPayload) => tasksApi.create(payload),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" });
      toast({ title: "Task created", description: `"${task.title}" has been created.` });
      setOpen(false);
      setForm({ ...emptyForm, projectId: lockedProjectId ? String(lockedProjectId) : '' });
      onCreated?.();
    },
    onError: (error) => {
      toast({
        title: "Couldn't create task",
        description: error instanceof ApiError ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.title || !form.projectId) return;
    // ✅ NEW: full-hierarchy projects require tower+floor+unit — mirrors
    // the backend's TaskSerializer.validate(), enforced client-side too so
    // the user gets immediate feedback instead of a round-trip 400.
    if (!isDirectMode && (!form.towerId || !form.floorId || !form.unitId)) return;

    const payload: NewTaskPayload = {
      title: form.title,
      description: form.description,
      department: form.department.trim(),
      projectId: Number(form.projectId),
      phase: form.phase.trim(),
    };
    if (form.priority) payload.priority = form.priority;
    if (form.status) payload.status = form.status;
    // Tower/Floor/Unit only ever sent when not in direct mode.
    if (!isDirectMode) {
      if (form.towerId) payload.towerId = Number(form.towerId);
      if (form.floorId) payload.floorId = Number(form.floorId);
      if (form.unitId) payload.unitId = Number(form.unitId);
    }
    if (form.startDate) payload.startDate = form.startDate;
    if (form.endDate) payload.endDate = form.endDate;
    // ✅ FIXED: was payload key "assignToHod" (typo, cast through `any`,
    // never actually matched NewTaskPayload's real field "assignedHod" —
    // so it silently did nothing). Now sends the correct key with a real
    // user id instead of a free-text name.
    if (form.assignedHodId) payload.assignedHod = Number(form.assignedHodId);
    if (form.checklistTemplateId && form.checklistTemplateId !== 'none') {
      payload.checklistTemplateId = Number(form.checklistTemplateId);
    }

    createMutation.mutate(payload);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm({ ...emptyForm, projectId: lockedProjectId ? String(lockedProjectId) : '' });
    }
  };

  const canSubmit =
    !!form.title && !!form.projectId && (isDirectMode || (!!form.towerId && !!form.floorId && !!form.unitId));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button><Plus className="h-4 w-4 mr-2" />New Task</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="dialog-description">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create New Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Task Name *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Slab Casting - Floor 5" />
            </div>
            <div className="space-y-2">
              <Label>Phase</Label>
              <Input
                value={form.phase}
                onChange={e => setForm({ ...form, phase: e.target.value })}
                placeholder="e.g., Foundation"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Task description..." />
          </div>

          {/* Org/Company/Entity/Project pickers hidden entirely when locked to a project */}
          {!lockedProjectId && (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={form.organizationId} onValueChange={handleOrgChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={orgsLoading ? "Loading…" : "Select organization"} />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org: Organization) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={form.companyId}
                    onValueChange={v => setForm(prev => ({ ...prev, companyId: v, projectId: '', towerId: '', floorId: '', unitId: '' }))}
                    disabled={!form.organizationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!form.organizationId ? "Select organization first" : companiesLoading ? "Loading…" : "Select company"} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c: OrganizationCompany) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Entity</Label>
                  <Select
                    value={form.entityId}
                    onValueChange={v => setForm(prev => ({ ...prev, entityId: v, projectId: '', towerId: '', floorId: '', unitId: '' }))}
                    disabled={!form.organizationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!form.organizationId ? "Select organization first" : entitiesLoading ? "Loading…" : "Select entity (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map((e: Entity) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.entity_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project *</Label>
                <Select value={form.projectId} onValueChange={v => setForm({ ...form, projectId: v, towerId: '', floorId: '', unitId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {filteredProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Tower/Floor/Unit hidden when locked project (or picked project) is direct_task.
              ✅ NEW: Unit select added — the backend requires tower+floor+unit
              together for full-hierarchy projects, but only Tower/Floor existed
              before, so every full-hierarchy submission from this dialog failed
              validation. */}
          {!isDirectMode && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tower *</Label>
                <Select value={form.towerId} onValueChange={v => setForm({ ...form, towerId: v, floorId: '', unitId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select tower" /></SelectTrigger>
                  <SelectContent>
                    {projectTowers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor *</Label>
                <Select
                  value={form.floorId}
                  onValueChange={v => setForm({ ...form, floorId: v, unitId: '' })}
                  disabled={!form.towerId}
                >
                  <SelectTrigger><SelectValue placeholder={!form.towerId ? "Select tower first" : "Select floor"} /></SelectTrigger>
                  <SelectContent>
                    {towerFloors.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Select
                  value={form.unitId}
                  onValueChange={v => setForm({ ...form, unitId: v })}
                  disabled={!form.floorId}
                >
                  <SelectTrigger><SelectValue placeholder={!form.floorId ? "Select floor first" : "Select unit"} /></SelectTrigger>
                  <SelectContent>
                    {floorUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.unitNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                placeholder="e.g., Civil"
              />
            </div>
            <div className="space-y-2">
              <Label>Assign to HOD</Label>
              {/* ✅ FIXED: was a free-text Input holding a typed name, which
                  can never satisfy a ForeignKey(User) on the backend and
                  used a payload key ("assignToHod") that didn't match
                  NewTaskPayload's actual field ("assignedHod"). Now a real
                  user picker sending a numeric id. */}
              <Select
                value={form.assignedHodId}
                onValueChange={v => setForm({ ...form, assignedHodId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Loading…" : "Select HOD"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}{u.role ? ` · ${u.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue placeholder="Not Started" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Checklist Template</Label>
            <Select value={form.checklistTemplateId} onValueChange={v => setForm({ ...form, checklistTemplateId: v })}>
              <SelectTrigger><SelectValue placeholder="Attach checklist template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No checklist</SelectItem>
                {checklistTemplates.map(ct => <SelectItem key={ct.id} value={String(ct.id)}>{ct.name} ({ct.items.length} items)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}