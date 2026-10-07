import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wrench, Package, Building2, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { resourcesApi, tasksApi, type ApiResource, type ResourcePayload, ApiError } from "@/lib/api";

interface MachineRow {
  name: string;
  qty: string;
}

interface MaterialRow {
  name: string;
  qty: string;
  unit: string;
}

interface ResourceForm {
  taskId: string;
  labour: string;
  vendor: string;
  machines: MachineRow[];
  materials: MaterialRow[];
}

const defaultForm: ResourceForm = {
  taskId: "",
  labour: "0",
  vendor: "",
  machines: [],
  materials: [],
};

const Resources = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<ApiResource | null>(null);
  const [form, setForm] = useState<ResourceForm>(defaultForm);

  const { data: allocations, isLoading, isError, error } = useQuery({
    queryKey: ["resources"],
    queryFn: resourcesApi.list,
  });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  // Pre-fill the form whenever we open the dialog to edit an existing
  // allocation; reset to blank when opening for a fresh one.
  useEffect(() => {
    if (!open) return;
    if (!editingAllocation) {
      setForm(defaultForm);
      return;
    }
    setForm({
      taskId: String(editingAllocation.taskId),
      labour: String(editingAllocation.labour),
      vendor: editingAllocation.vendor || "",
      machines: editingAllocation.machines.map((m) => ({ name: m.name, qty: String(m.qty) })),
      materials: editingAllocation.materials.map((m) => ({
        name: m.name,
        qty: String(m.qty),
        unit: m.unit,
      })),
    });
  }, [open, editingAllocation]);

  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ResourcePayload) => resourcesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Resource allocated" });
      closeDialog();
    },
    onError: onMutationError("Couldn't allocate resource"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ResourcePayload> }) =>
      resourcesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Allocation updated" });
      closeDialog();
    },
    onError: onMutationError("Couldn't update allocation"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resourcesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Allocation removed" });
    },
    onError: onMutationError("Couldn't remove allocation"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingAllocation(null);
    setForm(defaultForm);
  };

  const addMachineRow = () => {
    setForm((prev) => ({ ...prev, machines: [...prev.machines, { name: "", qty: "1" }] }));
  };
  const updateMachineRow = (index: number, patch: Partial<MachineRow>) => {
    setForm((prev) => ({
      ...prev,
      machines: prev.machines.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };
  const removeMachineRow = (index: number) => {
    setForm((prev) => ({ ...prev, machines: prev.machines.filter((_, i) => i !== index) }));
  };

  const addMaterialRow = () => {
    setForm((prev) => ({
      ...prev,
      materials: [...prev.materials, { name: "", qty: "1", unit: "" }],
    }));
  };
  const updateMaterialRow = (index: number, patch: Partial<MaterialRow>) => {
    setForm((prev) => ({
      ...prev,
      materials: prev.materials.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };
  const removeMaterialRow = (index: number) => {
    setForm((prev) => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.taskId) return;

    const payload: ResourcePayload = {
      taskId: Number(form.taskId),
      labour: Number(form.labour || 0),
      vendor: form.vendor.trim() || undefined,
      machines: form.machines
        .filter((m) => m.name.trim())
        .map((m) => ({ name: m.name.trim(), qty: Number(m.qty || 0) })),
      materials: form.materials
        .filter((m) => m.name.trim())
        .map((m) => ({ name: m.name.trim(), qty: Number(m.qty || 0), unit: m.unit.trim() })),
    };

    if (editingAllocation) {
      updateMutation.mutate({ id: editingAllocation.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading resource allocations…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load resources{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const items = allocations ?? [];
  const totalLabour = items.reduce((sum, item) => sum + item.labour, 0);
  const totalMachines = items.reduce(
    (sum, item) => sum + item.machines.reduce((acc, machine) => acc + machine.qty, 0),
    0
  );
  const materialTypes = items.reduce((sum, item) => sum + item.materials.length, 0);
  const vendors = items.filter((item) => item.vendor).length;

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Resource Planning</h1>
          <p className="text-muted-foreground mt-1">Resource allocation across tasks</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            setEditingAllocation(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />Allocate Resource
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xl font-display font-bold">{totalLabour}</p><p className="text-xs text-muted-foreground">Total Labour</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center"><Wrench className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xl font-display font-bold">{totalMachines}</p><p className="text-xs text-muted-foreground">Machines</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center"><Package className="h-5 w-5 text-info" /></div>
            <div><p className="text-xl font-display font-bold">{materialTypes}</p><p className="text-xs text-muted-foreground">Material Types</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-xl font-display font-bold">{vendors}</p><p className="text-xs text-muted-foreground">Vendors</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {items.map((allocation) => {
          const task = tasks.find((taskItem) => taskItem.id === allocation.taskId);
          if (!task) return null;

          return (
            <Card key={allocation.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-display text-base">{task.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{task.department}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingAllocation(allocation);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteMutation.mutate(allocation.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Labour</p>
                  <p className="font-medium">{allocation.labour} workers</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Machines</p>
                  {allocation.machines.map((machine) => (
                    <p key={machine.id} className="text-sm">{machine.qty}× {machine.name}</p>
                  ))}
                  {allocation.machines.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Materials</p>
                  {allocation.materials.map((material) => (
                    <p key={material.id} className="text-sm">{material.qty} {material.unit} {material.name}</p>
                  ))}
                  {allocation.materials.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Vendor</p>
                  <p className="text-sm">{allocation.vendor || "N/A"}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">No resource allocations yet.</CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAllocation ? "Edit Allocation" : "Allocate Resource"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label>Task</Label>
              <Select
                value={form.taskId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, taskId: value }))}
                disabled={!!editingAllocation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="labour">Labour</Label>
                <Input
                  id="labour"
                  type="number"
                  min={0}
                  value={form.labour}
                  onChange={(event) => setForm((prev) => ({ ...prev, labour: event.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={form.vendor}
                  onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Machines — previously had no UI at all despite the API/cards
                supporting them. */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Machines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMachineRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Machine
                </Button>
              </div>
              {form.machines.length === 0 && (
                <p className="text-xs text-muted-foreground">No machines added.</p>
              )}
              <div className="space-y-2">
                {form.machines.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Machine name"
                      value={row.name}
                      onChange={(e) => updateMachineRow(index, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => updateMachineRow(index, { qty: e.target.value })}
                      className="w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeMachineRow(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials — same gap as machines. */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Materials</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMaterialRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Material
                </Button>
              </div>
              {form.materials.length === 0 && (
                <p className="text-xs text-muted-foreground">No materials added.</p>
              )}
              <div className="space-y-2">
                {form.materials.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Material name"
                      value={row.name}
                      onChange={(e) => updateMaterialRow(index, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => updateMaterialRow(index, { qty: e.target.value })}
                      className="w-20"
                    />
                    <Input
                      placeholder="Unit"
                      value={row.unit}
                      onChange={(e) => updateMaterialRow(index, { unit: e.target.value })}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeMaterialRow(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={!form.taskId || saving}>
                {saving ? "Saving…" : editingAllocation ? "Update Allocation" : "Add Allocation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Resources;