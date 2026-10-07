import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Upload,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { documentsApi, projectsApi, ApiError } from "@/lib/api";

// --- Icons ---
const iconMap: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-5 w-5 text-destructive" />,
  XLSX: <FileSpreadsheet className="h-5 w-5 text-success" />,
  DWG: <File className="h-5 w-5 text-primary" />,
  ZIP: <Image className="h-5 w-5 text-warning" />,
};

const categories = [
  "Planning",
  "Design",
  "Legal",
  "Approvals",
  "Reports",
  "Procurement",
  "Photos",
  "General",
];

// ============================================================================
// Main Component
// ============================================================================

const Documents = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", category: "", projectId: "" });

  const [customProjectName, setCustomProjectName] = useState("");
  const [customProjectLocation, setCustomProjectLocation] = useState("");

  // ----- Queries -----
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const result = await documentsApi.list();
      return result || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: open,
  });

  const projectReady =
    !!form.projectId &&
    (form.projectId !== "__other__" ||
      (customProjectName.trim().length > 0 &&
        customProjectLocation.trim().length > 0));

  // ----- Upload mutation -----
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError("Missing file.", 400);
      if (!form.projectId) throw new ApiError("Missing project.", 400);

      let projectId = form.projectId;

      // Create new project if "Other"
      if (projectId === "__other__") {
        const name = customProjectName.trim();
        const location = customProjectLocation.trim();
        if (!name || !location) {
          throw new ApiError("Enter a name and location for the new project.", 400);
        }
        const newProject = await projectsApi.create({ name, location });
        projectId = String(newProject.id);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }

      const resolvedProjectId = Number(projectId);

      const doc = await documentsApi.uploadWithAssignments({
        name: form.name.trim() || file.name,
        category: form.category || "General",
        project: resolvedProjectId,
        file,
      });

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document uploaded" });
      resetDialog();
    },
    onError: (err) => {
      toast({
        title: "Couldn't upload document",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ----- Delete mutation -----
  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted" });
    },
    onError: (err) => {
      toast({
        title: "Couldn't delete document",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ----- Helpers -----
  const resetDialog = () => {
    setForm({ name: "", category: "", projectId: "" });
    setFile(null);
    setCustomProjectName("");
    setCustomProjectLocation("");
    setOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !form.name) {
      setForm((prev) => ({ ...prev, name: selected.name }));
    }
  };

  const canUpload = !!file && projectReady && !uploadMutation.isPending;

  // ----- Render -----
  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading documents…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load documents
        {error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1 text-sm">{documents.length} documents</p>
        </div>

        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>

        <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetDialog())}>
          <DialogContent
            aria-describedby="dialog-description"
            className="max-w-lg"
          >
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="doc-file">File</Label>
                <Input id="doc-file" type="file" onChange={handleFileChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="doc-name">Name</Label>
                <Input
                  id="doc-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Defaults to file name"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Project</Label>
                  <Select
                    value={form.projectId}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, projectId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">
                        Other (create new project)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {form.projectId === "__other__" && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Input
                        value={customProjectName}
                        onChange={(e) => setCustomProjectName(e.target.value)}
                        placeholder="New project name"
                        className="h-9 text-sm"
                        autoFocus
                      />
                      <Input
                        value={customProjectLocation}
                        onChange={(e) => setCustomProjectLocation(e.target.value)}
                        placeholder="Location"
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button onClick={() => uploadMutation.mutate()} disabled={!canUpload}>
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {uploadMutation.isPending ? "Uploading…" : "Upload Document"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents list */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <Card key={doc.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4">
              {iconMap[doc.type] || <File className="h-5 w-5 text-muted-foreground shrink-0" />}
              <a
                href={doc.file}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-0"
              >
                <p className="font-medium text-sm truncate hover:underline">
                  {doc.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.projectName} · {doc.date}
                </p>
              </a>
              <Badge variant="secondary" className="text-xs hidden md:flex">
                {doc.category}
              </Badge>
              <span className="text-xs text-muted-foreground">{doc.size}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={doc.file} target="_blank" rel="noreferrer" download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteMutation.mutate(doc.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {documents.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No documents uploaded yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Documents;