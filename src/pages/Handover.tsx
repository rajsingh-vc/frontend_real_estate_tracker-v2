import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  KeyRound, ClipboardList, CheckCircle2, Plus, Trash2,
  Paperclip, FolderOpen, Download, Loader2,
  FileText, FileSpreadsheet, File as FileIcon, Image as ImageIcon,
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
  handoverApi, projectsApi, documentsApi,
  type HandoverUnitPayload, type ApiHandoverUnit, type ApiDocument, ApiError,
} from "@/lib/api";

type HandoverStatus = "snagging" | "inspection" | "not_ready" | "handed_over";

const progressForStatus = (status: HandoverStatus) =>
  status === "handed_over" ? 100 : status === "inspection" ? 70 : status === "snagging" ? 45 : 10;

const docIconMap: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-destructive" />,
  XLSX: <FileSpreadsheet className="h-4 w-4 text-success" />,
  JPG: <ImageIcon className="h-4 w-4 text-warning" />,
  JPEG: <ImageIcon className="h-4 w-4 text-warning" />,
  PNG: <ImageIcon className="h-4 w-4 text-warning" />,
};

// ============================================================================
// Per-unit attachments — same pattern as TaskAttachments in Tasks.tsx, just
// pointed at documentsApi's `handover` filter/upload instead of `task`.
// ============================================================================

function HandoverAttachments({ unit }: { unit: ApiHandoverUnit }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const browseInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["documents", "handover", unit.id],
    queryFn: () => documentsApi.list({ handover: unit.id }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentsApi.uploadForHandover({
        name: file.name,
        project: unit.project,
        handover: unit.id,
        file,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "handover", unit.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Attachment uploaded" });
    },
    onError: (err) => {
      console.error("Handover attachment upload failed:", err);
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
      queryClient.invalidateQueries({ queryKey: ["documents", "handover", unit.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Attachment deleted" });
    },
    onError: (err) => {
      console.error("Handover attachment delete failed:", err);
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
    // Reset so selecting the same file twice in a row still fires onChange
    event.target.value = "";
  };

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments ({attachments.length})
        </h5>
        <div className="flex items-center gap-2">
          {uploadMutation.isPending && (
            <span className="inline-flex items-center text-[11px] text-muted-foreground gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </span>
          )}
          <input
            ref={browseInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => browseInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            Attach Document
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground mt-2">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">No documents attached yet.</p>
      ) : (
        <div className="space-y-1.5 mt-2">
          {attachments.map((doc: ApiDocument) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-1.5 rounded-md border text-xs"
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
              <span className="text-muted-foreground shrink-0">{doc.size}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                <a href={doc.file} target="_blank" rel="noreferrer" download>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-destructive"
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

const Handover = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newUnit, setNewUnit] = useState({
    unit: "",
    tower: "",
    projectId: "",
    buyer: "",
    status: "not_ready" as HandoverStatus,
  });

  const { data: units, isLoading, isError, error } = useQuery({
    queryKey: ["handover-units"],
    queryFn: handoverApi.list,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: open });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["handover-units"] });
  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: HandoverUnitPayload) => handoverApi.create(payload),
    onSuccess: () => {
      invalidate();
      setNewUnit({ unit: "", tower: "", projectId: "", buyer: "", status: "not_ready" });
      setOpen(false);
    },
    onError: onMutationError("Couldn't add unit"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HandoverUnitPayload> }) => handoverApi.update(id, data),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't update unit"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => handoverApi.remove(id),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't delete unit"),
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUnit.unit.trim() || !newUnit.projectId) return;

    createMutation.mutate({
      unit: newUnit.unit.trim(),
      tower: newUnit.tower.trim() || "Tower A",
      project: Number(newUnit.projectId),
      buyer: newUnit.buyer.trim() || "Not Assigned",
      status: newUnit.status,
      progress: progressForStatus(newUnit.status),
    });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading handover units…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load handover units{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const allUnits = units ?? [];
  const count = (status: HandoverStatus) => allUnits.filter((unit) => unit.status === status).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Handover Management</h1>
          <p className="text-muted-foreground mt-1">Unit handover tracking and status</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Unit
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><KeyRound className="h-5 w-5 text-success" /><div><p className="text-xl font-display font-bold">{count("handed_over")}</p><p className="text-xs text-muted-foreground">Handed Over</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><ClipboardList className="h-5 w-5 text-warning" /><div><p className="text-xl font-display font-bold">{count("snagging")}</p><p className="text-xs text-muted-foreground">Snagging</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-info" /><div><p className="text-xl font-display font-bold">{count("inspection")}</p><p className="text-xs text-muted-foreground">Inspection</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-5 w-5 rounded-full bg-muted-foreground/30" /><div><p className="text-xl font-display font-bold">{count("not_ready")}</p><p className="text-xs text-muted-foreground">Not Ready</p></div></CardContent></Card>
      </div>

      <div className="space-y-3">
        {allUnits.map((unit) => (
          <Card key={unit.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 rounded-full shrink-0 ${unit.status === "handed_over" ? "bg-success" : unit.status === "snagging" ? "bg-warning" : unit.status === "inspection" ? "bg-info" : "bg-muted-foreground/30"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{unit.unit} — {unit.tower}</p>
                  <p className="text-xs text-muted-foreground">{unit.projectName} · Buyer: {unit.buyer}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deleteMutation.mutate(unit.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-[180px_1fr] gap-3 items-center">
                <Select
                  value={unit.status}
                  onValueChange={(value: HandoverStatus) =>
                    updateMutation.mutate({ id: unit.id, data: { status: value, progress: progressForStatus(value) } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_ready">Not Ready</SelectItem>
                    <SelectItem value="snagging">Snagging</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="handed_over">Handed Over</SelectItem>
                  </SelectContent>
                </Select>
                <Progress value={unit.progress} className="h-2" />
              </div>

              <Badge variant={unit.status === "handed_over" ? "default" : "secondary"} className="capitalize text-xs">
                {unit.status.replace("_", " ")}
              </Badge>

              {/* Documents attached to this unit — dynamic, same pattern as
                  task attachments (browse -> upload -> list -> download/delete). */}
              <HandoverAttachments unit={unit} />
            </CardContent>
          </Card>
        ))}
        {allUnits.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No handover units yet.</CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Handover Unit</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="handover-unit">Unit</Label>
                <Input
                  id="handover-unit"
                  value={newUnit.unit}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, unit: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handover-tower">Tower</Label>
                <Input
                  id="handover-tower"
                  value={newUnit.tower}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, tower: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select value={newUnit.projectId} onValueChange={(value) => setNewUnit((prev) => ({ ...prev, projectId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handover-buyer">Buyer</Label>
                <Input
                  id="handover-buyer"
                  value={newUnit.buyer}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, buyer: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={newUnit.status}
                onValueChange={(value: HandoverStatus) => setNewUnit((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_ready">Not Ready</SelectItem>
                  <SelectItem value="snagging">Snagging</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="handed_over">Handed Over</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newUnit.unit.trim() || !newUnit.projectId || createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Handover;