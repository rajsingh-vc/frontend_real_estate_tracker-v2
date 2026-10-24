import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exportTaskToPDF } from "@/utils/taskPdfExport";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { statusLabels, statusColors, priorityColors, type TaskStatus, type Priority } from "@/data/demo-data";
import {
  Search, CheckCircle2, MessageSquare, Plus, GripVertical,
  UserPlus, Link2, AlertTriangle, CalendarDays,
  Paperclip, FolderOpen, Camera, SwitchCamera, Download, Loader2,
  FileText, FileSpreadsheet, File as FileIcon, Image as ImageIcon, Send,
  FileDown, Pencil, Check, X, ListTree, Trash2, Eye,
} from "lucide-react";
import { NewTaskDialog } from "@/components/dialogs/NewTaskDialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  tasksApi, usersApi, projectsApi, towersApi, documentsApi, statusesApi,
  subTasksApi, type ApiSubTask, type SubTaskPayload,
  type ApiTask, type ApiDocument, type ApiChatMessage, ApiError, resolveImageUrl,
} from "@/lib/api";
import {
  processFileForUpload,
  formatBytes,
  isImageFile,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/utils/imageCompression";

const statusOrder: TaskStatus[] = ['not_started', 'ready', 'in_progress', 'blocked', 'review', 'completed', 'delayed'];

// ============================================================================
// ✅ FIXED: this hook drives TASK status dropdowns/columns and must read
// entity="task" — it was previously reading entity="project", which pulled
// project-stage labels (Planning/Active/On Hold/Completed) into task UI,
// causing Kanban columns to show statuses that no task could ever match.
// `statusOrder`/`statusLabels`/`statusColors` remain the fallback + styling
// table for the "classic" values when the backend has no task rows yet.
// ============================================================================
const FALLBACK_TASK_STATUSES = statusOrder.map(s => ({ value: s as string, label: statusLabels[s] }));

function useTaskStatuses(): { value: string; label: string }[] {
  const { data = [] } = useQuery({
    queryKey: ["statuses", "task"],
    queryFn: () => statusesApi.list("task"),
  });
  return data.length > 0 ? data : FALLBACK_TASK_STATUSES;
}

// Label/color/dot for a status string that may or may not be one of the
// fixed enum values above — project-derived statuses (e.g. "Planning",
// "Active") fall back to a sensible generic look instead of `undefined`.
function displayStatusLabel(status: string): string {
  const known = statusLabels[status as TaskStatus];
  if (known) return known;
  return status.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function displayStatusColor(status: string): string {
  return statusColors[status as TaskStatus] ?? 'bg-muted text-muted-foreground';
}

function displayStatusDot(status: string): string {
  const known: Record<string, string> = {
    completed: 'bg-success', in_progress: 'bg-warning', blocked: 'bg-destructive',
    delayed: 'bg-destructive', review: 'bg-primary', ready: 'bg-info',
  };
  if (known[status]) return known[status];
  const key = status.toLowerCase();
  if (key.includes('complete')) return 'bg-success';
  if (key.includes('progress') || key.includes('active')) return 'bg-warning';
  if (key.includes('delay') || key.includes('block')) return 'bg-destructive';
  if (key.includes('review')) return 'bg-primary';
  if (key.includes('ready')) return 'bg-info';
  return 'bg-muted-foreground/30';
}

const docIconMap: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-destructive" />,
  XLSX: <FileSpreadsheet className="h-4 w-4 text-success" />,
  JPG: <ImageIcon className="h-4 w-4 text-warning" />,
  JPEG: <ImageIcon className="h-4 w-4 text-warning" />,
  PNG: <ImageIcon className="h-4 w-4 text-warning" />,
};

// ============================================================================
// ⚠️ SCHEMA NOTE: assignedTo, dependsOn, isRepetitive, repeatFrequency and
// isSelfTask now DO exist on the backend Task model / TaskSerializer (see
// tasks/models.py, tasks/serializers.py). Make sure ApiTask in lib/api.ts
// stays in sync with those fields going forward.
// ============================================================================
type RepeatFrequency = 'daily' | 'weekly' | 'monthly';

type ApiTaskExt = ApiTask & {
  assignedTo?: number | null;
  dependsOn?: number | null;
  isRepetitive?: boolean | null;
  repeatFrequency?: RepeatFrequency | null;
  isSelfTask?: boolean | null;
};

export function isTaskAssignedToUser(task: ApiTaskExt | ApiTask | null | undefined, user: any): boolean {
  if (!task || !user) return false;
  const uid = Number(user.id);
  if (task.assignedTo != null && Number(task.assignedTo) === uid) return true;
  if ((task as any).assigned_to != null && Number((task as any).assigned_to) === uid) return true;
  if (task.assignedUsers && Array.isArray(task.assignedUsers) && task.assignedUsers.map(Number).includes(uid)) return true;
  if (task.assignedHod != null && Number(task.assignedHod) === uid) return true;
  return false;
}

// ✅ derive a sensible progress value whenever the status changes.
// - Completed always jumps to 100%.
// - Not started always resets to 0%.
// - In Progress / Ready get a small starting value ONLY if progress is
//   still at 0, so we never clobber real progress the user already set.
// - Other statuses (blocked, review, delayed) keep whatever progress was there.
function computeProgressForStatus(status: string, currentProgress: number): number {
  switch (status) {
    case 'completed':
      return 100;
    case 'not_started':
      return 0;
    case 'in_progress':
      return currentProgress > 0 ? currentProgress : 10;
    case 'ready':
      return currentProgress > 0 ? currentProgress : 5;
  }
  // Unrecognized (project-derived) status text — fall back to keyword
  // matching so common labels like "Planning" / "Active" / "Completed"
  // still nudge progress sensibly instead of being silently ignored.
  const key = status.toLowerCase();
  if (key.includes('complete')) return 100;
  if (key.includes('not started') || key === 'planning') return 0;
  if (key.includes('progress') || key.includes('active')) return currentProgress > 0 ? currentProgress : 10;
  return currentProgress;
}

// whole-day difference between two ISO-ish date strings (end - start).
// Returns null if either date is missing/unparsable, so callers can hide the
// stat instead of showing "NaN days".
function daysBetween(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

// Configured schedule duration in days (inclusive of start & end day, exactly matching MPP)
function computeDurationDays(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return diff >= 0 ? diff + 1 : 0;
}

// signed delay in days, synced to the real clock every time this renders —
// NOT read from the backend's static delayDays field. Positive = past due /
// finished late. Negative = time remaining / finished early. Zero = due
// today / finished exactly on time.
function computeSignedDelay(task: ApiTaskExt): number | null {
  if (!task.endDate) return null;
  if (task.status === 'completed') {
    const reference = (task as any).actualEndDate || task.endDate;
    return daysBetween(task.endDate, reference);
  }
  return daysBetween(task.endDate, new Date().toISOString());
}

// Display-only: normalizes inconsistent name casing coming from the
// backend (e.g. "vikram" vs "Anurag Sharma") so the assignee list reads
// consistently. Does not touch the underlying data — purely cosmetic.
function toTitleCase(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

// ============================================================================
// PDF export is handled via modular `@/utils/taskPdfExport`, supporting
// dynamic organization branding, inspection-style structured tables,
// checklist verification, and embedded site evidence photos.
// ============================================================================

// ============================================================================
// Live camera capture (replaces <input capture> which only ever opens a
// file/camera CHOOSER — it can't force the camera open directly, and it
// can't offer an in-app front/back switch). This uses getUserMedia to show
// a real live preview with a flip button, so the camera opens immediately
// and switching to the front (selfie) camera happens inside the same view
// instead of needing a separate button.
//
// NOTE: getUserMedia requires a secure context (HTTPS or localhost). On
// plain HTTP it will fail with a permission/security error.
// ============================================================================

function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startStream = async (mode: "environment" | "user") => {
    setError(null);
    setIsStarting(true);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in your browser settings."
          : "Couldn't access the camera on this device."
      );
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setFacingMode("environment");
      startStream("environment");
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFlip = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startStream(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      onOpenChange(false);
    }, "image/jpeg", 0.9);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Take Photo</DialogTitle>
        <div className="relative bg-black aspect-[3/4] flex items-center justify-center">
          {error ? (
            <p className="text-sm text-white text-center px-6">{error}</p>
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          )}
          {isStarting && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
          {!error && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 rounded-full h-9 w-9"
              onClick={handleFlip}
              disabled={isStarting}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCapture} disabled={!!error || isStarting}>
            <Camera className="h-4 w-4 mr-1.5" />
            Capture
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================================
// Task subtasks: view, add, toggle completion, and delete subtasks under the
// current task. Provides instant optimistic updates and syncs with backend.
// ============================================================================

// ============================================================================
// Edit Subtask Dialog (configured MPP dates, status, progress, name)
// ============================================================================
export function SubTaskEditDialog({
  open,
  onOpenChange,
  subtask,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtask: {
    id: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    progress: number;
    isChecklistSubTask?: boolean;
    taskId?: number;
  } | null;
  onSave: (values: {
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    progress: number;
  }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "pending",
    progress: "0",
  });

  useEffect(() => {
    if (!open || !subtask) return;
    setForm({
      name: subtask.name,
      startDate: subtask.startDate ?? "",
      endDate: subtask.endDate ?? "",
      status: subtask.status ?? "pending",
      progress: String(subtask.progress ?? 0),
    });
  }, [open, subtask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      status: form.status,
      progress: Number(form.progress || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Edit Subtask
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="st-name" className="text-xs font-semibold">Subtask Name</Label>
            <Input
              id="st-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="st-start" className="text-xs font-semibold">Start Date (Configured in MPP)</Label>
              <Input
                id="st-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-end" className="text-xs font-semibold">End Date (Configured in MPP)</Label>
              <Input
                id="st-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="st-status" className="text-xs font-semibold">Status</Label>
              <Input
                id="st-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                placeholder="e.g. pending, in_progress, completed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-prog" className="text-xs font-semibold">Progress %</Label>
              <Input
                id="st-prog"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((p) => ({ ...p, progress: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Edit Task Dialog (configured MPP dates, priority, status, progress, delay)
// ============================================================================
export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ApiTaskExt | null;
  onSave: (values: {
    title: string;
    department?: string;
    phase?: string;
    priority?: string;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    progress: number;
    delayDays: number;
    description?: string;
  }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    department: "",
    phase: "",
    priority: "medium",
    startDate: "",
    endDate: "",
    status: "not_started",
    progress: "0",
    delayDays: "0",
    description: "",
  });

  useEffect(() => {
    if (!open || !task) return;
    setForm({
      title: task.title,
      department: task.department ?? "",
      phase: task.phase ?? "",
      priority: task.priority ?? "medium",
      startDate: task.startDate ?? "",
      endDate: task.endDate ?? "",
      status: task.status ?? "not_started",
      progress: String(task.progress ?? 0),
      delayDays: String(task.delayDays ?? 0),
      description: task.description ?? "",
    });
  }, [open, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      title: form.title.trim(),
      department: form.department.trim(),
      phase: form.phase.trim(),
      priority: form.priority,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      status: form.status,
      progress: Number(form.progress || 0),
      delayDays: Number(form.delayDays || 0),
      description: form.description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Edit Task Schedule & Details
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="t-title" className="text-xs font-semibold">Task Title</Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-dept" className="text-xs font-semibold">Department</Label>
              <Input
                id="t-dept"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-phase" className="text-xs font-semibold">Phase</Label>
              <Input
                id="t-phase"
                value={form.phase}
                onChange={(e) => setForm((p) => ({ ...p, phase: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => setForm((p) => ({ ...p, priority: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
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
              <Label htmlFor="t-start" className="text-xs font-semibold">Configured Start</Label>
              <Input
                id="t-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-end" className="text-xs font-semibold">Configured End</Label>
              <Input
                id="t-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-status" className="text-xs font-semibold">Status</Label>
              <Input
                id="t-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-prog" className="text-xs font-semibold">Progress %</Label>
              <Input
                id="t-prog"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((p) => ({ ...p, progress: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-delay" className="text-xs font-semibold">Delay (days)</Label>
              <Input
                id="t-delay"
                type="number"
                value={form.delayDays}
                onChange={(e) => setForm((p) => ({ ...p, delayDays: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="t-desc" className="text-xs font-semibold">Description</Label>
            <Textarea
              id="t-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="text-xs min-h-[60px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save Task Schedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Subtasks({
  task,
  onEditSubTask,
}: {
  task: ApiTaskExt;
  onEditSubTask?: (subtask: {
    id: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    progress: number;
    isChecklistSubTask: boolean;
    taskId?: number;
  }) => void;
}) {
  const { canEdit, user } = useAuth();
  const canEditTask = canEdit || isTaskAssignedToUser(task, user);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);

  const subtasksQueryKey = ["task", task.id, "subtasks"] as const;

  // 1. Fetch checklist subtasks (configured from MPP file)
  const { data: allApiSubTasks = [], isLoading: apiSubTasksLoading } = useQuery({
    queryKey: ["subtasks"],
    queryFn: subTasksApi.list,
  });

  // 2. Fallback fetch from task subtasks action
  const { data: legacySubtasks = (task.subtasks ?? []), isLoading: legacyLoading } = useQuery({
    queryKey: subtasksQueryKey,
    queryFn: () => tasksApi.subtasks.list(task.id),
    initialData: task.subtasks ?? [],
  });

  const linkedChecklistSubtasks = allApiSubTasks.filter((s) => s.taskId === task.id);

  // Combine unified subtasks
  // Combine unified subtasks: use configured checklist subtasks as primary source of truth
  const unifiedSubtasks = useMemo(() => {
    // 1. If checklist SubTask records exist for this task, use them directly as the source of truth
    if (linkedChecklistSubtasks.length > 0) {
      return linkedChecklistSubtasks.map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status || "pending",
        progress: s.progress || 0,
        priority: "medium",
        isChecklistSubTask: true,
      }));
    }

    // 2. Fallback: only if no checklist subtasks exist for this task, use legacy child tasks
    return (legacySubtasks ?? []).map((st: any) => ({
      id: st.id,
      name: st.title || st.name,
      startDate: st.startDate,
      endDate: st.endDate,
      status: st.status || "not_started",
      progress: st.progress || 0,
      priority: st.priority,
      isChecklistSubTask: false,
    }));
  }, [linkedChecklistSubtasks, legacySubtasks]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; priority?: string; startDate?: string; endDate?: string }) => {
      if (!canEditTask) throw new Error("Permission denied");
      return subTasksApi.create({
        taskId: task.id,
        projectId: task.projectId,
        name: data.title,
        status: "pending",
        progress: 0,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey });
      setNewTitle("");
      setStartDate("");
      setDueDate("");
      setShowAddForm(false);
      toast({ title: "Subtask created successfully" });
    },
    onError: (err) => {
      toast({
        title: "Couldn't create subtask",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ subtask, completed }: { subtask: any; completed: boolean }) => {
      if (!canEditTask) throw new Error("Permission denied");
      const nextStatus = completed ? "completed" : "pending";
      const nextProgress = completed ? 100 : 0;
      if (subtask.isChecklistSubTask) {
        return subTasksApi.update(subtask.id, { status: nextStatus, progress: nextProgress });
      } else {
        return tasksApi.update(subtask.id, {
          status: completed ? "completed" : "in_progress",
          progress: nextProgress,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey });
    },
    onError: () => {
      toast({ title: "Failed to update subtask", variant: "destructive" });
    },
  });

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEditTask) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    createMutation.mutate({
      title: trimmed,
      priority,
      startDate: startDate || undefined,
      endDate: dueDate || undefined,
    });
  };

  const completedCount = unifiedSubtasks.filter(
    (st) => st.status?.toLowerCase() === "completed" || st.progress === 100
  ).length;
  const progressPercent = unifiedSubtasks.length > 0 ? Math.round((completedCount / unifiedSubtasks.length) * 100) : 0;
  const isLoading = apiSubTasksLoading && legacyLoading;

  return (
    <div className="mt-5 rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-primary" />
          <h4 className="font-display font-semibold text-sm">
            Subtasks ({completedCount}/{unifiedSubtasks.length})
          </h4>
          {unifiedSubtasks.length > 0 && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {progressPercent}% done
            </Badge>
          )}
        </div>
        {!showAddForm && canEditTask && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subtask
          </Button>
        )}
      </div>

      {unifiedSubtasks.length > 0 && (
        <Progress value={progressPercent} className="h-1.5 bg-muted" />
      )}

      {/* List of subtasks */}
      <div className="space-y-1.5">
        {isLoading && unifiedSubtasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Loading subtasks…</p>
        ) : unifiedSubtasks.length === 0 && !showAddForm ? (
          <div className="text-center py-4 border border-dashed rounded-md bg-muted/20">
            <p className="text-xs text-muted-foreground mb-2">No subtasks created for this task yet.</p>
            {canEditTask && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Create First Subtask
              </Button>
            )}
          </div>
        ) : (
          unifiedSubtasks.map((st) => {
            const isCompleted = st.status?.toLowerCase() === "completed" || st.progress === 100;
            return (
              <div
                key={st.id}
                onClick={() => {
                  if (canEditTask && onEditSubTask) {
                    onEditSubTask({ ...st, taskId: task.id });
                  }
                }}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm transition-all group ${
                  canEditTask ? "cursor-pointer" : ""
                } ${
                  isCompleted ? "bg-muted/30 border-muted" : "bg-card hover:bg-muted/40 hover:border-primary/40 shadow-2xs"
                }`}
                title={canEditTask ? "Click to view & edit subtask schedule" : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEditTask) {
                        toggleMutation.mutate({ subtask: st, completed: !isCompleted });
                      }
                    }}
                    className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      canEditTask ? "cursor-pointer" : "cursor-default opacity-80"
                    } ${
                      isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary bg-background"
                    }`}
                  >
                    {isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs sm:text-sm font-medium group-hover:text-primary transition-colors ${
                        isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {st.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <Badge variant={isCompleted ? "default" : "outline"} className="text-[9px] px-1 py-0 capitalize">
                        {st.status || "Pending"}
                      </Badge>
                      {(st.startDate || st.endDate) && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {st.startDate || "No start"} → {st.endDate || "No end"}
                        </span>
                      )}
                      <span>{st.progress || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Progress value={st.progress || 0} className="h-1.5 w-14 hidden sm:flex" />
                  {canEditTask && onEditSubTask && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSubTask({ ...st, taskId: task.id });
                      }}
                      title="Edit Subtask"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Subtask Form */}
      {showAddForm && canEditTask && (
        <form onSubmit={handleCreate} className="p-3 rounded-md border border-primary/20 bg-primary/5 space-y-2 mt-2">
          <div className="text-xs font-semibold text-primary flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> New Subtask
          </div>
          <Input
            placeholder="Subtask title (e.g. Pour footing concrete, Inspect rebar...)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-xs bg-background"
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-7 text-xs w-[130px] bg-background"
              title="Configured start date"
            />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-7 text-xs w-[100px] bg-background">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-7 text-xs w-[130px] bg-background"
              placeholder="Due date"
            />
            <div className="flex items-center gap-1 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTitle("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs px-3 gap-1"
                disabled={createMutation.isPending || !newTitle.trim()}
              >
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Add
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ============================================================================
// Task attachments: browse files (any type) + live camera capture. Upload
// and delete both persist immediately via documentsApi.
// ============================================================================

function isImageDoc(doc: ApiDocument): boolean {
  const type = (doc.type || "").toUpperCase();
  if (["JPG", "JPEG", "PNG", "WEBP", "GIF", "SVG"].includes(type)) return true;
  const name = (doc.name || "").toLowerCase();
  const file = (doc.file || "").toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    name.endsWith(".svg") ||
    file.endsWith(".jpg") ||
    file.endsWith(".jpeg") ||
    file.endsWith(".png") ||
    file.endsWith(".webp") ||
    file.endsWith(".gif") ||
    file.endsWith(".svg")
  );
}

function TaskAttachments({
  task,
  attachments = [],
  attachmentsLoading = false,
  canEditTask = true,
}: {
  task: ApiTaskExt;
  attachments?: ApiDocument[];
  attachmentsLoading?: boolean;
  canEditTask?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const browseInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [docToDelete, setDocToDelete] = useState<ApiDocument | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<ApiDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentsApi.uploadForTask({
        name: file.name,
        project: task.projectId,
        task: task.id,
        file,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Attachment uploaded" });
    },
    onError: (err) => {
      console.error("Attachment upload failed:", err);
      toast({
        title: "Couldn't upload attachment",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      setDeletingId(id);
      return documentsApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Attachment removed" });
      setDocToDelete(null);
    },
    onError: (err) => {
      console.error("Attachment delete failed:", err);
      toast({
        title: "Couldn't remove attachment",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleUploadFile = async (rawFile: File) => {
    try {
      let fileToUpload = rawFile;
      if (rawFile.size > MAX_UPLOAD_SIZE_BYTES) {
        if (!isImageFile(rawFile)) {
          toast({
            title: "File exceeds 50 MB limit",
            description: `"${rawFile.name}" (${formatBytes(rawFile.size)}) exceeds the 50 MB limit. Only images can be automatically compressed.`,
            variant: "destructive",
          });
          return;
        }

        setIsProcessing(true);
        toast({
          title: "Compressing image…",
          description: `"${rawFile.name}" is ${formatBytes(rawFile.size)}. Compressing under 50 MB before upload.`,
        });

        const result = await processFileForUpload(rawFile, MAX_UPLOAD_SIZE_BYTES);
        fileToUpload = result.file;
        toast({
          title: "Photo compressed",
          description: `Optimized from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)}. Uploading…`,
        });
      }

      await uploadMutation.mutateAsync(fileToUpload);
    } catch (err: unknown) {
      console.error("File processing/upload failed:", err);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to process and upload file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await handleUploadFile(file);
      }
    }
    event.target.value = "";
  };

  return (
    <div className="mt-4">
      <h4 className="font-display font-semibold mb-2 flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Attachments ({attachments.length})
      </h4>

      <input
        ref={browseInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => browseInputRef.current?.click()}
          disabled={uploadMutation.isPending || isProcessing}
        >
          <FolderOpen className="h-4 w-4 mr-1.5" />
          Browse Files
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCameraOpen(true)}
          disabled={uploadMutation.isPending || isProcessing}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Take Photo
        </Button>
        {(uploadMutation.isPending || isProcessing) && (
          <span className="inline-flex items-center text-xs text-muted-foreground gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {isProcessing ? "Compressing photo…" : "Uploading…"}
          </span>
        )}
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => void handleUploadFile(file)}
      />

      {attachmentsLoading ? (
        <p className="text-xs text-muted-foreground">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((doc: ApiDocument) => {
            const isImage = isImageDoc(doc);
            const isDeleting = deleteMutation.isPending && deletingId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-md border text-sm hover:bg-muted/30 transition-colors group"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(doc)}
                    className="relative h-8 w-8 rounded overflow-hidden shrink-0 border bg-muted/40 hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-primary flex items-center justify-center"
                    title="Click to preview photo"
                  >
                    <img
                      src={doc.file}
                      alt={doc.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <ImageIcon className="h-4 w-4 text-warning shrink-0" />
                  </button>
                ) : (
                  docIconMap[doc.type] || <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}

                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(doc)}
                      className="truncate hover:underline text-left font-medium text-foreground text-sm"
                      title="Click to preview photo"
                    >
                      {doc.name}
                    </button>
                  ) : (
                    <a
                      href={doc.file}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:underline font-medium text-foreground"
                    >
                      {doc.name}
                    </a>
                  )}
                  {isImage && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 shrink-0 font-normal">
                      Photo
                    </Badge>
                  )}
                </div>

                <span className="text-xs text-muted-foreground shrink-0">{doc.size}</span>

                {isImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setPreviewPhoto(doc)}
                    title="Preview photo"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}

                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" asChild title="Download file">
                  <a href={doc.file} target="_blank" rel="noreferrer" download>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>

                {canEditTask && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => setDocToDelete(doc)}
                    disabled={isDeleting}
                    title={isImage ? "Remove photo" : "Remove attachment"}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-2xl p-4">
          <DialogHeader>
            <DialogTitle className="truncate text-base">{previewPhoto?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center max-h-[65vh] overflow-hidden rounded-md bg-muted/30 border p-2">
            <img
              src={previewPhoto?.file}
              alt={previewPhoto?.name}
              className="max-h-[60vh] w-auto max-w-full object-contain rounded"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{previewPhoto?.size}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={previewPhoto?.file} target="_blank" rel="noreferrer" download>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </a>
              </Button>
              {canEditTask && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (previewPhoto) {
                      const toDelete = previewPhoto;
                      setPreviewPhoto(null);
                      setDocToDelete(toDelete);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove Photo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {docToDelete && isImageDoc(docToDelete) ? "Remove Photo" : "Remove Attachment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">&quot;{docToDelete?.name}&quot;</span>?
              This file will be permanently removed from this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (docToDelete) {
                  deleteMutation.mutate(docToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Task chat: a lightweight, near-real-time thread separate from Comments.
// Polls every 4s while the dialog is open so messages from other users
// show up without a manual refresh. Sending and deleting both persist to
// the backend immediately.
// ============================================================================

function TaskChat({ task }: { task: ApiTaskExt }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["taskChat", task.id],
    queryFn: () => tasksApi.chat.list(task.id),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => tasksApi.chat.send(task.id, text),
    onSuccess: () => {
      setMessage("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      queryClient.invalidateQueries({ queryKey: ["taskChat", task.id] });
    },
    onError: (err) => {
      console.error("Send chat message failed:", err);
      toast({
        title: "Couldn't send message",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: number) => tasksApi.chat.remove(task.id, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ["taskChat", task.id] });
      const previous = queryClient.getQueryData<ApiChatMessage[]>(["taskChat", task.id]);
      queryClient.setQueryData<ApiChatMessage[]>(["taskChat", task.id], (old) =>
        old?.filter((m) => m.id !== messageId)
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["taskChat", task.id], context.previous);
      }
      console.error("Delete chat message failed:", err);
      toast({
        title: "Couldn't delete message",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["taskChat", task.id] }),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mt-4">
      <h4 className="font-display font-semibold mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Chat {isLoading ? "" : `(${messages.length})`}
      </h4>
      <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet — say something.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-sm group">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-xs">{m.user}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
              </div>

            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message the team… (Shift+Enter for a new line)"
          rows={1}
          className="min-h-[40px] max-h-[160px] resize-none overflow-y-auto"
        />
        <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending} className="shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Assign / Dependency / Duration / Delay controls. Grouped together since
// they're all "who/when/how this task relates to other things" — separate
// from the pure status/progress mutation above.
//
// Accepts the already-fetched `users` list and computed `assignee` as props
// instead of running its own users query, so the PDF export button in
// TaskDetailDialog can share the exact same assignee data without a second,
// duplicate fetch or any risk of the two getting out of sync.
function TaskRelationsPanel({
  task,
  users,
  usersLoading,
  usersError,
  usersErrorObj,
  assignee,
}: {
  task: ApiTaskExt;
  users?: { id: number; name: string; role?: string; department?: string }[];
  usersLoading: boolean;
  usersError: boolean;
  usersErrorObj: unknown;
  assignee?: { id: number; name: string; role?: string; department?: string };
}) {
  const { canEdit, user } = useAuth();
  const canEditTask = canEdit || isTaskAssignedToUser(task, user);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allTasks } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });
  const onMutationError = (error: unknown, context: string) => {
    console.error(`${context} failed:`, error);
    toast({
      title: "Something went wrong",
      description: error instanceof ApiError ? error.message : "Please try again.",
      variant: "destructive",
    });
  };

  const [localStartDate, setLocalStartDate] = useState(task.startDate || "");
  const [localEndDate, setLocalEndDate] = useState(task.endDate || "");
  const [localAssignedTo, setLocalAssignedTo] = useState(task.assignedTo ? String(task.assignedTo) : "unassigned");
  const [localDependsOn, setLocalDependsOn] = useState(task.dependsOn ? String(task.dependsOn) : "none");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLocalStartDate(task.startDate || "");
    setLocalEndDate(task.endDate || "");
    setLocalAssignedTo(task.assignedTo ? String(task.assignedTo) : "unassigned");
    setLocalDependsOn(task.dependsOn ? String(task.dependsOn) : "none");
  }, [task.id, task.startDate, task.endDate, task.assignedTo, task.dependsOn]);

  const hasChanges =
    (localStartDate || null) !== (task.startDate || null) ||
    (localEndDate || null) !== (task.endDate || null) ||
    (localAssignedTo === "unassigned" ? null : Number(localAssignedTo)) !== (task.assignedTo ?? null) ||
    (localDependsOn === "none" ? null : Number(localDependsOn)) !== (task.dependsOn ?? null);

  const durationDays = computeDurationDays(localStartDate || null, localEndDate || null) ?? task.durationDays ?? null;
  const signedDelay = computeSignedDelay({ ...task, endDate: localEndDate || null });

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<ApiTaskExt>) => {
      if (!canEditTask) throw new Error("Permission denied");
      return tasksApi.update(task.id, patch as Partial<ApiTask>);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTaskExt[]>(["tasks"]);
      queryClient.setQueryData<ApiTaskExt[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...patch } : t))
      );
      return { previousTasks };
    },
    onSuccess: () => {
      toast({ title: "Task updated successfully", description: "Schedule and details saved." });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    },
    onError: (err, _patch, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      onMutationError(err, "Update task schedule");
    },
    onSettled: invalidateTasks,
  });

  const handleSave = () => {
    if (!canEditTask) return;
    const newDur = computeDurationDays(localStartDate || null, localEndDate || null);
    patchMutation.mutate({
      startDate: localStartDate || null,
      endDate: localEndDate || null,
      ...(canEdit ? {
        assignedTo: localAssignedTo === "unassigned" ? null : Number(localAssignedTo),
        dependsOn: localDependsOn === "none" ? null : Number(localDependsOn),
      } : {}),
      ...(newDur != null ? { durationDays: newDur } : {}),
    });
  };

  const dependency = allTasks?.find((t) => t.id === (localDependsOn === "none" ? null : Number(localDependsOn))) as ApiTaskExt | undefined;
  const dependencyBlocking = !!dependency && dependency.status !== 'completed';

  return (
    <div className="mt-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Assign to someone */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <UserPlus className="h-3.5 w-3.5" /> Assigned To
          </label>
          <Select
            value={localAssignedTo}
            onValueChange={(v) => setLocalAssignedTo(v)}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Unassigned">
                {localAssignedTo !== "unassigned" && users?.find((u) => String(u.id) === localAssignedTo) ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {initialsOf(users.find((u) => String(u.id) === localAssignedTo)!.name)}
                    </span>
                    <span className="truncate">{toTitleCase(users.find((u) => String(u.id) === localAssignedTo)!.name)}</span>
                  </span>
                ) : (
                  "Unassigned"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
                  Unassigned
                </span>
              </SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  <span className="flex items-center gap-2 py-0.5">
                    <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {initialsOf(u.name)}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm">{toTitleCase(u.name)}</span>
                      {(u.role || u.department) && (
                        <span className="text-[10px] text-muted-foreground">
                          {[u.role, u.department].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignee && (
            <p className="text-xs text-muted-foreground mt-1">Currently: {toTitleCase(assignee.name)}</p>
          )}
          {usersLoading && <p className="text-xs text-muted-foreground mt-1">Loading users…</p>}
          {usersError && (
            <p className="text-xs text-destructive mt-1">
              Couldn't load users{usersErrorObj instanceof ApiError ? `: ${usersErrorObj.message}` : ""}.
            </p>
          )}
        </div>

        {/* Dependency */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Link2 className="h-3.5 w-3.5" /> Depends On
          </label>
          <Select
            value={localDependsOn}
            onValueChange={(v) => setLocalDependsOn(v)}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="No dependency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No dependency</SelectItem>
              {allTasks?.filter((t) => t.id !== task.id).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dependency && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${dependencyBlocking ? 'text-destructive' : 'text-success'}`}>
              {dependencyBlocking && <AlertTriangle className="h-3 w-3" />}
              {dependencyBlocking
                ? `Blocked until "${dependency.title}" is completed`
                : `Dependency "${dependency.title}" is completed`}
            </p>
          )}
        </div>
      </div>

      {/* Start / End date — editable, drives Duration and Delay below */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CalendarDays className="h-3.5 w-3.5" /> Start Date
          </label>
          <Input
            type="date"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
            disabled={!canEditTask}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CalendarDays className="h-3.5 w-3.5" /> End Date
          </label>
          <Input
            type="date"
            value={localEndDate}
            onChange={(e) => setLocalEndDate(e.target.value)}
            disabled={!canEditTask}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Duration + signed delay — both recompute live off startDate/endDate above */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm p-2.5 rounded-md border bg-muted/30">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-medium">
            {durationDays === null ? '—' : `${durationDays} day${durationDays === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm p-2.5 rounded-md border bg-muted/30">
          <span className="text-muted-foreground">Delay:</span>
          <span className={`font-medium ${
            signedDelay === null ? '' : signedDelay > 0 ? 'text-destructive' : signedDelay < 0 ? 'text-success' : 'text-warning'
          }`}>
            {signedDelay === null
              ? '—'
              : signedDelay > 0
                ? `+${signedDelay} day${signedDelay === 1 ? '' : 's'} ${task.status === 'completed' ? 'late' : 'overdue'}`
                : signedDelay < 0
                  ? task.status === 'completed'
                    ? `${Math.abs(signedDelay)} day${signedDelay === -1 ? '' : 's'} early`
                    : `${Math.abs(signedDelay)} day${signedDelay === -1 ? '' : 's'} remaining`
                  : task.status === 'completed'
                    ? 'Completed on time'
                    : 'Due today'}
          </span>
        </div>
      </div>

      {/* Save Button Bar */}
      {canEditTask && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
          <div className="text-xs">
            {hasChanges ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes — click "Save Task" to apply
              </span>
            ) : justSaved ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                Task schedule saved successfully
              </span>
            ) : (
              <span className="text-muted-foreground">
                Task schedule is up to date
              </span>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={patchMutation.isPending || (!hasChanges && !justSaved)}
            className={`h-8 px-4 gap-1.5 font-medium transition-all ${
              hasChanges
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            {patchMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Task
          </Button>
        </div>
      )}
    </div>
  );
}

export function TaskDetailDialog({
  task: initialTask,
  onEditTask,
  onEditSubTask,
}: {
  task: ApiTaskExt;
  onEditTask?: (task: ApiTaskExt) => void;
  onEditSubTask?: (subtask: any) => void;
}) {
  const { canEdit, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allTasksForExport = [] } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  const task = (allTasksForExport.find((t) => t.id === initialTask.id) as ApiTaskExt) ?? initialTask;
  const canEditTask = canEdit || isTaskAssignedToUser(task, user);

  const [newComment, setNewComment] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);

  useEffect(() => {
    setEditedTitle(task.title);
    setIsEditingTitle(false);
  }, [task.id, task.title]);

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const { data: towers } = useQuery({ queryKey: ["towers"], queryFn: towersApi.list });
  const taskStatuses = useTaskStatuses();

  // users fetched here (not just inside TaskRelationsPanel) so both the
  // Assigned To control AND the PDF export button can use the exact same
  // `assignee` value. React Query dedupes this against the ["users"] query
  // key, so it's not an extra network request.
  const { data: users, isLoading: usersLoading, isError: usersError, error: usersErrorObj } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  // Fetch attachments for this task – shared with TaskAttachments and PDF export
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ["documents", "task", task.id],
    queryFn: () => documentsApi.list({ task: task.id }),
  });

  // ============================================================================
  // ✅ FIX FOR "comments disappear after posting": comments now live in their
  // OWN query key — ["task", task.id, "comments"] — populated from a
  // dedicated task-detail fetch, completely separate from the ["tasks"]
  // list-query cache.
  // ============================================================================
  const {
    data: taskComments = task.comments ?? [],
    isLoading: commentsLoading,
  } = useQuery({
    queryKey: ["task", task.id, "comments"],
    queryFn: () => tasksApi.getComments(task.id),
    initialData: task.comments,
  });

  // Fallback for tasks loaded from list endpoint (which omit nested arrays)
  const checklist = task.checklist ?? [];
  const comments = taskComments ?? [];

  const project = projects?.find(p => p.id === task.projectId);
  const tower = towers?.find(t => t.id === task.towerId);
  const assignee = users?.find((u) => u.id === task.assignedTo);
  const dependency = allTasksForExport?.find((t) => t.id === task.dependsOn) as ApiTaskExt | undefined;

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const onMutationError = (error: unknown, context?: string) => {
    console.error(context ? `${context} failed:` : "Mutation failed:", error);
    toast({
      title: "Something went wrong",
      description: error instanceof ApiError ? error.message : "Please try again.",
      variant: "destructive",
    });
  };

  const updateTitleMutation = useMutation({
    mutationFn: (newTitle: string) => tasksApi.update(task.id, { title: newTitle }),
    onMutate: async (newTitle: string) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTaskExt[]>(["tasks"]);
      queryClient.setQueryData<ApiTaskExt[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, title: newTitle } : t))
      );
      return { previousTasks };
    },
    onSuccess: () => {
      toast({ title: "Task title updated" });
      setIsEditingTitle(false);
    },
    onError: (err, _newTitle, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      toast({
        title: "Failed to update title",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: invalidateTasks,
  });

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setIsEditingTitle(false);
      return;
    }
    updateTitleMutation.mutate(trimmed);
  };

  // ============================================================================
  // ✅ FIXED: comments now optimistically update + reconcile against their
  // own ["task", task.id, "comments"] cache key instead of ["tasks"], so the
  // unrelated list refetch that used to wipe them out can never touch them.
  // ============================================================================
  const commentsQueryKey = ["task", task.id, "comments"] as const;

  const commentMutation = useMutation({
    mutationFn: (text: string) => tasksApi.addComment(task.id, text),
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previousComments = queryClient.getQueryData<typeof comments>(commentsQueryKey);
      const tempId = Date.now(); // temporary id, replaced once the server responds
      const optimisticComment = {
        id: tempId,
        user: "You",
        date: new Date().toISOString(),
        text,
      };
      queryClient.setQueryData(commentsQueryKey, (old: typeof comments = []) => [
        ...old,
        optimisticComment,
      ]);
      setNewComment("");
      return { previousComments, tempId };
    },
    onSuccess: (serverComment, _text, context) => {
      // Swap the temp comment for the real server copy (correct id/date/user).
      queryClient.setQueryData(commentsQueryKey, (old: typeof comments = []) =>
        old.map((c) => (c.id === context?.tempId ? (serverComment ?? c) : c))
      );
    },
    onError: (err, _text, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentsQueryKey, context.previousComments);
      }
      onMutationError(err, "Add comment");
    },
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: (itemId: number) => tasksApi.toggleChecklistItem(task.id, itemId),
    onMutate: async (itemId: number) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTask[]>(["tasks"]);
      queryClient.setQueryData<ApiTask[]>(["tasks"], (old) =>
        old?.map((t) =>
          t.id === task.id
            ? {
                ...t,
                checklist: (t.checklist ?? []).map((item) =>
                  item.id === itemId ? { ...item, completed: !item.completed } : item
                ),
              }
            : t
        )
      );
      return { previousTasks };
    },
    onError: (err, _itemId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      onMutationError(err, "Toggle checklist item");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => {
      if (!canEditTask) throw new Error("Permission denied");
      const progress = computeProgressForStatus(newStatus, task.progress);
      return tasksApi.update(task.id, { status: newStatus, progress });
    },
    onMutate: async (newStatus: string) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTask[]>(["tasks"]);
      const progress = computeProgressForStatus(newStatus, task.progress);
      queryClient.setQueryData<ApiTask[]>(["tasks"], (old) =>
        old?.map((t) =>
          t.id === task.id ? { ...t, status: newStatus, progress } : t
        )
      );
      return { previousTasks };
    },
    onError: (err, _newStatus, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      onMutationError(err, "Update status");
    },
    onSettled: invalidateTasks,
  });

  const addComment = () => {
    if (!newComment.trim()) return;
    commentMutation.mutate(newComment);
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    toast({
      title: "Generating Task Report PDF",
      description: "Assembling organization branding, checklist, and site evidence photos...",
    });
    try {
      await exportTaskToPDF(task, {
        project,
        tower,
        assigneeName: assignee ? toTitleCase(assignee.name) : undefined,
        dependencyTitle: dependency?.title,
        attachments,
        comments,
        currentUser: user,
      });
      toast({
        title: "Report Downloaded",
        description: "Task Management Report PDF successfully generated.",
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      toast({
        title: "Export Failed",
        description:
          err instanceof Error
            ? err.message
            : "Failed to generate task PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={priorityColors[task.priority as Priority]}>{task.priority}</Badge>
            <Select value={task.status} onValueChange={v => statusMutation.mutate(v)} disabled={!canEditTask}>
              <SelectTrigger className="w-auto h-6 text-xs border-0 bg-transparent p-0">
                <Badge className={displayStatusColor(task.status)}>{displayStatusLabel(task.status)}</Badge>
              </SelectTrigger>
              <SelectContent>
                {taskStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {canEditTask && onEditTask && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 text-primary border-primary/40 hover:bg-primary/10 font-medium"
                onClick={() => onEditTask(task)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Task
              </Button>
            )}
            {/* export this task as a PDF summary */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="h-8 text-xs gap-1.5"
            >
              {isExportingPDF ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {isExportingPDF ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>

        {/* Configured MPP Schedule Grid */}
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2.5 mt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Configured Schedule (MPP File)
            </h4>
            <Badge variant="secondary" className="text-[11px] font-mono">
              Duration: {computeDurationDays(task.startDate, task.endDate) != null ? `${computeDurationDays(task.startDate, task.endDate)} Days` : task.durationDays != null ? `${task.durationDays} Days` : "—"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg bg-card border border-border/60 shadow-2xs">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-primary" /> Start Date
              </p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {task.startDate
                  ? new Date(task.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                  : "Not specified"}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-card border border-border/60 shadow-2xs">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-primary" /> End Date
              </p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {task.endDate
                  ? new Date(task.endDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                  : "Ongoing"}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-card border border-border/60 shadow-2xs">
              <p className="text-[10px] text-muted-foreground">Baseline Schedule</p>
              <p className="text-xs font-medium text-foreground mt-0.5">
                {task.baselineStartDate || "—"} to {task.baselineEndDate || "—"}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-card border border-border/60 shadow-2xs">
              <p className="text-[10px] text-muted-foreground">Schedule Variance</p>
              <p className={`text-xs font-bold mt-0.5 ${task.delayDays && task.delayDays > 0 ? "text-destructive" : "text-emerald-500"}`}>
                {task.delayDays && task.delayDays > 0 ? `+${task.delayDays}d Delay` : "On Schedule"}
              </p>
            </div>
          </div>
        </div>

        {/* Editable Title Section */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mt-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveTitle();
                } else if (e.key === "Escape") {
                  setIsEditingTitle(false);
                  setEditedTitle(task.title);
                }
              }}
              className="text-lg font-bold font-display h-9 flex-1"
              autoFocus
            />
            <Button
              size="sm"
              className="h-9 px-3 gap-1 bg-primary text-primary-foreground shrink-0"
              onClick={handleSaveTitle}
              disabled={updateTitleMutation.isPending || !editedTitle.trim()}
            >
              {updateTitleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 px-2 shrink-0"
              onClick={() => {
                setIsEditingTitle(false);
                setEditedTitle(task.title);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 mt-2 group/title">
            <DialogTitle className="font-display text-xl">{task.title}</DialogTitle>
            {canEditTask && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-80 group-hover/title:opacity-100 flex items-center gap-1.5 rounded-md hover:bg-muted shrink-0"
                onClick={() => {
                  setEditedTitle(task.title);
                  setIsEditingTitle(true);
                }}
                title="Click to edit task title"
              >
                <Pencil className="h-3.5 w-3.5 text-primary" />
                Edit Title
              </Button>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">{task.description}</p>
        {/* ✅ NEW — created / updated date & time */}
        {task.createdAt && (
          <p className="text-xs text-muted-foreground">
            Created {new Date(task.createdAt).toLocaleString(undefined, {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <> · Updated {new Date(task.updatedAt).toLocaleString(undefined, {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}</>
            )}
          </p>
        )}
      </DialogHeader>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="space-y-3">
          <div className="text-sm"><span className="text-muted-foreground">Project:</span> <span className="font-medium">{project?.name}</span></div>
          {(project?.organizationName || project?.companyName) && (
            <div className="text-sm flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">Organization:</span>
              {resolveImageUrl(project?.organizationLogo) && (
                <img
                  src={resolveImageUrl(project?.organizationLogo)!}
                  alt={project?.organizationName || "Organization"}
                  className="h-5 w-5 rounded object-contain border bg-white p-0.5 shrink-0"
                />
              )}
              <span className="font-medium">
                {[project?.organizationName, project?.companyName].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          <div className="text-sm"><span className="text-muted-foreground">Tower:</span> <span className="font-medium">{tower?.name}</span></div>
          <div className="text-sm"><span className="text-muted-foreground">Department:</span> <span className="font-medium">{task.department}</span></div>
          <div className="text-sm"><span className="text-muted-foreground">Phase:</span> <span className="font-medium">{task.phase}</span></div>
        </div>
        <div className="space-y-3">
          {task.actualStartDate && <div className="text-sm"><span className="text-muted-foreground">Actual Start:</span> <span className="font-medium">{task.actualStartDate}</span></div>}
          {task.criticalPath && <Badge variant="destructive">Critical Path</Badge>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-bold">{task.progress}%</span>
        </div>
        <Progress value={task.progress} className="h-3" />
      </div>

      {/* Assign / dependency / duration / delay */}
      <TaskRelationsPanel
        task={task}
        users={users}
        usersLoading={usersLoading}
        usersError={usersError}
        usersErrorObj={usersErrorObj}
        assignee={assignee}
      />

      {/* Subtasks: View, create, and manage subtasks */}
      <Subtasks task={task} onEditSubTask={onEditSubTask} />

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Checklist ({checklist.filter(c => c.completed).length}/{checklist.length})
          </h4>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 ${canEditTask ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => {
                  if (canEditTask) toggleChecklistMutation.mutate(item.id);
                }}
              >
                <Checkbox checked={item.completed} disabled={!canEditTask} />
                <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments: browse files (any type) / camera capture (front & back) */}
      <TaskAttachments
        task={task}
        attachments={attachments}
        attachmentsLoading={attachmentsLoading}
        canEditTask={canEditTask}
      />

      {/* Chat: separate from Comments below — near-real-time back-and-forth */}
      <TaskChat task={task} />

      {/* Comments — the existing dated/structured log, distinct from Chat above.
          Now sourced from its own ["task", task.id, "comments"] query so it can
          never be wiped by an unrelated ["tasks"] list refetch. */}
      <div className="mt-4">
        <h4 className="font-display font-semibold mb-2 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments ({comments.length})
        </h4>
        <div className="space-y-2 mb-3">
          {commentsLoading && comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading comments…</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{comment.user}</span>
                  <span className="text-xs text-muted-foreground">{comment.date}</span>
                </div>
                <p className="text-muted-foreground">{comment.text}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && addComment()} />
          <Button size="sm" onClick={addComment} disabled={commentMutation.isPending}>Post</Button>
        </div>
      </div>
    </DialogContent>
  );
}

// Full Task Details Modal wrapper (embeds TaskDetailDialog with its own Dialog root)
// Used across Projects.tsx and any module requiring the exact same Task Template
export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  onEditTask,
  onEditSubTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ApiTaskExt | ApiTask | null;
  onEditTask?: (task: ApiTaskExt) => void;
  onEditSubTask?: (subtask: any) => void;
}) {
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TaskDetailDialog
        task={task as ApiTaskExt}
        onEditTask={onEditTask}
        onEditSubTask={onEditSubTask}
      />
    </Dialog>
  );
}

// ✅ FIXED: added `export` — Projects.tsx imports this as a named export
// (`import { TaskRow } from "@/pages/Tasks"`) to render direct-mode task
// rows with the full feature set (chat, attachments, dependencies, etc.).
// Without `export` here, TypeScript reports "no exported member 'TaskRow'".
export function TaskRow({
  task,
  openOnMount,
  onEditTask,
  onEditSubTask,
  allSubTasks = [],
  users = [],
  onFilterAssignee,
}: {
  task: ApiTaskExt;
  openOnMount?: boolean;
  onEditTask?: (task: ApiTaskExt) => void;
  onEditSubTask?: (subtask: any) => void;
  allSubTasks?: ApiSubTask[];
  users?: { id: number; name: string; role?: string; department?: string }[];
  onFilterAssignee?: (userId: number) => void;
}) {
  const { canEdit, user } = useAuth();
  const canEditTask = canEdit || isTaskAssignedToUser(task, user);
  const assignee = users.find((u) => u.id === task.assignedTo || u.id === (task as any).assigned_to);
  const linkedChecklistSubtasks = allSubTasks.filter((s) => s.taskId === task.id);
  const subtasksCount = linkedChecklistSubtasks.length > 0 ? linkedChecklistSubtasks.length : (task.subtasks?.length ?? 0);
  const subtasksCompleted = linkedChecklistSubtasks.length > 0
    ? linkedChecklistSubtasks.filter((s) => s.status?.toLowerCase() === "completed" || s.progress === 100).length
    : (task.subtasks ?? []).filter((s) => s.status === 'completed' || s.progress === 100).length;

  return (
    <Dialog defaultOpen={openOnMount}>
      <DialogTrigger asChild>
        <div className="flex flex-col sm:grid sm:grid-cols-[auto,1fr,auto,auto,auto] items-start sm:items-center gap-2.5 sm:gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors group">
          {/* Status dot + Mobile Title */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto min-w-0">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${displayStatusDot(task.status)}`} />
            <div className="min-w-0 flex-1 sm:hidden">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</p>
                {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
              </div>
            </div>
          </div>

          {/* Desktop Title + sub-info */}
          <div className="hidden sm:block min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</p>
              {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{task.department || "General"}</span>
              <span>·</span>
              <span>{task.phase || "Phase"}</span>
              {assignee && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium ${
                    onFilterAssignee ? "cursor-pointer hover:bg-primary/20 transition-colors" : ""
                  }`}
                  onClick={(e) => {
                    if (onFilterAssignee) {
                      e.stopPropagation();
                      onFilterAssignee(assignee.id);
                    }
                  }}
                  title={onFilterAssignee ? `Filter tasks assigned to ${assignee.name}` : undefined}
                >
                  <UserPlus className="h-3 w-3 shrink-0" />
                  <span>{toTitleCase(assignee.name)}</span>
                </span>
              )}
              {(task.startDate || task.endDate) && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                  <CalendarDays className="h-3 w-3" />
                  {task.startDate || "—"} to {task.endDate || "—"}
                  {task.durationDays ? ` (${task.durationDays}d)` : ""}
                </span>
              )}
              {subtasksCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-muted/80 text-foreground px-1.5 py-0.5 rounded font-medium">
                  <ListTree className="h-3 w-3 text-primary" />
                  {subtasksCompleted}/{subtasksCount} subtasks
                </span>
              )}
            </div>
          </div>

          {/* Mobile sub-info */}
          <div className="sm:hidden flex flex-wrap items-center gap-2 text-xs text-muted-foreground w-full">
            <span>{task.department || "General"}</span>
            <span>·</span>
            <span>{task.phase || "Phase"}</span>
            {assignee && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium ${
                  onFilterAssignee ? "cursor-pointer hover:bg-primary/20 transition-colors" : ""
                }`}
                onClick={(e) => {
                  if (onFilterAssignee) {
                    e.stopPropagation();
                    onFilterAssignee(assignee.id);
                  }
                }}
                title={onFilterAssignee ? `Filter tasks assigned to ${assignee.name}` : undefined}
              >
                <UserPlus className="h-3 w-3 shrink-0" />
                <span>{toTitleCase(assignee.name)}</span>
              </span>
            )}
            {(task.startDate || task.endDate) && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                <CalendarDays className="h-3 w-3" />
                {task.startDate || "—"} to {task.endDate || "—"}
                {task.durationDays ? ` (${task.durationDays}d)` : ""}
              </span>
            )}
            {subtasksCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted/80 text-foreground px-1.5 py-0.5 rounded font-medium">
                <ListTree className="h-3 w-3 text-primary" />
                {subtasksCompleted}/{subtasksCount} subtasks
              </span>
            )}
          </div>

          {/* Priority & Status badges + Progress + Edit Button */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto mt-1 sm:mt-0 flex-wrap">
            <Badge className={`${priorityColors[task.priority as Priority]} text-[10px] whitespace-nowrap`}>
              {task.priority}
            </Badge>

            <Badge className={`${displayStatusColor(task.status)} text-[10px] whitespace-nowrap`}>
              {displayStatusLabel(task.status)}
            </Badge>

            <div className="flex items-center gap-2 w-28 ml-auto sm:ml-0">
              <Progress value={task.progress} className="h-1.5 flex-1" />
              <span className="text-xs font-medium w-8 text-right">{task.progress}%</span>
            </div>

            {canEditTask && onEditTask && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => onEditTask(task)}
                  title="Edit Task Schedule & Details"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogTrigger>
      <TaskDetailDialog task={task} onEditTask={onEditTask} onEditSubTask={onEditSubTask} />
    </Dialog>
  );
}

function KanbanColumn({
  status,
  columnTasks,
  onDrop,
  onEditTask,
  onEditSubTask,
  allSubTasks = [],
  users = [],
  onFilterAssignee,
}: {
  status: string;
  columnTasks: ApiTaskExt[];
  onDrop: (taskId: number, newStatus: string) => void;
  onEditTask?: (task: ApiTaskExt) => void;
  onEditSubTask?: (subtask: any) => void;
  allSubTasks?: ApiSubTask[];
  users?: { id: number; name: string; role?: string; department?: string }[];
  onFilterAssignee?: (userId: number) => void;
}) {
  const { canEdit, user } = useAuth();
  const statusDot = displayStatusDot(status);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-primary/50');
  };
  const handleDragLeave = (e: React.DragEvent) => { e.currentTarget.classList.remove('ring-2', 'ring-primary/50'); };
  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-primary/50');
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onDrop(Number(taskId), status);
  };

  return (
    <div className="min-w-[280px] flex-shrink-0 rounded-lg p-2 bg-muted/30 transition-colors" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDropEvent}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
        <h3 className="font-medium text-sm">{displayStatusLabel(status)}</h3>
        <Badge variant="secondary" className="text-xs ml-auto">{columnTasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {columnTasks.map((task) => {
          const canEditTask = canEdit || isTaskAssignedToUser(task, user);
          const assignee = users.find((u) => u.id === task.assignedTo || u.id === (task as any).assigned_to);
          const linkedChecklistSubtasks = allSubTasks.filter((s) => s.taskId === task.id);
          const subtasksCount = linkedChecklistSubtasks.length > 0 ? linkedChecklistSubtasks.length : (task.subtasks?.length ?? 0);
          const subtasksCompleted = linkedChecklistSubtasks.length > 0
            ? linkedChecklistSubtasks.filter((s) => s.status?.toLowerCase() === "completed" || s.progress === 100).length
            : (task.subtasks ?? []).filter((s) => s.status === 'completed' || s.progress === 100).length;

          return (
            <div
              key={task.id}
              draggable={canEditTask}
              onDragStart={(e) => {
                if (canEditTask) {
                  e.dataTransfer.setData('taskId', String(task.id));
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
            >
              <Dialog>
                <DialogTrigger asChild>
                  <Card className={`${canEditTask ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} hover:shadow-md transition-shadow group`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {canEditTask && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                          <Badge className={`${priorityColors[task.priority as Priority]} text-[9px]`}>{task.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {task.criticalPath && <Badge variant="destructive" className="text-[9px]">CP</Badge>}
                          {canEditTask && onEditTask && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground group-hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTask(task);
                              }}
                              title="Edit Task"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">{task.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{task.department || "General"}</span>
                        <span>·</span>
                        <span>{task.phase || "Phase"}</span>
                      </div>
                      {assignee && (
                        <div
                          className={`inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium mt-0.5 ${
                            onFilterAssignee ? "cursor-pointer hover:bg-primary/20 transition-colors" : ""
                          }`}
                          onClick={(e) => {
                            if (onFilterAssignee) {
                              e.stopPropagation();
                              onFilterAssignee(assignee.id);
                            }
                          }}
                          title={onFilterAssignee ? `Filter tasks assigned to ${assignee.name}` : undefined}
                        >
                          <UserPlus className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate max-w-[120px]">{toTitleCase(assignee.name)}</span>
                        </div>
                      )}
                      {(task.startDate || task.endDate) && (
                        <div className="inline-flex items-center gap-1 font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {task.startDate || "—"} to {task.endDate || "—"}
                        </div>
                      )}
                      {subtasksCount > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
                          <ListTree className="h-3 w-3" />
                          <span>{subtasksCompleted}/{subtasksCount} subtasks</span>
                        </div>
                      )}
                      <Progress value={task.progress} className="h-1" />
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <TaskDetailDialog task={task} onEditTask={onEditTask} onEditSubTask={onEditSubTask} />
              </Dialog>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Tasks = () => {
  const { canEdit, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Set when arriving here from the top search bar (search result → this
  // page), so the matching task's detail dialog opens automatically.
  const openTaskId = (location.state as { openTaskId?: number } | null)?.openTaskId;
  const incomingStatusFilter = (location.state as { statusFilter?: string } | null)?.statusFilter;
  const incomingProjectFilter = (location.state as { projectId?: number | string; projectFilter?: string } | null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(incomingStatusFilter ?? "all");
  const [projectFilter, setProjectFilter] = useState<string>(
    incomingProjectFilter?.projectFilter ?? (incomingProjectFilter?.projectId ? String(incomingProjectFilter.projectId) : "all")
  );
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const { data: allTasks, isLoading, isError, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
  });
  const { data: allSubTasks = [] } = useQuery({
    queryKey: ["subtasks"],
    queryFn: subTasksApi.list,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });
  const taskStatuses = useTaskStatuses();

  // Task edit state
  const [editingTask, setEditingTask] = useState<ApiTaskExt | null>(null);
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);

  // Subtask edit state
  const [editingSubTask, setEditingSubTask] = useState<{
    id: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    progress: number;
    isChecklistSubTask: boolean;
    taskId?: number;
  } | null>(null);
  const [subTaskEditDialogOpen, setSubTaskEditDialogOpen] = useState(false);

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ApiTask> }) => tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task schedule updated successfully" });
      setTaskEditDialogOpen(false);
      setEditingTask(null);
    },
    onError: (err) => {
      toast({
        title: "Failed to update task",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveTask = (values: any) => {
    if (!editingTask) return;
    const canEditTask = canEdit || isTaskAssignedToUser(editingTask, user);
    if (!canEditTask) return;
    const dur = computeDurationDays(values.startDate, values.endDate);
    updateTaskMutation.mutate({
      id: editingTask.id,
      data: {
        ...values,
        ...(dur != null ? { durationDays: dur } : {}),
      },
    });
  };

  const updateSubTaskMutation = useMutation({
    mutationFn: async ({ id, isChecklistSubTask, data }: { id: number; isChecklistSubTask: boolean; data: any }) => {
      if (isChecklistSubTask) {
        return subTasksApi.update(id, data);
      } else {
        return tasksApi.update(id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Subtask updated successfully" });
      setSubTaskEditDialogOpen(false);
      setEditingSubTask(null);
    },
    onError: (err) => {
      toast({
        title: "Failed to update subtask",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSubTask = async (values: any) => {
    if (!editingSubTask) return;
    const parentTask = allTasks?.find((t) => t.id === editingSubTask.taskId);
    const canEditSub = canEdit || isTaskAssignedToUser(parentTask, user);
    if (!canEditSub) return;
    const currentTaskId = editingSubTask.taskId;

    updateSubTaskMutation.mutate({
      id: editingSubTask.id,
      isChecklistSubTask: editingSubTask.isChecklistSubTask,
      data: values,
    });

    // If subtask dates were changed, check if parent task schedule bounds are affected
    if (currentTaskId && (values.startDate || values.endDate)) {
      if (parentTask) {
        const otherSubTasks = allSubTasks.filter(
          (s) => s.taskId === currentTaskId && s.id !== editingSubTask.id
        );
        const allStarts = [values.startDate, ...otherSubTasks.map((s) => s.startDate)].filter(Boolean) as string[];
        const allEnds = [values.endDate, ...otherSubTasks.map((s) => s.endDate)].filter(Boolean) as string[];

        allStarts.sort();
        allEnds.sort();
        const earliestStart = allStarts[0] || values.startDate || parentTask.startDate;
        const latestEnd = allEnds[allEnds.length - 1] || values.endDate || parentTask.endDate;

        if (earliestStart !== parentTask.startDate || latestEnd !== parentTask.endDate) {
          const newDur = computeDurationDays(earliestStart, latestEnd);
          updateTaskMutation.mutate({
            id: currentTaskId,
            data: {
              startDate: earliestStart,
              endDate: latestEnd,
              ...(newDur != null ? { durationDays: newDur } : {}),
            },
          });
        }
      }
    }
  };

  // dragging a card to a new Kanban column also updates progress to match,
  // with an instant optimistic update.
  const dropMutation = useMutation({
    mutationFn: ({ id, status, progress }: { id: number; status: string; progress: number }) => {
      const task = (allTasks ?? []).find((t) => t.id === id);
      if (!canEdit && !isTaskAssignedToUser(task, user)) throw new Error("Permission denied");
      return tasksApi.update(id, { status, progress });
    },
    onMutate: async ({ id, status, progress }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTask[]>(["tasks"]);
      queryClient.setQueryData<ApiTask[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status, progress } : t))
      );
      return { previousTasks };
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Task moved", description: `Task moved to ${displayStatusLabel(variables.status)}.` });
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      console.error("Move task failed:", err);
      toast({
        title: "Couldn't move task",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleDrop = (taskId: number, newStatus: string) => {
    const currentTask = (allTasks ?? []).find((t) => t.id === taskId);
    if (!canEdit && !isTaskAssignedToUser(currentTask, user)) return;
    const progress = computeProgressForStatus(newStatus, currentTask?.progress ?? 0);
    dropMutation.mutate({ id: taskId, status: newStatus, progress });
  };

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading tasks…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load tasks{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const tasks = (allTasks ?? []) as ApiTaskExt[];

  // Show all tasks linked to the project (do not hide tasks with parentId)
  const filtered = tasks.filter((t) => {
    // If not admin, only show tasks assigned to this user
    if (!canEdit && !isTaskAssignedToUser(t, user)) return false;

    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (projectFilter !== "all" && String(t.projectId) !== String(projectFilter)) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

    // Admin assignee filter
    if (canEdit && assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        const hasAssignee =
          t.assignedTo != null ||
          (t.assignedUsers && t.assignedUsers.length > 0) ||
          (t as any).assigned_to != null;
        if (hasAssignee) return false;
      } else {
        const uid = Number(assigneeFilter);
        const matches =
          (t.assignedTo != null && Number(t.assignedTo) === uid) ||
          ((t as any).assigned_to != null && Number((t as any).assigned_to) === uid) ||
          (t.assignedUsers && Array.isArray(t.assignedUsers) && t.assignedUsers.map(Number).includes(uid)) ||
          (t.assignedHod != null && Number(t.assignedHod) === uid);
        if (!matches) return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Execution Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {!canEdit
              ? `${filtered.length} task${filtered.length === 1 ? "" : "s"} assigned to you`
              : assigneeFilter !== "all"
              ? `${filtered.length} task${filtered.length === 1 ? "" : "s"} for selected assignee`
              : projectFilter === "all"
              ? `${tasks.length} tasks across all projects`
              : `${filtered.length} task${filtered.length === 1 ? "" : "s"} in selected project`}
          </p>
        </div>
        {canEdit && <NewTaskDialog onCreated={handleCreated} />}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[180px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full" />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {toTitleCase(u.name)} {u.role ? `(${u.role})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {taskStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                openOnMount={task.id === openTaskId}
                onEditTask={(t) => {
                  setEditingTask(t);
                  setTaskEditDialogOpen(true);
                }}
                onEditSubTask={(st) => {
                  setEditingSubTask(st);
                  setSubTaskEditDialogOpen(true);
                }}
                allSubTasks={allSubTasks}
                users={users}
                onFilterAssignee={(userId) => setAssigneeFilter(String(userId))}
              />
            ))}
          </div>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No tasks match filters</p>}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {taskStatuses.map(({ value: status }) => {
              const columnTasks = filtered.filter((t) => t.status === status);
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  columnTasks={columnTasks}
                  onDrop={handleDrop}
                  onEditTask={(t) => {
                    setEditingTask(t);
                    setTaskEditDialogOpen(true);
                  }}
                  onEditSubTask={(st) => {
                    setEditingSubTask(st);
                    setSubTaskEditDialogOpen(true);
                  }}
                  allSubTasks={allSubTasks}
                  users={users}
                  onFilterAssignee={(userId) => setAssigneeFilter(String(userId))}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Edit Dialog */}
      <TaskEditDialog
        open={taskEditDialogOpen}
        onOpenChange={(open) => {
          setTaskEditDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        onSave={handleSaveTask}
        saving={updateTaskMutation.isPending}
      />

      {/* Subtask Edit Dialog */}
      <SubTaskEditDialog
        open={subTaskEditDialogOpen}
        onOpenChange={(open) => {
          setSubTaskEditDialogOpen(open);
          if (!open) setEditingSubTask(null);
        }}
        subtask={editingSubTask}
        onSave={handleSaveSubTask}
        saving={updateSubTaskMutation.isPending}
      />
    </div>
  );
};

export default Tasks;