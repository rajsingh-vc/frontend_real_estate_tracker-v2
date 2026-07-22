import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type HurdleSeverity } from "@/data/demo-data";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  hurdlesApi, tasksApi, projectsApi, towersApi,
  type HurdlePayload, ApiError,
} from "@/lib/api";

const severities: HurdleSeverity[] = ['critical', 'high', 'medium', 'low'];

interface ReportHurdleDialogProps {
  onCreated?: () => void;
  trigger?: React.ReactNode;
  /** ✅ NEW: locks the hurdle to this project and hides the Project select. */
  defaultProjectId?: number;
  /** ✅ NEW: pre-fills and hides the Affected Task select. */
  defaultAffectedTaskId?: number;
}

const buildEmptyForm = (defaultProjectId?: number, defaultAffectedTaskId?: number) => ({
  title: '', description: '', type: '',
  affectedTaskId: defaultAffectedTaskId ? String(defaultAffectedTaskId) : '',
  affectedTower: '',
  responsibleDepartment: '', impactDays: '0', severity: 'medium' as HurdleSeverity,
  projectId: defaultProjectId ? String(defaultProjectId) : '',
});

export function ReportHurdleDialog({
  onCreated,
  trigger,
  defaultProjectId,
  defaultAffectedTaskId,
}: ReportHurdleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm(defaultProjectId, defaultAffectedTaskId));

  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list, enabled: open });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: open });
  const { data: towers = [] } = useQuery({ queryKey: ["towers"], queryFn: towersApi.list, enabled: open });

  // ✅ NEW: read hierarchy mode off the actual project record.
  const activeProject = projects.find(p => String(p.id) === form.projectId);
  const showTowerField = activeProject?.hierarchyMode !== "direct_task";

  const relevantTowers = form.projectId ? towers.filter(t => String(t.projectId) === form.projectId) : towers;

  const createMutation = useMutation({
    mutationFn: (payload: HurdlePayload) => hurdlesApi.create(payload),
    onSuccess: (hurdle) => {
      queryClient.invalidateQueries({ queryKey: ["hurdles"] });
      toast({ title: "Hurdle reported", description: `"${hurdle.title}" has been logged.` });
      setOpen(false);
      setForm(buildEmptyForm(defaultProjectId, defaultAffectedTaskId));
      onCreated?.();
    },
    onError: (error) => {
      toast({
        title: "Couldn't report hurdle",
        description: error instanceof ApiError ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTaskSelect = (taskId: string) => {
    const task = tasks.find(t => String(t.id) === taskId);
    setForm(prev => ({
      ...prev,
      affectedTaskId: taskId,
      projectId: task ? String(task.projectId) : prev.projectId,
    }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.type || !form.projectId) return;

    const payload: HurdlePayload = {
      title: form.title,
      description: form.description,
      type: form.type,
      responsibleDepartment: form.responsibleDepartment || 'Civil',
      impactDays: Number(form.impactDays) || 0,
      severity: form.severity,
      projectId: Number(form.projectId),
    };
    if (form.affectedTaskId) payload.affectedTaskId = Number(form.affectedTaskId);
    if (form.affectedTower) payload.affectedTower = form.affectedTower;

    createMutation.mutate(payload);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setForm(buildEmptyForm(defaultProjectId, defaultAffectedTaskId));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button><Plus className="h-4 w-4 mr-2" />Report Hurdle</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Report New Hurdle</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Cement shortage" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the hurdle..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hurdle Type *</Label>
              <Input
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                placeholder="e.g., Material Delay"
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v as HurdleSeverity })}>
                <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  {severities.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!defaultProjectId && (
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={form.projectId} onValueChange={v => setForm({ ...form, projectId: v, affectedTower: '' })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className={`grid gap-4 ${showTowerField && !defaultAffectedTaskId ? 'grid-cols-2' : showTowerField || !defaultAffectedTaskId ? 'grid-cols-1' : ''}`}>
            {!defaultAffectedTaskId && (
              <div className="space-y-2">
                <Label>Affected Task</Label>
                <Select value={form.affectedTaskId} onValueChange={handleTaskSelect}>
                  <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                  <SelectContent>
                    {tasks.slice(0, 20).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showTowerField && (
              <div className="space-y-2">
                <Label>Affected Tower</Label>
                <Select value={form.affectedTower} onValueChange={v => setForm({ ...form, affectedTower: v })}>
                  <SelectTrigger><SelectValue placeholder="Select tower" /></SelectTrigger>
                  <SelectContent>
                    {relevantTowers.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsible Department</Label>
              <Input
                value={form.responsibleDepartment}
                onChange={e => setForm({ ...form, responsibleDepartment: e.target.value })}
                placeholder="e.g., Civil"
              />
            </div>
            <div className="space-y-2">
              <Label>Impact Days</Label>
              <Input type="number" min={0} value={form.impactDays} onChange={e => setForm({ ...form, impactDays: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.title || !form.type || !form.projectId || createMutation.isPending}>
              {createMutation.isPending ? "Reporting…" : "Report Hurdle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}