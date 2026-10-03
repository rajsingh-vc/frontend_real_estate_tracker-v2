import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { statusLabels, statusColors, priorityColors, type TaskStatus, type Priority } from "@/data/demo-data";
import {
  Search, CheckCircle2, MessageSquare, Plus, GripVertical,
  UserPlus, Link2, AlertTriangle, CalendarDays,
  Paperclip, FolderOpen, Camera, SwitchCamera, Download, Trash2, Loader2,
  FileText, FileSpreadsheet, File as FileIcon, Image as ImageIcon, Send,
  FileDown,
} from "lucide-react";
import { NewTaskDialog } from "@/components/dialogs/NewTaskDialog";
import { useToast } from "@/hooks/use-toast";
import {
  tasksApi, usersApi, projectsApi, towersApi, documentsApi, statusesApi,
  type ApiTask, type ApiDocument, type ApiChatMessage, ApiError,
} from "@/lib/api";

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
// PDF export for a single task. Client-side only (jsPDF) — builds a simple
// text-based summary covering the core fields, checklist, comments, and
// attachments, then triggers a download. No backend round trip required.
// ============================================================================
function exportTaskToPDF(
  task: ApiTaskExt,
  opts: {
    projectName?: string;
    towerName?: string;
    assigneeName?: string;
    dependencyTitle?: string;
    attachments?: ApiDocument[];
    comments?: { id: number; user: string; date: string; text: string }[];
  } = {}
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageBottom = 780;
  let y = 50;

  const ensureRoom = () => {
    if (y > pageBottom) {
      doc.addPage();
      y = 50;
    }
  };

  const line = (text: string, size = 11, bold = false, gap = 16) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 515) as string[];
    wrapped.forEach((l) => {
      ensureRoom();
      doc.text(l, marginX, y);
      y += gap;
    });
  };

  const spacer = (h = 8) => {
    y += h;
  };

  const divider = () => {
    ensureRoom();
    doc.setDrawColor(210);
    doc.line(marginX, y, 555, y);
    y += 14;
  };

  // Title + top meta
  line(task.title, 16, true, 22);
  line(
    `Status: ${displayStatusLabel(task.status)}   ·   Priority: ${task.priority}   ·   Progress: ${task.progress}%`,
    10
  );
  spacer(4);
  divider();

  // Description
  if (task.description) {
    line("Description", 12, true);
    line(task.description);
    spacer();
  }

  // Core details
  line("Details", 12, true);
  if (opts.projectName) line(`Project: ${opts.projectName}`);
  if (opts.towerName) line(`Tower: ${opts.towerName}`);
  if (task.department) line(`Department: ${task.department}`);
  if (task.phase) line(`Phase: ${task.phase}`);
  line(`Assigned To: ${opts.assigneeName || "Unassigned"}`);
  line(`Depends On: ${opts.dependencyTitle || "No dependency"}`);
  if (task.startDate) line(`Start Date: ${task.startDate}`);
  if (task.endDate) line(`End Date: ${task.endDate}`);
  if (task.actualStartDate) line(`Actual Start: ${task.actualStartDate}`);
  if (task.criticalPath) line("Critical Path: Yes");
  spacer();
  divider();

  // Checklist
  const checklist = task.checklist ?? [];
  if (checklist.length > 0) {
    line(`Checklist (${checklist.filter((c) => c.completed).length}/${checklist.length})`, 12, true);
    checklist.forEach((item) => {
      line(`${item.completed ? "[x]" : "[ ]"} ${item.title}`);
    });
    spacer();
    divider();
  }

  // Attachments
  if (opts.attachments && opts.attachments.length > 0) {
    line(`Attachments (${opts.attachments.length})`, 12, true);
    opts.attachments.forEach((doc) => {
      line(`- ${doc.name}  (${doc.type} · ${doc.size})`);
    });
    spacer();
    divider();
  }

  // Comments — now sourced from the dedicated per-task comments query
  // (opts.comments) instead of task.comments, since the list endpoint the
  // `task` prop comes from never includes comments. Falls back to
  // task.comments for backward compatibility if opts.comments is omitted.
  const comments = opts.comments ?? task.comments ?? [];
  if (comments.length > 0) {
    line(`Comments (${comments.length})`, 12, true);
    comments.forEach((c) => {
      line(`${c.user} — ${c.date}`, 10, true, 14);
      line(c.text, 10);
      spacer(4);
    });
  }

  // Footer timestamp
  ensureRoom();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Exported ${new Date().toLocaleString()}`, marginX, pageBottom + 20 > 800 ? y : y);

  const safeTitle = task.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/(^-|-$)/g, "");
  doc.save(`task-${safeTitle || task.id}.pdf`);
}

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
// Task attachments: browse files (any type) + live camera capture. Upload
// and delete both persist immediately via documentsApi.
// ============================================================================

function TaskAttachments({
  task,
  attachments = [],
  attachmentsLoading = false,
}: {
  task: ApiTaskExt;
  attachments?: ApiDocument[];
  attachmentsLoading?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const browseInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

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
    mutationFn: (id: number) => documentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Attachment deleted" });
    },
    onError: (err) => {
      console.error("Attachment delete failed:", err);
      toast({
        title: "Couldn't delete attachment",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => uploadMutation.mutate(file));
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
          disabled={uploadMutation.isPending}
        >
          <FolderOpen className="h-4 w-4 mr-1.5" />
          Browse Files
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCameraOpen(true)}
          disabled={uploadMutation.isPending}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Take Photo
        </Button>
        {uploadMutation.isPending && (
          <span className="inline-flex items-center text-xs text-muted-foreground gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
          </span>
        )}
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => uploadMutation.mutate(file)}
      />

      {attachmentsLoading ? (
        <p className="text-xs text-muted-foreground">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((doc: ApiDocument) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-md border text-sm"
            >
              {docIconMap[doc.type] || <FileIcon className="h-4 w-4 text-muted-foreground" />}
              <a
                href={doc.file}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-0 truncate hover:underline"
              >
                {doc.name}
              </a>
              <span className="text-xs text-muted-foreground shrink-0">{doc.size}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                <a href={doc.file} target="_blank" rel="noreferrer" download>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive"
                onClick={() => deleteMutation.mutate(doc.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteMutation.mutate(m.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<ApiTaskExt>) => tasksApi.update(task.id, patch as Partial<ApiTask>),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<ApiTaskExt[]>(["tasks"]);
      queryClient.setQueryData<ApiTaskExt[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...patch } : t))
      );
      return { previousTasks };
    },
    onError: (err, _patch, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      onMutationError(err, "Update task");
    },
    onSettled: invalidateTasks,
  });

  const dependency = allTasks?.find((t) => t.id === task.dependsOn) as ApiTaskExt | undefined;
  const dependencyBlocking = !!dependency && dependency.status !== 'completed';

  const durationDays = daysBetween(task.startDate, task.endDate);
  const signedDelay = computeSignedDelay(task);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Assign to someone */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <UserPlus className="h-3.5 w-3.5" /> Assigned To
          </label>
          <Select
            value={task.assignedTo ? String(task.assignedTo) : "unassigned"}
            onValueChange={(v) => patchMutation.mutate({ assignedTo: v === "unassigned" ? null : Number(v) })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Unassigned">
                {task.assignedTo && assignee ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {initialsOf(assignee.name)}
                    </span>
                    <span className="truncate">{toTitleCase(assignee.name)}</span>
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
            value={task.dependsOn ? String(task.dependsOn) : "none"}
            onValueChange={(v) => patchMutation.mutate({ dependsOn: v === "none" ? null : Number(v) })}
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
            value={task.startDate || ""}
            onChange={(e) => patchMutation.mutate({ startDate: e.target.value || null })}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CalendarDays className="h-3.5 w-3.5" /> End Date
          </label>
          <Input
            type="date"
            value={task.endDate || ""}
            onChange={(e) => patchMutation.mutate({ endDate: e.target.value || null })}
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
    </div>
  );
}

function TaskDetailDialog({ task }: { task: ApiTaskExt }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

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
  const { data: allTasksForExport } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

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
  //
  // Root cause of the bug: `tasksApi.list()` (the ["tasks"] query) never
  // returns nested `comments` for each row. As long as comments were stored
  // inside that same ["tasks"] cache entry, ANY unrelated invalidation of
  // ["tasks"] elsewhere in the app — a status change, a Kanban drag-drop, a
  // checklist toggle on a different task, another open dialog settling its
  // own mutation — would refetch the list endpoint and silently strip the
  // comments back out, because the list endpoint doesn't know about them.
  //
  // Fix: comments are fetched and mutated through their own query key that
  // nothing else in the app touches, so no unrelated refetch can ever wipe
  // them out again.
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
    // Deliberately NOT invalidating ["tasks"] here — that refetch is what
    // was wiping comments out before, and comments no longer live there.
  });

  // ============================================================================
  // ✅ FIXED (same root cause as commentMutation above): toggling a checklist
  // item used to call `invalidateTasks()` on success, which refetched
  // tasksApi.list() and silently reverted the checklist toggle since the
  // list endpoint doesn't include `checklist`. Now the toggle is applied
  // optimistically and kept — no invalidation to undo it.
  // ============================================================================
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
    // no onSettled: invalidateTasks — see comment above
  });

  // status changes now also send a matching progress value, and update the
  // UI instantly (optimistically) instead of waiting for a full network
  // round trip + refetch before the Select / progress bar move.
  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => {
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

  // wires the shared task/project/tower/assignee/dependency and attachments data
  // already loaded in this dialog into the PDF export helper.
  const handleExportPDF = () => {
    exportTaskToPDF(task, {
      projectName: project?.name,
      towerName: tower?.name,
      assigneeName: assignee ? toTitleCase(assignee.name) : undefined,
      dependencyTitle: dependency?.title,
      attachments,
      comments,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={priorityColors[task.priority as Priority]}>{task.priority}</Badge>
            <Select value={task.status} onValueChange={v => statusMutation.mutate(v)}>
              <SelectTrigger className="w-auto h-6 text-xs border-0 bg-transparent p-0">
                <Badge className={displayStatusColor(task.status)}>{displayStatusLabel(task.status)}</Badge>
              </SelectTrigger>
              <SelectContent>
                {taskStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* export this task as a PDF summary */}
          <Button type="button" variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
        </div>
        <DialogTitle className="font-display text-xl mt-2">{task.title}</DialogTitle>
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
            <div className="text-sm">
              <span className="text-muted-foreground">Organization:</span>{" "}
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

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Checklist ({checklist.filter(c => c.completed).length}/{checklist.length})
          </h4>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleChecklistMutation.mutate(item.id)}>
                <Checkbox checked={item.completed} />
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

// ✅ FIXED: added `export` — Projects.tsx imports this as a named export
// (`import { TaskRow } from "@/pages/Tasks"`) to render direct-mode task
// rows with the full feature set (chat, attachments, dependencies, etc.).
// Without `export` here, TypeScript reports "no exported member 'TaskRow'".
export function TaskRow({ task, openOnMount }: { task: ApiTaskExt; openOnMount?: boolean }) {
  return (
    <Dialog defaultOpen={openOnMount}>
      <DialogTrigger asChild>
        <div className="grid grid-cols-[auto,1fr,auto,auto,auto,auto] items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
          {/* Status dot */}
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${displayStatusDot(task.status)}`} />

          {/* Title + sub-info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{task.title}</p>
              {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span>{task.department}</span>
              <span>·</span>
              <span>{task.phase}</span>
              {/* ✅ NEW — created date */}
              {task.createdAt && (
                <>
                  <span>·</span>
                  <span>Created {new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                </>
              )}
            </div>
          </div>

          {/* Priority badge */}
          <Badge className={`${priorityColors[task.priority as Priority]} text-[10px] whitespace-nowrap`}>
            {task.priority}
          </Badge>

          {/* Status badge */}
          <Badge className={`${displayStatusColor(task.status)} text-[10px] whitespace-nowrap`}>
            {displayStatusLabel(task.status)}
          </Badge>

          {/* Progress bar + percentage */}
          <div className="flex items-center gap-2 w-24">
            <Progress value={task.progress} className="h-1.5 flex-1" />
            <span className="text-xs font-medium w-8 text-right">{task.progress}%</span>
          </div>

          {/* Empty spacer for future actions */}
          <div className="w-6" />
        </div>
      </DialogTrigger>
      <TaskDetailDialog task={task} />
    </Dialog>
  );
}

function KanbanColumn({ status, columnTasks, onDrop }: { status: string; columnTasks: ApiTaskExt[]; onDrop: (taskId: number, newStatus: string) => void }) {
  const statusDot = displayStatusDot(status);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/50'); };
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
        {columnTasks.map((task) => (
          <div key={task.id} draggable onDragStart={e => { e.dataTransfer.setData('taskId', String(task.id)); e.dataTransfer.effectAllowed = 'move'; }}>
            <Dialog>
              <DialogTrigger asChild>
                <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <Badge className={`${priorityColors[task.priority as Priority]} text-[9px]`}>{task.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {task.criticalPath && <Badge variant="destructive" className="text-[9px]">CP</Badge>}
                      </div>
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{task.department}</span>
                      <span>·</span>
                      <span>{task.phase}</span>
                    </div>
                    {/* ✅ NEW — created date */}
                    {task.createdAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Created {new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    <Progress value={task.progress} className="h-1" />
                  </CardContent>
                </Card>
              </DialogTrigger>
              <TaskDetailDialog task={task} />
            </Dialog>
          </div>
        ))}
      </div>
    </div>
  );
}

const Tasks = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Set when arriving here from the top search bar (search result → this
  // page), so the matching task's detail dialog opens automatically.
  const openTaskId = (location.state as { openTaskId?: number } | null)?.openTaskId;
  const incomingStatusFilter = (location.state as { statusFilter?: string } | null)?.statusFilter;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(incomingStatusFilter ?? "all");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: allTasks, isLoading, isError, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
  });
  const taskStatuses = useTaskStatuses();

  // dragging a card to a new Kanban column also updates progress to match,
  // with an instant optimistic update.
  const dropMutation = useMutation({
    mutationFn: ({ id, status, progress }: { id: number; status: string; progress: number }) =>
      tasksApi.update(id, { status, progress }),
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

  // Department is matched as a case-insensitive substring instead of an
  // exact equality check, since the filter field is free text — typing
  // "civ" should match a task with department "Civil" without requiring
  // the exact casing/spelling.
  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (deptFilter.trim() && !t.department?.toLowerCase().includes(deptFilter.trim().toLowerCase())) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Execution Tasks</h1>
          <p className="text-muted-foreground mt-1">{tasks.length} tasks across all projects</p>
        </div>
        <NewTaskDialog onCreated={handleCreated} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {taskStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Department filter is free text instead of a dropdown driven by
            whatever departments happen to exist across current tasks. */}
        <Input
          placeholder="Filter by department..."
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="w-[180px]"
        />
        {/* "Critical" removed — only High / Medium / Low remain. */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
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
              <TaskRow key={task.id} task={task} openOnMount={task.id === openTaskId} />
            ))}
          </div>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No tasks match filters</p>}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {taskStatuses.map(({ value: status }) => {
              const columnTasks = filtered.filter(t => t.status === status);
              return <KanbanColumn key={status} status={status} columnTasks={columnTasks} onDrop={handleDrop} />;
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;