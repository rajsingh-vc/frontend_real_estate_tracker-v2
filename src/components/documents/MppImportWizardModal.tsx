import React, { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  Check,
  FileCode,
  ListTree,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  documentsApi,
  type ApiDocument,
  type ApiSchedulePreviewResponse,
  type ApiScheduleTaskItem,
} from "@/lib/api";

interface MppImportWizardModalProps {
  document: ApiDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export const MppImportWizardModal: React.FC<MppImportWizardModalProps> = ({
  document: doc,
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<"create_new_version" | "update_existing">(
    "create_new_version"
  );
  const [versionLabel, setVersionLabel] = useState<string>("v1.0");
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  // Parse Schedule Query
  const {
    data: previewData,
    isLoading: isParsing,
    isError: isParseError,
    error: parseError,
    refetch: triggerParse,
  } = useQuery({
    queryKey: ["schedule-preview", doc?.id],
    queryFn: async () => {
      if (!doc) return null;
      // First try to parse
      try {
        return await documentsApi.parseSchedule(doc.id);
      } catch (err: any) {
        // If already parsed, fetch preview
        return await documentsApi.getSchedulePreview(doc.id);
      }
    },
    enabled: open && !!doc,
    staleTime: 60000,
  });

  // Confirm Import Mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!doc) throw new Error("No document selected.");
      return await documentsApi.confirmScheduleImport(doc.id, {
        mode: importMode,
        versionLabel: versionLabel.trim() || "v1.0",
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({
        title: "Schedule imported successfully!",
        description: `Imported ${res.importedTasksCount} tasks into project schedule (${res.versionName}).`,
      });
      if (onImportComplete) onImportComplete();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Import failed",
        description: err?.message || "Could not persist schedule. Please check tasks data.",
        variant: "destructive",
      });
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tasksList: ApiScheduleTaskItem[] = previewData?.tasks || previewData?.tasksPreview || [];
  const summary = previewData?.summary;
  const comparison = previewData?.comparison;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card/60 backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                  <FileCode className="h-3.5 w-3.5 mr-1" />
                  MPP / Schedule Import Wizard
                </Badge>
                {doc && (
                  <Badge variant="secondary" className="text-xs">
                    {doc.type}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-bold mt-1.5 flex items-center gap-2">
                {doc?.name || "Microsoft Project Schedule Import"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target Project: <span className="text-foreground font-medium">{doc?.projectName || "Selected Project"}</span>
              </p>
            </div>

            {/* Stepper indicators */}
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border/40 text-xs self-start sm:self-auto">
              <button
                onClick={() => setStep(1)}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  step === 1 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>1</span> Detection
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <button
                onClick={() => setStep(2)}
                disabled={!previewData}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  step === 2 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                }`}
              >
                <span>2</span> Hierarchy & Diff
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <button
                onClick={() => setStep(3)}
                disabled={!previewData}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  step === 3 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                }`}
              >
                <span>3</span> Confirm
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isParsing && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <h3 className="font-semibold text-lg">Parsing Microsoft Project Schedule…</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Analyzing task hierarchy, WBS outlines, durations, milestones, and predecessor dependencies.
              </p>
            </div>
          )}

          {isParseError && (
            <div className="py-12 px-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
              <h3 className="font-semibold text-lg text-destructive">Schedule Parsing Failed</h3>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                {parseError instanceof Error ? parseError.message : "The schedule file could not be parsed."}
              </p>
              <Button size="sm" variant="outline" onClick={() => triggerParse()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry Parsing
              </Button>
            </div>
          )}

          {!isParsing && !isParseError && previewData && (
            <>
              {/* STEP 1: Overview & Metrics */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Total Tasks</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">{summary?.totalTasks || tasksList.length}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {summary?.summaryTasksCount || 0} summary • {summary?.subtasksCount || tasksList.length} subtasks
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Milestones</p>
                        <p className="text-2xl font-bold mt-1 text-primary">{summary?.milestonesCount || 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Key project checkpoints</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Critical Tasks</p>
                        <p className="text-2xl font-bold mt-1 text-destructive">{summary?.criticalTasksCount || 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">On project critical path</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Timeline Span</p>
                        <p className="text-sm font-semibold mt-1.5 truncate">
                          {summary?.startDate || "TBD"} → {summary?.finishDate || "TBD"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Planned schedule span</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Project Metadata Details */}
                  <Card className="border-border/60">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-primary" />
                        Schedule Origin & Properties
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Detected Title:</span>
                          <p className="font-medium text-foreground mt-0.5">{summary?.projectName || "Standard Schedule"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Author / Planner:</span>
                          <p className="font-medium text-foreground mt-0.5">{summary?.author || "Not specified"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Original File:</span>
                          <p className="font-medium text-foreground mt-0.5 truncate">{doc?.originalFilename || doc?.file}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Format Engine:</span>
                          <p className="font-medium text-foreground mt-0.5">{previewData.status || "Server Verified"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Existing Schedule:</span>
                          <p className="font-medium text-foreground mt-0.5">
                            {comparison?.hasExistingSchedule
                              ? `Detected (${comparison.existingTasksCount} tasks in DB)`
                              : "No existing schedule for project"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Automated Checklists:</span>
                          <p className="font-medium text-foreground mt-0.5 text-emerald-600 dark:text-emerald-400">
                            Enabled (from task inspection notes)
                          </p>
                        </div>
                      </div>

                      {/* Structure & Floor Detection */}
                      {previewData.structureSync && (
                        <div className="mt-3 p-3.5 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="font-semibold text-primary flex items-center gap-1.5">
                              <Layers className="h-4 w-4" />
                              Auto-detected Building Structure & Floor Mapping
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {previewData.structureSync.towerName}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-muted-foreground">
                            <div>
                              <span>Total Floors:</span>{" "}
                              <strong className="text-foreground">{previewData.structureSync.totalFloors}</strong>
                            </div>
                            <div>
                              <span>Detected Levels:</span>{" "}
                              <strong className="text-foreground">{previewData.structureSync.detectedFloorsCount}</strong>
                            </div>
                            <div>
                              <span>Mapped Tasks:</span>{" "}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {previewData.structureSync.mappedTasksCount}
                              </strong>
                            </div>
                            <div>
                              <span>Scope:</span>{" "}
                              <span className="text-foreground">Basements, Ground, Floors & Terrace</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Warnings if any */}
                      {summary?.warnings && summary.warnings.length > 0 && (
                        <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs space-y-1">
                          <p className="font-semibold text-warning flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Parser Notice
                          </p>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {summary.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* STEP 2: Task Hierarchy Tree & Change Diff */}
              {step === 2 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <Tabs defaultValue="hierarchy" className="w-full">
                    <TabsList className="grid grid-cols-2 w-full max-w-md">
                      <TabsTrigger value="hierarchy" className="text-xs">
                        <ListTree className="h-3.5 w-3.5 mr-1.5" />
                        Task Hierarchy ({tasksList.length})
                      </TabsTrigger>
                      <TabsTrigger value="diff" className="text-xs">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Change Summary ({comparison?.addedCount || 0} Added, {comparison?.modifiedCount || 0} Modified)
                      </TabsTrigger>
                    </TabsList>

                    {/* Hierarchy Tab */}
                    <TabsContent value="hierarchy" className="mt-4 space-y-2">
                      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card/40 max-h-[420px] overflow-y-auto">
                        <div className="grid grid-cols-12 px-4 py-2 bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <div className="col-span-6">WBS & Task Name</div>
                          <div className="col-span-2 text-center">Duration</div>
                          <div className="col-span-2 text-center">Start → Finish</div>
                          <div className="col-span-2 text-right">Progress / Type</div>
                        </div>

                        {tasksList.map((t) => {
                          const indent = (t.outlineLevel - 1) * 20;
                          return (
                            <div
                              key={t.uniqueId}
                              className={`grid grid-cols-12 px-4 py-2.5 items-center text-xs hover:bg-muted/40 transition-colors ${
                                t.isSummary ? "font-semibold bg-muted/10" : ""
                              }`}
                            >
                              <div className="col-span-6 flex items-center gap-2 truncate" style={{ paddingLeft: `${indent}px` }}>
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono shrink-0">
                                  {t.wbs || t.outlineNumber}
                                </Badge>
                                <span className="truncate">{t.name}</span>
                                {t.isMilestone && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4">
                                    Milestone
                                  </Badge>
                                )}
                                {t.critical && (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0 h-4">
                                    Critical
                                  </Badge>
                                )}
                              </div>
                              <div className="col-span-2 text-center text-muted-foreground">
                                {t.durationDays}d
                              </div>
                              <div className="col-span-2 text-center text-[11px] text-muted-foreground truncate">
                                {t.startDate || "TBD"} → {t.finishDate || "TBD"}
                              </div>
                              <div className="col-span-2 flex items-center justify-end gap-2">
                                <span className="text-[11px] font-medium">{t.percentComplete}%</span>
                                <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${t.percentComplete}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>

                    {/* Change Diff Tab */}
                    <TabsContent value="diff" className="mt-4 space-y-4">
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            {comparison?.addedCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Tasks to Add</p>
                        </div>
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                            {comparison?.modifiedCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Tasks to Update</p>
                        </div>
                        <div className="p-3 bg-muted/60 border border-border rounded-xl">
                          <p className="text-xl font-bold text-foreground">
                            {comparison?.unchangedCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Unchanged</p>
                        </div>
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                          <p className="text-xl font-bold text-destructive">
                            {comparison?.removedCount || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Archived / Removed</p>
                        </div>
                      </div>

                      {comparison?.modified && comparison.modified.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden p-3 bg-card/40 space-y-2">
                          <p className="text-xs font-semibold text-foreground">Modified Tasks Preview</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {comparison.modified.map((m: any, idx: number) => (
                              <div key={idx} className="p-2 bg-muted/30 rounded border border-border/40 text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-medium text-foreground">{m.title}</span>
                                  <span className="text-muted-foreground ml-2 font-mono text-[10px]">{m.wbs}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {Object.keys(m.diffs || {}).join(", ")} changed
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* STEP 3: Mode & Final Confirmation */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Select Schedule Versioning Action</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div
                        onClick={() => setImportMode("create_new_version")}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          importMode === "create_new_version"
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-border/80 bg-card/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Create New Schedule Version</span>
                          {importMode === "create_new_version" && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Stores this import as a new schedule version milestone. Retains previous version records for historical comparison.
                        </p>
                      </div>

                      <div
                        onClick={() => setImportMode("update_existing")}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          importMode === "update_existing"
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-border/80 bg-card/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Update Existing Schedule</span>
                          {importMode === "update_existing" && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Updates active project tasks in place by matching WBS codes. Preserves manually added checklists and field updates.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ver-tag">Schedule Version Label</Label>
                    <Input
                      id="ver-tag"
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      placeholder="e.g. v2.0 - Q4 Re-baseline"
                      className="max-w-md"
                    />
                  </div>

                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2 text-xs">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      What happens after confirmation:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>Creates <strong>{tasksList.length}</strong> project tasks maintaining parent-child outline hierarchy.</li>
                      <li>Extracts and links finish-to-start (FS) and lead/lag task dependencies.</li>
                      <li>Generates automated checklist checkpoints from task inspection notes.</li>
                      <li>Updates project completion rollup, planned dates, and baseline metrics.</li>
                      <li>Makes schedule tasks immediately available in <strong>Digital Twin</strong> and <strong>Reports</strong>.</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => (s - 1) as any)}>
                Back
              </Button>
            )}

            {step < 3 && previewData && (
              <Button size="sm" onClick={() => setStep((s) => (s + 1) as any)}>
                Next Step
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || !previewData}
                className="bg-primary text-primary-foreground font-semibold px-4"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                )}
                Confirm & Import Schedule
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
