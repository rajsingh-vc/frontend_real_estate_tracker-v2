import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Layers,
  MapPin,
  CheckCircle2,
  Search,
  Loader2,
  Sparkles,
  Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  digitalTwinMappingsApi,
  tasksApi,
  type ApiTask,
  type ApiTower,
  type ApiFloor,
  type ApiUnit,
} from "@/lib/api";

interface ScheduleMappingModalProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: ApiTask[];
  towers: ApiTower[];
  floors: ApiFloor[];
  units: ApiUnit[];
}

export const ScheduleMappingModal: React.FC<ScheduleMappingModalProps> = ({
  projectId,
  open,
  onOpenChange,
  tasks,
  towers,
  floors,
  units,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [targetTowerId, setTargetTowerId] = useState<string>("none");
  const [targetFloorId, setTargetFloorId] = useState<string>("none");
  const [targetUnitId, setTargetUnitId] = useState<string>("none");
  const [targetZone, setTargetZone] = useState<string>("");

  // Existing Mappings Query
  const { data: existingMappings = [], refetch } = useQuery({
    queryKey: ["digital-twin-mappings", projectId],
    queryFn: () => digitalTwinMappingsApi.list({ project: projectId }),
    enabled: open && !!projectId,
  });

  const mappedTaskIds = useMemo(
    () => new Set(existingMappings.map((m) => m.task)),
    [existingMappings]
  );

  // Available floors for selected tower
  const availableFloors = useMemo(() => {
    if (targetTowerId === "none") return floors;
    return floors.filter((f) => f.towerId === Number(targetTowerId));
  }, [floors, targetTowerId]);

  // Available units for selected floor
  const availableUnits = useMemo(() => {
    if (targetFloorId === "none") return units;
    return units.filter((u) => u.floorId === Number(targetFloorId));
  }, [units, targetFloorId]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.projectId !== projectId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.wbsCode?.toLowerCase().includes(q) ||
          t.department?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, projectId, search]);

  const toggleSelectTask = (id: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnmapped = () => {
    const unmapped = filteredTasks.filter((t) => !mappedTaskIds.has(t.id)).map((t) => t.id);
    setSelectedTaskIds(new Set(unmapped));
  };

  // Bulk Map Mutation
  const mapMutation = useMutation({
    mutationFn: async () => {
      if (selectedTaskIds.size === 0) throw new Error("Select at least one task to map.");
      const towerId = targetTowerId !== "none" ? Number(targetTowerId) : null;
      const floorId = targetFloorId !== "none" ? Number(targetFloorId) : null;
      const unitId = targetUnitId !== "none" ? Number(targetUnitId) : null;

      // Update tasks in DB as well to reflect tower/floor/unit assignment
      const taskPromises = Array.from(selectedTaskIds).map((tid) =>
        tasksApi.update(tid, {
          towerId: towerId ?? undefined,
          floorId: floorId ?? undefined,
          unitId: unitId ?? undefined,
        })
      );
      await Promise.allSettled(taskPromises);

      // Record Digital Twin Mapping
      return await digitalTwinMappingsApi.bulkMap({
        taskIds: Array.from(selectedTaskIds),
        projectId,
        towerId,
        floorId,
        unitId,
        zoneName: targetZone.trim(),
        elementIdentifier: targetZone.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["digital-twin-mappings"] });
      toast({
        title: "Tasks mapped successfully",
        description: `Mapped ${res.mappedCount} tasks to 3D Digital Twin building elements.`,
      });
      setSelectedTaskIds(new Set());
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Mapping failed",
        description: err?.message || "Could not link tasks to 3D elements.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-card/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Schedule ↔ 3D BIM Mapping
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold mt-1">
              Map Schedule Tasks to Digital Twin Building Elements
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Associate imported schedule tasks with Towers, Floors, Units, or Construction Zones so they render accurately in the 3D model.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Tasks Selection */}
          <div className="md:col-span-7 space-y-3 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold">Select Schedule Tasks ({selectedTaskIds.size} selected)</Label>
              <Button variant="ghost" size="sm" onClick={selectAllUnmapped} className="text-xs h-7 text-primary">
                Select Unmapped
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search schedule tasks by name, WBS…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="border border-border rounded-xl divide-y divide-border overflow-y-auto flex-1 max-h-[360px] bg-card/40">
              {filteredTasks.map((t) => {
                const isSelected = selectedTaskIds.has(t.id);
                const isMapped = mappedTaskIds.has(t.id) || !!t.towerId || !!t.floorId || !!t.unitId;

                return (
                  <div
                    key={t.id}
                    onClick={() => toggleSelectTask(t.id)}
                    className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? "bg-primary/10"
                        : isMapped
                        ? "bg-muted/10 hover:bg-muted/30"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-border text-primary shrink-0"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          {t.wbsCode && (
                            <span className="font-mono text-[10px] bg-muted px-1 rounded text-muted-foreground">
                              {t.wbsCode}
                            </span>
                          )}
                          <span className="font-medium truncate">{t.title}</span>
                          {t.isMilestone && (
                            <Badge className="text-[9px] px-1 py-0 h-3.5 bg-primary/10 text-primary">
                              MS
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t.department || "General"} • {t.durationDays || 1}d • {t.startDate || "TBD"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isMapped ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Unmapped
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredTasks.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">No tasks found matching search.</p>
              )}
            </div>
          </div>

          {/* Right Column: 3D Element Destination */}
          <div className="md:col-span-5 space-y-4 bg-muted/20 p-4 rounded-xl border border-border flex flex-col justify-between">
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Target 3D Element
              </h4>

              <div className="space-y-1">
                <Label className="text-xs">Building / Tower</Label>
                <Select value={targetTowerId} onValueChange={setTargetTowerId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All / Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Specific Tower</SelectItem>
                    {towers.map((tw) => (
                      <SelectItem key={tw.id} value={String(tw.id)}>
                        {tw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Floor Level</Label>
                <Select value={targetFloorId} onValueChange={setTargetFloorId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Specific Floor</SelectItem>
                    {availableFloors.map((fl) => (
                      <SelectItem key={fl.id} value={String(fl.id)}>
                        {fl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Specific Unit (Optional)</Label>
                <Select value={targetUnitId} onValueChange={setTargetUnitId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Whole Floor / No Unit</SelectItem>
                    {availableUnits.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        Unit {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Construction Zone / 3D Tag</Label>
                <Input
                  placeholder="e.g. Zone A, Podium, Core Wall"
                  value={targetZone}
                  onChange={(e) => setTargetZone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground font-semibold shadow-sm text-xs mt-4"
              onClick={() => mapMutation.mutate()}
              disabled={selectedTaskIds.size === 0 || mapMutation.isPending}
            >
              {mapMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Apply Mapping to {selectedTaskIds.size} Task(s)
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Mappings directly update Digital Twin 3D highlight states and element selection tooltips.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
