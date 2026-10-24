import { useState, useMemo } from "react";
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
  FileSpreadsheet,
  FileCode,
  File,
  Upload,
  Trash2,
  Download,
  Loader2,
  Search,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  Filter,
  Layers,
  Image as ImageIcon,
  Presentation,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { documentsApi, projectsApi, ApiError, type ApiDocument } from "@/lib/api";
import {
  processFileForUpload,
  formatBytes,
  isImageFile,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/utils/imageCompression";
import { MppImportWizardModal } from "@/components/documents/MppImportWizardModal";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";

// --- Enhanced Icon Resolver ---
const getFormatBadge = (doc: ApiDocument) => {
  const ext = (doc.type || doc.file.rsplit?.(".")?.pop() || "").toUpperCase();
  if (ext === "PDF") {
    return {
      icon: <FileText className="h-5 w-5 text-red-500" />,
      badge: "PDF",
      badgeClass: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
    };
  }
  if (["XLS", "XLSX", "XLSM", "CSV"].includes(ext)) {
    return {
      icon: <FileSpreadsheet className="h-5 w-5 text-emerald-500" />,
      badge: ext,
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    };
  }
  if (["DOC", "DOCX"].includes(ext)) {
    return {
      icon: <FileText className="h-5 w-5 text-blue-500" />,
      badge: "Word",
      badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    };
  }
  if (["MPP", "XML", "MSPDI", "XER"].includes(ext) || doc.isSchedule) {
    return {
      icon: <FileCode className="h-5 w-5 text-purple-500" />,
      badge: "Schedule (MPP)",
      badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400 font-semibold",
    };
  }
  if (["PPT", "PPTX"].includes(ext)) {
    return {
      icon: <Presentation className="h-5 w-5 text-orange-500" />,
      badge: "PowerPoint",
      badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
    };
  }
  if (["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) {
    return {
      icon: <ImageIcon className="h-5 w-5 text-amber-500" />,
      badge: "Image",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    };
  }
  return {
    icon: <File className="h-5 w-5 text-muted-foreground" />,
    badge: ext || "Document",
    badgeClass: "bg-muted text-muted-foreground border-border",
  };
};

const categories = [
  "Planning",
  "Design",
  "Legal",
  "Approvals",
  "Reports",
  "Procurement",
  "Schedules",
  "Photos",
  "General",
];

const formatFilters = [
  { id: "all", label: "All Formats" },
  { id: "mpp", label: "Schedules (MPP/XML)" },
  { id: "pdf", label: "PDF" },
  { id: "excel", label: "Excel / CSV" },
  { id: "word", label: "Word" },
  { id: "images", label: "Images" },
];

const Documents = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [openUpload, setOpenUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "General",
    projectId: "",
    description: "",
    tags: "",
  });
  const [customProjectName, setCustomProjectName] = useState("");
  const [customProjectLocation, setCustomProjectLocation] = useState("");
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [detectedFormatInfo, setDetectedFormatInfo] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>("all");

  // Modals
  const [previewDoc, setPreviewDoc] = useState<ApiDocument | null>(null);
  const [scheduleWizardDoc, setScheduleWizardDoc] = useState<ApiDocument | null>(null);

  // Queries
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
  });

  const projectReady =
    !!form.projectId &&
    (form.projectId !== "__other__" ||
      (customProjectName.trim().length > 0 && customProjectLocation.trim().length > 0));

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError("Missing file.", 400);
      if (!form.projectId) throw new ApiError("Missing project.", 400);

      let projectId = form.projectId;

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
      const tagsArray = form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      let uploadFile = file;
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        if (!isImageFile(file)) {
          throw new ApiError(
            `"${file.name}" (${formatBytes(file.size)}) exceeds the 50 MB upload limit.`,
            400
          );
        }
        toast({
          title: "Compressing image…",
          description: `"${file.name}" is ${formatBytes(file.size)}. Compressing under 50 MB before upload.`,
        });
        const compressed = await processFileForUpload(file, MAX_UPLOAD_SIZE_BYTES);
        uploadFile = compressed.file;
        toast({
          title: "Photo compressed",
          description: `Optimized from ${formatBytes(compressed.originalSize)} to ${formatBytes(compressed.compressedSize)}.`,
        });
      }

      const doc = await documentsApi.upload({
        name: form.name.trim() || uploadFile.name,
        category: form.category || "General",
        project: resolvedProjectId,
        file: uploadFile,
        description: form.description.trim(),
        tags: tagsArray,
      });

      return doc;
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Document uploaded successfully",
        description: newDoc.isSchedule
          ? "Microsoft Project Schedule detected! You can now import tasks & hierarchy."
          : `${newDoc.name} is stored and secured.`,
      });

      resetDialog();

      // If it's an MPP/Schedule file, suggest opening wizard immediately
      if (newDoc.isSchedule) {
        setScheduleWizardDoc(newDoc);
      }
    },
    onError: (err) => {
      toast({
        title: "Couldn't upload document",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Mutation
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

  const resetDialog = () => {
    setForm({ name: "", category: "General", projectId: "", description: "", tags: "" });
    setFile(null);
    setValidationWarning(null);
    setDetectedFormatInfo(null);
    setCustomProjectName("");
    setCustomProjectLocation("");
    setOpenUpload(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setValidationWarning(null);
    setDetectedFormatInfo(null);

    if (selected) {
      if (!form.name) {
        setForm((prev) => ({ ...prev, name: selected.name }));
      }

      if (selected.size > MAX_UPLOAD_SIZE_BYTES) {
        if (isImageFile(selected)) {
          setValidationWarning(
            `Image is ${formatBytes(selected.size)}. It will be automatically compressed under 50 MB before upload.`
          );
        } else {
          setValidationWarning(
            `File size (${formatBytes(selected.size)}) exceeds the 50 MB upload limit.`
          );
        }
      }

      // Pre-flight file validation
      try {
        const val = await documentsApi.validateFile(selected);
        if (!val.valid) {
          setValidationWarning(val.error || "File validation issue.");
        } else {
          setDetectedFormatInfo(val.formatDescription || val.extension || "Valid File");
          if (val.isSchedule) {
            setForm((prev) => ({ ...prev, category: "Schedules" }));
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
  };

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          doc.name.toLowerCase().includes(q) ||
          doc.projectName?.toLowerCase().includes(q) ||
          doc.category?.toLowerCase().includes(q) ||
          doc.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Project filter
      if (selectedProjectFilter !== "all" && String(doc.project) !== selectedProjectFilter) {
        return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "all" && doc.category !== selectedCategoryFilter) {
        return false;
      }

      // Format filter
      if (selectedFormatFilter !== "all") {
        const ext = (doc.type || "").toLowerCase();
        if (selectedFormatFilter === "mpp" && !doc.isSchedule && !["mpp", "xml", "mspdi", "xer"].includes(ext)) {
          return false;
        }
        if (selectedFormatFilter === "pdf" && ext !== "pdf") return false;
        if (selectedFormatFilter === "excel" && !["xls", "xlsx", "xlsm", "csv"].includes(ext)) return false;
        if (selectedFormatFilter === "word" && !["doc", "docx"].includes(ext)) return false;
        if (selectedFormatFilter === "images" && !["png", "jpg", "jpeg", "webp"].includes(ext)) return false;
      }

      return true;
    });
  }, [documents, searchQuery, selectedProjectFilter, selectedCategoryFilter, selectedFormatFilter]);

  const scheduleCount = useMemo(() => documents.filter((d) => d.isSchedule).length, [documents]);

  const canUpload = !!file && projectReady && !uploadMutation.isPending && !validationWarning;

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading centralized document repository…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-semibold text-destructive">
          Couldn't load documents{error instanceof ApiError ? `: ${error.message}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Please check if your backend server is running.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Document Management
            </h1>
            <Badge variant="outline" className="font-semibold text-xs bg-muted/50">
              {documents.length} Files
            </Badge>
            {scheduleCount > 0 && (
              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                {scheduleCount} Project Schedules
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Centralized document storage for drawings, contracts, approvals, and Microsoft Project (.MPP) schedules.
          </p>
        </div>

        <Button onClick={() => setOpenUpload(true)} className="w-full sm:w-auto shadow-sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document / Schedule
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by document name, description, category, or project…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Format Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            {formatFilters.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormatFilter(fmt.id)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all font-medium whitespace-nowrap ${
                  selectedFormatFilter === fmt.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <div className="space-y-2.5">
        {filteredDocuments.map((doc) => {
          const { icon, badge, badgeClass } = getFormatBadge(doc);
          const isMpp = doc.isSchedule || ["MPP", "XML", "MSPDI", "XER"].includes((doc.type || "").toUpperCase());

          return (
            <Card
              key={doc.id}
              className={`hover:shadow-md transition-all border-border/70 ${
                isMpp ? "border-purple-500/30 bg-purple-500/[0.02]" : ""
              }`}
            >
              <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-muted/60 shrink-0 mt-0.5 sm:mt-0">
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        onClick={() => setPreviewDoc(doc)}
                        className="font-semibold text-sm truncate text-foreground hover:text-primary cursor-pointer hover:underline"
                      >
                        {doc.name}
                      </p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4.5 ${badgeClass}`}>
                        {badge}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4.5">
                        v{doc.version || 1}
                      </Badge>
                      {doc.processingStatus && doc.processingStatus !== "ready" && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4.5 capitalize ${
                            doc.processingStatus === "completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : doc.processingStatus === "failed"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse"
                          }`}
                        >
                          {doc.processingStatus}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium text-foreground/80">{doc.projectName}</span>
                      {" • "}
                      <span>{doc.category}</span>
                      {" • "}
                      <span>{doc.size}</span>
                      {" • "}
                      <span>{doc.date}</span>
                      {doc.uploadedByName && (
                        <span> • by {doc.uploadedByName}</span>
                      )}
                    </p>

                    {doc.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  {/* MPP Import Wizard Button */}
                  {isMpp && (
                    <Button
                      size="sm"
                      onClick={() => setScheduleWizardDoc(doc)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm h-8 px-3 text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Import Schedule
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setPreviewDoc(doc)}
                    title="Preview Document"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    asChild
                    title="Download File"
                  >
                    <a href={doc.file} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>


                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDocuments.length === 0 && (
          <Card className="border-dashed border-border/80">
            <CardContent className="py-14 text-center space-y-2">
              <File className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-semibold text-foreground">No documents found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No files matched your filters. Upload PDF, Word, Excel, or Microsoft Project (.MPP) files to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={openUpload} onOpenChange={(next) => (next ? setOpenUpload(true) : resetDialog())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Document / Project Schedule
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* File Dropzone */}
            <div className="grid gap-1.5">
              <Label htmlFor="doc-file" className="text-xs font-semibold">
                Select File (PDF, Word, Excel, MPP, PPT, Images, Text)
              </Label>
              <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-4 text-center cursor-pointer bg-muted/20">
                <Input
                  id="doc-file"
                  type="file"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.mpp,.xml,.mspdi,.xer,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.rtf,.odt,.ods"
                />
                {detectedFormatInfo && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Format: {detectedFormatInfo}
                  </p>
                )}
                {validationWarning && (
                  <p className="text-xs text-destructive font-medium mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {validationWarning}
                  </p>
                )}
              </div>
            </div>

            {/* Document Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="doc-name" className="text-xs font-semibold">
                Document Title
              </Label>
              <Input
                id="doc-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Skyline Tower Master Schedule Q4"
                className="h-9 text-sm"
              />
            </div>

            {/* Category & Project */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Category" />
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

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Target Project</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, projectId: val }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">+ Create new project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Project fields if "Other" */}
            {form.projectId === "__other__" && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border border-border/60">
                <Input
                  value={customProjectName}
                  onChange={(e) => setCustomProjectName(e.target.value)}
                  placeholder="New project name"
                  className="h-8 text-xs"
                />
                <Input
                  value={customProjectLocation}
                  onChange={(e) => setCustomProjectLocation(e.target.value)}
                  placeholder="City / Location"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {/* Description & Tags */}
            <div className="grid gap-1.5">
              <Label htmlFor="doc-desc" className="text-xs font-semibold">
                Description / Notes (Optional)
              </Label>
              <Input
                id="doc-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Baseline construction sequence submitted by contractor"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={resetDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => uploadMutation.mutate()}
              disabled={!canUpload}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {uploadMutation.isPending ? "Uploading & Validating…" : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        open={!!previewDoc}
        onOpenChange={(op) => !op && setPreviewDoc(null)}
        onOpenScheduleWizard={(d) => setScheduleWizardDoc(d)}
      />

      {/* MPP Import Wizard Modal */}
      <MppImportWizardModal
        document={scheduleWizardDoc}
        open={!!scheduleWizardDoc}
        onOpenChange={(op) => !op && setScheduleWizardDoc(null)}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }}
      />
    </div>
  );
};

export default Documents;