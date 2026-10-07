import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { hurdleSeverityColors, type HurdleSeverity } from "@/data/demo-data";
import { AlertTriangle, Clock, CheckCircle2, ArrowUpCircle, Calendar, Trash2, Eye } from "lucide-react";
import { ReportHurdleDialog } from "@/components/dialogs/ReportHurdleDialog";
import { useToast } from "@/hooks/use-toast";
import { hurdlesApi, tasksApi, type ApiHurdle, ApiError } from "@/lib/api";

const hurdleTypeLabels: Record<string, string> = {
  material_delay: 'Material Delay', labour_shortage: 'Labour Shortage', vendor_delay: 'Vendor Delay',
  approval_pending: 'Approval Pending', design_change: 'Design Change', equipment_failure: 'Equipment Failure', weather_delay: 'Weather Delay',
};

const hurdleStatusOrder = ["open", "in_progress", "escalated", "resolved"] as const;
const hurdleStatusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  escalated: "Escalated",
  resolved: "Resolved",
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="h-4 w-4 text-warning" />,
  in_progress: <Clock className="h-4 w-4 text-info" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  escalated: <ArrowUpCircle className="h-4 w-4 text-destructive" />,
};

// Display label for a hurdle type that may not be one of the known keys
// above — e.g. if the type field ever becomes free text upstream. Falls
// back to a title-cased version of the raw value instead of `undefined`.
function displayHurdleType(type: string): string {
  const known = hurdleTypeLabels[type];
  if (known) return known;
  return type.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function HurdleDetailDialog({
  hurdle,
  onStatusChange,
  isUpdatingStatus,
}: {
  hurdle: ApiHurdle;
  onStatusChange: (status: string) => void;
  isUpdatingStatus?: boolean;
}) {
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  const affectedTask = tasks?.find(t => t.id === hurdle.affectedTaskId);

  return (
    <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge className={hurdleSeverityColors[hurdle.severity as HurdleSeverity]}>{hurdle.severity}</Badge>

          {/* Was a static <Badge variant="outline">{hurdle.status}</Badge> — now clickable,
              same Select-wrapped-Badge pattern used on the card row, so status (Open /
              In Progress / Escalated / Resolved) can be changed from inside the detail
              dialog too, via the same statusMutation passed down from the parent. */}
          <Select
            value={hurdle.status}
            onValueChange={onStatusChange}
            disabled={isUpdatingStatus}
          >
            <SelectTrigger className="w-auto h-6 text-xs border-0 bg-transparent p-0">
              <Badge variant="outline" className="capitalize cursor-pointer">
                {hurdle.status.replace('_', ' ')}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {hurdleStatusOrder.map((s) => (
                <SelectItem key={s} value={s}>
                  {hurdleStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogTitle className="font-display text-xl mt-2">{hurdle.title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">{hurdle.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{displayHurdleType(hurdle.type)}</span></div>
          <div><span className="text-muted-foreground">Tower:</span> <span className="font-medium">{hurdle.affectedTower}</span></div>
          <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{hurdle.responsibleDepartment}</span></div>
          <div><span className="text-muted-foreground">Impact:</span> <span className="font-medium text-destructive">{hurdle.impactDays} days</span></div>
          <div><span className="text-muted-foreground">Reported:</span> <span className="font-medium">{hurdle.reportedDate}</span></div>
          {hurdle.resolvedDate && <div><span className="text-muted-foreground">Resolved:</span> <span className="font-medium">{hurdle.resolvedDate}</span></div>}
        </div>
        {affectedTask && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Affected Task:</span> <span className="font-medium">{affectedTask.title}</span>
            <span className="text-xs text-muted-foreground ml-2">({affectedTask.department}, {affectedTask.progress}% complete)</span>
          </div>
        )}
        {hurdle.resolutionNotes && (
          <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-sm">
            <span className="font-medium text-success">Resolution:</span> {hurdle.resolutionNotes}
          </div>
        )}
      </div>
    </DialogContent>
  );
}

const HurdleTracker = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Set when arriving here from the top search bar (search result → this
  // page), so the matching hurdle's detail dialog opens automatically.
  const openHurdleId = (location.state as { openHurdleId?: number } | null)?.openHurdleId;
  const [severityFilter, setSeverityFilter] = useState("all");
  // ✅ UPDATED: Status filter is now free text instead of a fixed dropdown.
  const [statusFilter, setStatusFilter] = useState("");

  const { data: allHurdles, isLoading, isError, error } = useQuery({
    queryKey: ["hurdles"],
    queryFn: hurdlesApi.list,
  });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hurdlesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hurdles"] });
      toast({ title: "Hurdle deleted" });
    },
    onError: (err) => {
      toast({
        title: "Couldn't delete hurdle",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // NEW: inline status change directly from the card — optimistic update,
  // same pattern as task status editing in Tasks.tsx. If the new status is
  // "resolved" and there's no resolvedDate yet, stamp today's date so the
  // "Resolved" field in the detail dialog isn't left blank.
  //
  // NOTE: this inline per-card control is intentionally left as the fixed
  // open/in_progress/escalated/resolved Select — it drives the status
  // icon/color and the auto-resolvedDate logic above, so it stays a
  // closed set. Only the *filter* dropdown below was switched to free
  // text per your request; let me know if you want this one changed too.
  //
  // This same mutation is now also wired into HurdleDetailDialog's status
  // badge (see render below), so status can be changed from either place.
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      const patch: Partial<ApiHurdle> = { status };
      if (status === "resolved") {
        const existing = allHurdles?.find((h) => h.id === id);
        if (!existing?.resolvedDate) {
          patch.resolvedDate = new Date().toISOString().slice(0, 10);
        }
      }
      return hurdlesApi.update(id, patch);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["hurdles"] });
      const previous = queryClient.getQueryData<ApiHurdle[]>(["hurdles"]);
      queryClient.setQueryData<ApiHurdle[]>(["hurdles"], (old) =>
        old?.map((h) => (h.id === id ? { ...h, status } : h))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["hurdles"], context.previous);
      toast({
        title: "Couldn't update hurdle status",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (_data, variables) => {
      toast({ title: `Hurdle marked ${hurdleStatusLabels[variables.status]}` });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["hurdles"] }),
  });

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["hurdles"] });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading hurdles…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load hurdles{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const hurdles = allHurdles ?? [];

  // ✅ UPDATED: status is now matched as a case-insensitive substring
  // against either the raw status value or its display label, so typing
  // "prog" matches "in_progress" / "In Progress" without needing an exact
  // dropdown value.
  const filtered = hurdles.filter(h => {
    if (severityFilter !== 'all' && h.severity !== severityFilter) return false;
    if (statusFilter.trim()) {
      const needle = statusFilter.trim().toLowerCase();
      const rawMatch = h.status.toLowerCase().includes(needle);
      const labelMatch = (hurdleStatusLabels[h.status] ?? h.status).toLowerCase().includes(needle);
      if (!rawMatch && !labelMatch) return false;
    }
    return true;
  });

  const stats = {
    open: hurdles.filter(h => h.status === 'open').length,
    inProgress: hurdles.filter(h => h.status === 'in_progress').length,
    escalated: hurdles.filter(h => h.status === 'escalated').length,
    resolved: hurdles.filter(h => h.status === 'resolved').length,
    totalImpact: hurdles.filter(h => h.status !== 'resolved').reduce((a, h) => a + h.impactDays, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Hurdle Tracker</h1>
          <p className="text-muted-foreground mt-1">{hurdles.length} hurdles tracked</p>
        </div>
        <div className="w-full sm:w-auto">
          <ReportHurdleDialog onCreated={handleCreated} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {[
          { label: 'Open', value: stats.open, icon: <AlertTriangle className="h-4 w-4 text-warning" /> },
          { label: 'In Progress', value: stats.inProgress, icon: <Clock className="h-4 w-4 text-info" /> },
          { label: 'Escalated', value: stats.escalated, icon: <ArrowUpCircle className="h-4 w-4 text-destructive" /> },
          { label: 'Resolved', value: stats.resolved, icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
          { label: 'Impact Days', value: stats.totalImpact, icon: <Calendar className="h-4 w-4 text-muted-foreground" /> },
        ].map((stat, idx) => (
          <Card key={stat.label} className={idx === 4 ? "col-span-2 sm:col-span-1 lg:col-span-1" : ""}>
            <CardContent className="p-3.5 sm:p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className="text-lg font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {/* ✅ UPDATED: Status filter is now free text instead of a dropdown. */}
        <Input
          placeholder="Filter by status..."
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-[180px]"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((hurdle) => {
          const affectedTask = tasks?.find(t => t.id === hurdle.affectedTaskId);
          return (
            <Card key={hurdle.id}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  {statusIcons[hurdle.status]}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-medium">{hurdle.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{hurdle.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={hurdleSeverityColors[hurdle.severity as HurdleSeverity]}>{hurdle.severity}</Badge>
                        {/* Inline, editable status — writes straight to hurdlesApi.update
                            with an optimistic UI update, instead of only being viewable.
                            Left as a fixed dropdown (see note above statusMutation). */}
                        <Select
                          value={hurdle.status}
                          onValueChange={(status) => statusMutation.mutate({ id: hurdle.id, status })}
                        >
                          <SelectTrigger className="w-auto h-6 text-xs border-0 bg-transparent p-0">
                            <Badge variant="outline" className="capitalize cursor-pointer">
                              {hurdle.status.replace('_', ' ')}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {hurdleStatusOrder.map((s) => (
                              <SelectItem key={s} value={s}>
                                {hurdleStatusLabels[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog defaultOpen={hurdle.id === openHurdleId}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <HurdleDetailDialog
                            hurdle={hurdle}
                            onStatusChange={(status) => statusMutation.mutate({ id: hurdle.id, status })}
                            isUpdatingStatus={statusMutation.isPending}
                          />
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(hurdle.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Type: <span className="text-foreground">{displayHurdleType(hurdle.type)}</span></span>
                      <span>Tower: <span className="text-foreground">{hurdle.affectedTower}</span></span>
                      <span>Dept: <span className="text-foreground">{hurdle.responsibleDepartment}</span></span>
                      <span>Impact: <span className="text-foreground font-medium">{hurdle.impactDays} days</span></span>
                    </div>
                    {affectedTask && (
                      <div className="text-xs text-muted-foreground">Affects: <span className="text-foreground">{affectedTask.title}</span></div>
                    )}
                    {hurdle.resolutionNotes && (
                      <div className="p-2 rounded bg-success/5 border border-success/20 text-xs">
                        <span className="font-medium text-success">Resolution:</span> {hurdle.resolutionNotes}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No hurdles match filters</p>}
      </div>
    </div>
  );
};

export default HurdleTracker;