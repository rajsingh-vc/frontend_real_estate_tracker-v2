import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Clock, AlertTriangle, FileCheck, Plus, Trash2,
  Paperclip, FolderOpen, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  complianceApi, projectsApi, documentsApi,
  type ApiComplianceItem, type ComplianceItemPayload, type ApiDocument, ApiError,
} from "@/lib/api";

type ComplianceStatus = "completed" | "in_progress" | "pending" | "not_started";

const statusBadgeVariant = (status: string) => (status === "completed" ? "default" : "secondary");

// ============================================================================
// Per-item document attachment — mirrors the task attachment pattern (see
// TaskAttachments in Tasks.tsx): lists any document linked to this
// compliance item via documents?compliance=<id>, and lets the user attach
// one directly from this row without leaving the Compliance page.
// ============================================================================

function ComplianceAttachment({ item }: { item: ApiComplianceItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", "compliance", item.id],
    queryFn: async () => {
      const all = await documentsApi.list({ compliance: item.id });
      // Defensive filter: if the backend doesn't recognize the `compliance`
      // query param yet, DRF silently ignores it and returns every
      // document — which made every compliance row show every upload.
      // Filtering here guarantees each row only ever shows documents
      // actually linked to it, regardless of what the backend does with
      // the query param.
      return all.filter((doc) => doc.compliance === item.id);
    },
  });

  const invalidateDocs = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", "compliance", item.id] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentsApi.uploadForCompliance({
        name: file.name,
        project: item.project,
        compliance: item.id,
        file,
      }),
    onSuccess: () => {
      invalidateDocs();
      toast({ title: "Document attached" });
    },
    onError: (err) => {
      toast({
        title: "Couldn't attach document",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.remove(id),
    onSuccess: () => {
      invalidateDocs();
      toast({ title: "Attachment removed" });
    },
    onError: (err) => {
      toast({
        title: "Couldn't remove attachment",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) uploadMutation.mutate(selected);
    event.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileSelected} />
      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {isLoading ? (
        <span className="text-muted-foreground">Checking attachments…</span>
      ) : docs.length === 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3 w-3 mr-1.5" />
          )}
          {uploadMutation.isPending ? "Attaching…" : "Attach Document"}
        </Button>
      ) : (
        docs.map((doc: ApiDocument) => (
          <span key={doc.id} className="flex items-center gap-1 border rounded-md pl-2 pr-1 py-1 bg-muted/30">
            <a
              href={doc.file}
              target="_blank"
              rel="noreferrer"
              className="hover:underline max-w-[160px] truncate"
              title={doc.name}
            >
              {doc.name}
            </a>
            <span className="text-muted-foreground">· {doc.size}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" asChild>
              <a href={doc.file} target="_blank" rel="noreferrer" download>
                <Download className="h-3 w-3" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive"
              onClick={() => deleteMutation.mutate(doc.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </span>
        ))
      )}
    </div>
  );
}

function ComplianceRow({
  item,
  onStatusChange,
  onProgressCommit,
  onDelete,
  deleting,
}: {
  item: ApiComplianceItem;
  onStatusChange: (status: ComplianceStatus) => void;
  onProgressCommit: (progress: number) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  // Progress is a free-typed number input; committing on every keystroke would
  // fire a network request per digit, so we keep a local draft and only save
  // on blur (or Enter), rather than on every onChange like the local-state
  // version used to.
  const [progressDraft, setProgressDraft] = useState(String(item.progress));
  useEffect(() => setProgressDraft(String(item.progress)), [item.progress]);

  const commit = () => {
    const value = Number(progressDraft || 0);
    if (value !== item.progress) onProgressCommit(value);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div
            className={`h-3 w-3 rounded-full shrink-0 ${
              item.status === "completed"
                ? "bg-success"
                : item.status === "in_progress"
                ? "bg-warning"
                : item.status === "pending"
                ? "bg-destructive"
                : "bg-muted-foreground/30"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.projectName} · Due: {item.dueDate || "NA"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-[180px_1fr_120px] gap-3 items-center">
          <Select value={item.status} onValueChange={(value: ComplianceStatus) => onStatusChange(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Progress value={item.progress} className="h-2" />

          <Input
            type="number"
            min={0}
            max={100}
            value={progressDraft}
            onChange={(event) => setProgressDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && commit()}
          />
        </div>

        <Badge variant={statusBadgeVariant(item.status)} className="capitalize text-xs">
          {item.status.replace("_", " ")}
        </Badge>

        {/* Linked document(s) for this compliance item — attach directly
            from here, or see what was linked during a Documents-page import. */}
        <ComplianceAttachment item={item} />
      </CardContent>
    </Card>
  );
}

const Compliance = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    projectId: "",
    status: "not_started" as ComplianceStatus,
    dueDate: "",
  });

  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: ["compliance-items"],
    queryFn: complianceApi.list,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: open });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["compliance-items"] });
  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ComplianceItemPayload) => complianceApi.create(payload),
    onSuccess: () => {
      invalidate();
      setNewItem({ name: "", projectId: "", status: "not_started", dueDate: "" });
      setOpen(false);
    },
    onError: onMutationError("Couldn't add compliance item"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ComplianceItemPayload> }) => complianceApi.update(id, data),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't update compliance item"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => complianceApi.remove(id),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't delete compliance item"),
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newItem.name.trim() || !newItem.projectId) return;

    createMutation.mutate({
      name: newItem.name.trim(),
      project: Number(newItem.projectId),
      status: newItem.status,
      progress: newItem.status === "completed" ? 100 : 0,
      dueDate: newItem.dueDate || undefined,
    });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading compliance items…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load compliance items{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const allItems = items ?? [];
  const completed = allItems.filter((item) => item.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Compliance Tracking</h1>
          <p className="text-muted-foreground mt-1">{completed}/{allItems.length} compliances cleared</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Compliance
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-success" /><div><p className="text-xl font-display font-bold">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="h-5 w-5 text-warning" /><div><p className="text-xl font-display font-bold">{allItems.filter((item) => item.status === "in_progress" || item.status === "pending").length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="text-xl font-display font-bold">{allItems.filter((item) => item.status === "pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><FileCheck className="h-5 w-5 text-muted-foreground" /><div><p className="text-xl font-display font-bold">{allItems.filter((item) => item.status === "not_started").length}</p><p className="text-xs text-muted-foreground">Not Started</p></div></CardContent></Card>
      </div>

      <div className="space-y-3">
        {allItems.map((item) => (
          <ComplianceRow
            key={item.id}
            item={item}
            deleting={deleteMutation.isPending}
            onStatusChange={(status) =>
              updateMutation.mutate({ id: item.id, data: { status, progress: status === "completed" ? 100 : item.progress } })
            }
            onProgressCommit={(progress) => updateMutation.mutate({ id: item.id, data: { progress } })}
            onDelete={() => deleteMutation.mutate(item.id)}
          />
        ))}
        {allItems.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No compliance items yet.</CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Compliance Item</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="compliance-name">Compliance Name</Label>
              <Input
                id="compliance-name"
                value={newItem.name}
                onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={newItem.projectId} onValueChange={(value) => setNewItem((prev) => ({ ...prev, projectId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={newItem.status}
                  onValueChange={(value: ComplianceStatus) => setNewItem((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="compliance-due-date">Due Date</Label>
                <Input
                  id="compliance-due-date"
                  type="date"
                  value={newItem.dueDate}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newItem.name.trim() || !newItem.projectId || createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Compliance;