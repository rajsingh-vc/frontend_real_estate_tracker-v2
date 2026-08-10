import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, CheckSquare, Plus, Trash2, Edit2, X, Upload, Loader2, ClipboardList, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  checklistTemplatesApi, checklistsApi, tasksApi, projectsApi, statusesApi,
  towersApi, floorsApi,
  type ApiChecklistTemplate, type ChecklistTemplatePayload, type ApiChecklist, ApiError,
} from "@/lib/api";
import { extractTableStructure, autoMatchColumn, type TableStructure } from "@/lib/pdfTableExtractor";

// ----------------------------------------------------------------------------
// PDF import config
// ----------------------------------------------------------------------------

const CHECKLIST_IMPORT_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "templateName", label: "Template Name", required: true },
  { key: "itemText", label: "Checklist Item", required: true },
  { key: "category", label: "Category", required: false },
];

const CHECKLIST_FIELD_SYNONYMS: Record<string, string[]> = {
  templateName: [
    "template", "template name", "checklist", "checklist name",
    "form", "form name", "inspection", "inspection name",
  ],
  itemText: [
    "item", "checklist item", "task", "description", "activity",
    "point", "inspection point", "check point", "step", "particular",
  ],
  category: ["category", "phase", "stage", "section", "group", "discipline"],
};

// ✅ NEW: path to a sample import file. Drop `sample-checklist-import.pdf`
// (provided alongside this component) into your app's `public/` folder so
// this link resolves to it, e.g. `public/sample-checklist-import.pdf`.
const SAMPLE_IMPORT_PDF_PATH = "/sample-checklist-import.pdf";

type ImportGroup = { name: string; category: string; items: string[] };

// ✅ NEW: case/whitespace-insensitive compare helper. Statuses coming back
// from the API aren't guaranteed to match the exact casing used in the
// filter UI (e.g. "pending" vs "Pending"), which was silently breaking the
// status filter below — everything matched or nothing did, depending on
// casing, even though the badges looked "selected".
const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();

const FALLBACK_CHECKLIST_STATUSES = [
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
];

function useChecklistStatuses(): { value: string; label: string }[] {
  const { data = [] } = useQuery({
    queryKey: ["statuses", "checklist"],
    queryFn: () => statusesApi.list("checklist"),
  });
  return data.length > 0 ? data : FALLBACK_CHECKLIST_STATUSES;
}

// ==================== Project Checklists tab ====================
function ProjectChecklistsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: checklists = [], isLoading, isError, error } = useQuery({
    queryKey: ["checklists"],
    queryFn: checklistsApi.list,
  });
  const statusOptions = useChecklistStatuses();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading checklists…</p>;
  }
  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load checklists{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // ✅ FIXED: was `c.status !== statusFilter` (exact, case-sensitive match).
  // Now compares normalized (trimmed + lowercased) values, same as the
  // "Completed" pill styling logic below already does.
  const filtered = checklists.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && normalize(c.status) !== normalize(statusFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search checklists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={!statusFilter ? "default" : "secondary"}
          className="cursor-pointer"
          onClick={() => setStatusFilter(null)}
        >
          All
        </Badge>
        {statusOptions.map(s => (
          <Badge
            key={s.value}
            variant={statusFilter && normalize(statusFilter) === normalize(s.value) ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </Badge>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((checklist: ApiChecklist) => {
          const task = taskById.get(checklist.taskId);
          const project = projectById.get(checklist.projectId);
          const link = task
            ? `/projects/${checklist.projectId}${checklist.towerId ? `/towers/${checklist.towerId}` : ""}${
                checklist.floorId ? `/floors/${checklist.floorId}` : ""
              }${checklist.unitId ? `/units/${checklist.unitId}` : ""}/tasks/${checklist.taskId}/checklists/${checklist.id}`
            : null;

          const CardBody = (
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-display">{checklist.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={normalize(checklist.status) === "completed" ? "default" : "secondary"}
                    className="text-xs w-fit capitalize"
                  >
                    {checklist.status}
                  </Badge>
                  {project && <span className="text-xs text-muted-foreground">{project.name}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{task ? task.title : "Task not found"}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{checklist.progress ?? 0}%</span>
                  </div>
                  <Progress value={checklist.progress ?? 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );

          return link ? (
            <Link key={checklist.id} to={link}>
              {CardBody}
            </Link>
          ) : (
            <div key={checklist.id}>{CardBody}</div>
          );
        })}
        {filtered.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No checklists match your search. Checklists are created from within a task on the Projects page.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ==================== Template Form (extracted and memoized) ====================
// ✅ CHANGED: checklist items are now `{ id, value }` drafts instead of plain
// strings, keyed by a stable id (generated once per item, never reused).
// Before, the item rows were keyed by array index — every insert/remove
// shifted every index below it, so React reused the wrong DOM <input>
// elements for the wrong rows and typing into an item (especially right
// after adding/removing one) could land on the wrong field or appear to do
// nothing. Keying by a stable id fixes that class of bug outright.
export interface ChecklistItemDraft {
  id: string;
  value: string;
}

let itemIdCounter = 0;
const makeItemId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `item-${Date.now()}-${itemIdCounter++}`;

const makeItem = (value = ""): ChecklistItemDraft => ({ id: makeItemId(), value });
const makeItems = (values: string[]): ChecklistItemDraft[] => values.map((v) => makeItem(v));

interface TemplateFormProps {
  formName: string;
  setFormName: (val: string) => void;
  formCategory: string;
  setFormCategory: (val: string) => void;
  formItems: ChecklistItemDraft[];
  setFormItems: (val: ChecklistItemDraft[]) => void;
  formProjectId: string;
  setFormProjectId: (val: string) => void;
  formCategoryId: string;
  setFormCategoryId: (val: string) => void;
  formSubCategoryId: string;
  setFormSubCategoryId: (val: string) => void;
  allProjects: any[];
  formProjectTowers: any[];
  formCategoryFloors: any[];
  onSubmit: () => void;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
}

const TemplateForm = ({
  formName, setFormName,
  formCategory, setFormCategory,
  formItems, setFormItems,
  formProjectId, setFormProjectId,
  formCategoryId, setFormCategoryId,
  formSubCategoryId, setFormSubCategoryId,
  allProjects,
  formProjectTowers,
  formCategoryFloors,
  onSubmit,
  submitLabel,
  submitting,
  onCancel,
}: TemplateFormProps) => {
  // Handlers for items — operate by id now, not by index, so a stale index
  // captured in a closure can never point at the wrong row.
  const updateItem = (id: string, value: string) => {
    setFormItems(formItems.map((it) => (it.id === id ? { ...it, value } : it)));
  };

  const addItem = (afterId: string) => {
    const index = formItems.findIndex((it) => it.id === afterId);
    const newItems = [...formItems];
    newItems.splice(index + 1, 0, makeItem());
    setFormItems(newItems);
  };

  const removeItem = (id: string) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((it) => it.id !== id));
  };

  const addItemAtEnd = () => {
    setFormItems([...formItems, makeItem()]);
  };

  const formProjectHasCategories = formProjectId !== "" && formProjectTowers.length > 0;
  const filledCount = formItems.filter((it) => it.value.trim()).length;

  return (
    <div className="grid gap-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template Name *</Label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Slab Casting"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={formProjectId}
            onValueChange={(v) => {
              setFormProjectId(v);
              setFormCategoryId("");
              setFormSubCategoryId("");
              setFormCategory("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select project (optional)" />
            </SelectTrigger>
            <SelectContent>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{formProjectHasCategories ? "Category" : "Category (Type/Tag)"}</Label>
          {formProjectHasCategories ? (
            <Select
              value={formCategoryId}
              onValueChange={(v) => {
                setFormCategoryId(v);
                setFormSubCategoryId("");
                const tower = formProjectTowers.find((t) => String(t.id) === v);
                setFormCategory(tower?.name ?? "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {formProjectTowers.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder={
                formProjectId ? "No categories set up for this project yet — type a tag" : "e.g., Foundation"
              }
              autoComplete="off"
            />
          )}
        </div>

        {formProjectHasCategories && (
          <div className="space-y-2">
            <Label>Sub Category</Label>
            <Select
              value={formSubCategoryId}
              onValueChange={setFormSubCategoryId}
              disabled={!formCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder={!formCategoryId ? "Select category first" : "Select sub category (optional)"} />
              </SelectTrigger>
              <SelectContent>
                {formCategoryFloors.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name || `Floor ${f.number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Checklist Items</Label>
          <span className="text-xs text-muted-foreground">
            {filledCount} item{filledCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {formItems.map((item, i) => (
            <div key={item.id} className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
              <Input
                value={item.value}
                onChange={(e) => updateItem(item.id, e.target.value)}
                placeholder={`Item ${i + 1}`}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => addItem(item.id)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {formItems.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => removeItem(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItemAtEnd}>
          <Plus className="h-3 w-3 mr-1" />Add Item
        </Button>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={!formName.trim() || submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
};

// ==================== Main Checklists Component ====================
const Checklists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApiChecklistTemplate | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formItems, setFormItems] = useState<ChecklistItemDraft[]>(() => [makeItem()]);
  const [formProjectId, setFormProjectId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSubCategoryId, setFormSubCategoryId] = useState("");

  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterSubCategoryId, setFilterSubCategoryId] = useState("");

  // ----- PDF import state -----
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [extracted, setExtracted] = useState<TableStructure>({ headers: [], rows: [] });
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importManualValues, setImportManualValues] = useState<Record<string, string>>({});
  const [importUseFixedValue, setImportUseFixedValue] = useState<Record<string, boolean>>({});
  const [importFixedValues, setImportFixedValues] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<ImportGroup[]>([]);

  const { data: templates, isLoading, isError, error } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: checklistTemplatesApi.list,
  });

  const { data: allProjects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const { data: allTowers = [] } = useQuery({ queryKey: ["towers"], queryFn: towersApi.list });
  const { data: allFloors = [] } = useQuery({ queryKey: ["floors"], queryFn: floorsApi.list });

  const formProjectTowers = useMemo(
    () => allTowers.filter((t) => t.projectId === Number(formProjectId)),
    [allTowers, formProjectId]
  );
  const formCategoryFloors = useMemo(
    () => allFloors.filter((f) => f.towerId === Number(formCategoryId)),
    [allFloors, formCategoryId]
  );

  const filterProjectTowers = useMemo(
    () => allTowers.filter((t) => t.projectId === Number(filterProjectId)),
    [allTowers, filterProjectId]
  );
  const filterCategoryFloors = useMemo(
    () => allFloors.filter((f) => f.towerId === Number(filterCategoryId)),
    [allFloors, filterCategoryId]
  );

  const projectById = useMemo(() => new Map(allProjects.map((p) => [p.id, p])), [allProjects]);
  const towerById = useMemo(() => new Map(allTowers.map((t) => [t.id, t])), [allTowers]);
  const floorById = useMemo(() => new Map(allFloors.map((f) => [f.id, f])), [allFloors]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
    [queryClient]
  );

  const onMutationError = useCallback(
    (fallback: string) => (err: unknown) => {
      toast({
        title: fallback,
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    [toast]
  );

  const resetForm = useCallback(() => {
    setFormName("");
    setFormCategory("");
    setFormItems([makeItem()]);
    setFormProjectId("");
    setFormCategoryId("");
    setFormSubCategoryId("");
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: ChecklistTemplatePayload) => checklistTemplatesApi.create(payload),
    onSuccess: (template) => {
      invalidate();
      toast({ title: "Template created", description: `"${template.name}" with ${template.items.length} items.` });
      setCreateOpen(false);
      resetForm();
    },
    onError: onMutationError("Couldn't create template"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ChecklistTemplatePayload> }) =>
      checklistTemplatesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Template updated" });
      setEditingTemplate(null);
      resetForm();
    },
    onError: onMutationError("Couldn't update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => checklistTemplatesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Template deleted" });
    },
    onError: onMutationError("Couldn't delete template"),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        importPreview.map((group) =>
          checklistTemplatesApi.create({
            name: group.name,
            category: group.category,
            items: group.items,
          })
        )
      );
      const succeeded = results.filter(
        (r): r is PromiseFulfilledResult<ApiChecklistTemplate> => r.status === "fulfilled"
      );
      const failed = importPreview
        .map((group, i) => ({ group, result: results[i] }))
        .filter(({ result }) => result.status === "rejected");
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      invalidate();
      if (failed.length === 0) {
        toast({
          title: `Imported ${succeeded.length} checklist template${succeeded.length === 1 ? "" : "s"}`,
        });
        resetImportDialog();
      } else {
        toast({
          title:
            succeeded.length > 0
              ? `Imported ${succeeded.length} template(s) — ${failed.length} failed`
              : `Import failed for all ${failed.length} template(s)`,
          description: `Failed: ${failed.map(({ group }) => group.name).join(", ")}`,
          variant: succeeded.length > 0 ? "default" : "destructive",
        });
      }
    },
    onError: onMutationError("Couldn't import checklist templates"),
  });

  const handleCreate = useCallback(() => {
    if (!formName.trim()) return;
    const items = formItems.map((it) => it.value).filter((v) => v.trim());
    if (items.length === 0) return;
    createMutation.mutate({
      name: formName,
      category: formCategory || 'General',
      items,
      projectId: formProjectId ? Number(formProjectId) : null,
      categoryId: formCategoryId ? Number(formCategoryId) : null,
      subCategoryId: formSubCategoryId ? Number(formSubCategoryId) : null,
    });
  }, [formName, formItems, formCategory, formProjectId, formCategoryId, formSubCategoryId, createMutation]);

  const handleEdit = useCallback(() => {
    if (!editingTemplate || !formName.trim()) return;
    const items = formItems.map((it) => it.value).filter((v) => v.trim());
    updateMutation.mutate({
      id: editingTemplate.id,
      data: {
        name: formName,
        category: formCategory || editingTemplate.category,
        items,
        projectId: formProjectId ? Number(formProjectId) : null,
        categoryId: formCategoryId ? Number(formCategoryId) : null,
        subCategoryId: formSubCategoryId ? Number(formSubCategoryId) : null,
      },
    });
  }, [editingTemplate, formName, formItems, formCategory, formProjectId, formCategoryId, formSubCategoryId, updateMutation]);

  const openEdit = useCallback((template: ApiChecklistTemplate) => {
    setFormName(template.name);
    setFormCategory(template.category);
    setFormItems(makeItems([...template.items, ""]));
    setFormProjectId(template.projectId ? String(template.projectId) : "");
    setFormCategoryId(template.categoryId ? String(template.categoryId) : "");
    setFormSubCategoryId(template.subCategoryId ? String(template.subCategoryId) : "");
    setEditingTemplate(template);
  }, []);

  // ----- PDF import helpers -----
  const resolveImportField = useCallback((fieldKey: string, row: string[]): string | undefined => {
    const selection = importMapping[fieldKey];
    if (!selection) return undefined;
    if (selection === "__other__") {
      return importManualValues[fieldKey]?.trim() || undefined;
    }
    if (importUseFixedValue[fieldKey]) {
      return importFixedValues[fieldKey]?.trim() || undefined;
    }
    const idx = extracted.headers.indexOf(selection);
    return idx !== -1 && row[idx] ? row[idx].trim() : undefined;
  }, [importMapping, importManualValues, importUseFixedValue, importFixedValues, extracted.headers]);

  const hasMappedImportValue = useCallback((fieldKey: string): boolean => {
    if (importMapping[fieldKey] === "__other__") return !!importManualValues[fieldKey]?.trim();
    if (importMapping[fieldKey] && importUseFixedValue[fieldKey]) return !!importFixedValues[fieldKey]?.trim();
    return !!importMapping[fieldKey];
  }, [importMapping, importManualValues, importUseFixedValue, importFixedValues]);

  const canPreviewImport = hasMappedImportValue("templateName") && hasMappedImportValue("itemText");

  const getUniqueImportValues = useCallback((headerName: string): string[] => {
    const idx = extracted.headers.indexOf(headerName);
    if (idx === -1) return [];
    const values = extracted.rows.map((row) => row[idx]?.trim()).filter((v): v is string => !!v);
    return Array.from(new Set(values));
  }, [extracted.headers, extracted.rows]);

  const generateImportPreview = useCallback(() => {
    if (!canPreviewImport) {
      toast({ title: "Map a Template Name and Checklist Item column first", variant: "destructive" });
      return;
    }
    const groups = new Map<string, ImportGroup>();
    for (const row of extracted.rows) {
      const itemText = resolveImportField("itemText", row);
      if (!itemText) continue;
      const name = resolveImportField("templateName", row) || "Imported Checklist";
      const cat = resolveImportField("category", row) || "General";
      const key = `${name}__${cat}`;
      if (!groups.has(key)) groups.set(key, { name, category: cat, items: [] });
      groups.get(key)!.items.push(itemText);
    }
    const result = Array.from(groups.values());
    setImportPreview(result);
    if (result.length === 0) {
      toast({ title: "No checklist items found in this PDF", variant: "destructive" });
    } else {
      const totalItems = result.reduce((sum, g) => sum + g.items.length, 0);
      toast({ title: `Preview ready: ${result.length} template(s), ${totalItems} items` });
    }
  }, [canPreviewImport, extracted.rows, resolveImportField, toast]);

  const handleImportFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setImportFile(selected);
    setExtracted({ headers: [], rows: [] });
    setImportMapping({});
    setImportManualValues({});
    setImportUseFixedValue({});
    setImportFixedValues({});
    setImportPreview([]);
    if (!selected || selected.type !== "application/pdf") return;

    setParsingPdf(true);
    try {
      const table = await extractTableStructure(selected);
      setExtracted(table);
      if (table.headers.length > 0) {
        const autoMap: Record<string, string> = {};
        for (const field of CHECKLIST_IMPORT_FIELDS) {
          const matched = autoMatchColumn(table.headers, field.key, CHECKLIST_FIELD_SYNONYMS);
          if (matched) autoMap[field.key] = matched;
        }
        setImportMapping(autoMap);
      }
    } catch (err) {
      console.error("PDF parsing error:", err);
      toast({
        title: "PDF parsing failed",
        description: "Could not extract a table from this file.",
        variant: "destructive",
      });
    } finally {
      setParsingPdf(false);
    }
  }, [toast]);

  const resetImportDialog = useCallback(() => {
    setImportFile(null);
    setExtracted({ headers: [], rows: [] });
    setImportMapping({});
    setImportManualValues({});
    setImportUseFixedValue({});
    setImportFixedValues({});
    setImportPreview([]);
    setImportOpen(false);
  }, []);

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading checklist templates…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load templates{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const allTemplates = templates ?? [];
  const categories = [...new Set(allTemplates.map(t => t.category))];

  // ✅ FIXED: project/category/sub-category filters now compare against
  // normalized strings too, matching the same defensive pattern as the
  // status filter above (guards against stray whitespace in stored ids).
  const filtered = allTemplates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && t.category !== category) return false;
    if (filterProjectId && String(t.projectId ?? "").trim() !== filterProjectId.trim()) return false;
    if (filterCategoryId && String(t.categoryId ?? "").trim() !== filterCategoryId.trim()) return false;
    if (filterSubCategoryId && String(t.subCategoryId ?? "").trim() !== filterSubCategoryId.trim()) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Checklists</h1>
          <p className="text-muted-foreground mt-1">
            {allTemplates.length} templates · manage reusable templates or view checklists created on projects
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="project-checklists">Project Checklists</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {allTemplates.length} templates across {categories.length} categories
            </p>

            <div className="flex items-center gap-2">
              {/* ---- Import from PDF ---- */}
              <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : resetImportDialog())}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Import from PDF</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display text-xl">Import Checklist Templates from PDF</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Not sure how to format your PDF? Grab the sample below.
                      </p>
                      {/* ✅ NEW: sample import file download. Place
                          sample-checklist-import.pdf in your app's public/
                          folder so this resolves. */}
                      <a href={SAMPLE_IMPORT_PDF_PATH} download>
                        <Button type="button" variant="secondary" size="sm">
                          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                          Download Sample PDF
                        </Button>
                      </a>
                    </div>

                    <div className="grid gap-2">
                      <Label>PDF File</Label>
                      <Input type="file" accept="application/pdf" onChange={handleImportFileChange} />
                    </div>

                    {parsingPdf && (
                      <p className="text-sm text-muted-foreground">Parsing PDF table structure…</p>
                    )}

                    {!parsingPdf && extracted.headers.length > 0 && (
                      <div className="space-y-4 border-t pt-4">
                        <p className="text-xs text-muted-foreground">
                          Map each field to a column from the PDF, pin one fixed value for every row, or type your own.
                          Rows that share the same Template Name and Category become one checklist template.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {CHECKLIST_IMPORT_FIELDS.map((field) => {
                            const currentValue = importMapping[field.key] || "none";
                            const isMappedColumn = currentValue !== "none" && currentValue !== "__other__";
                            const columnValueOptions = isMappedColumn ? getUniqueImportValues(currentValue) : [];
                            return (
                              <div key={field.key} className="space-y-1">
                                <Label className="text-xs">
                                  {field.label}
                                  {field.required && " *"}
                                </Label>
                                <Select
                                  value={currentValue}
                                  onValueChange={(val) => {
                                    setImportMapping((prev) => ({ ...prev, [field.key]: val === "none" ? "" : val }));
                                    setImportUseFixedValue((prev) => ({ ...prev, [field.key]: false }));
                                    setImportFixedValues((prev) => ({ ...prev, [field.key]: "" }));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Map to PDF column" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {extracted.headers.map((h) => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                    <SelectItem value="__other__">Other (type my own)</SelectItem>
                                  </SelectContent>
                                </Select>
                                {currentValue === "__other__" && (
                                  <Input
                                    value={importManualValues[field.key] || ""}
                                    onChange={(e) =>
                                      setImportManualValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                                    }
                                    placeholder={`Type ${field.label.toLowerCase()} for all rows`}
                                    className="h-8 text-xs"
                                  />
                                )}
                                {isMappedColumn && (
                                  <div className="space-y-1 pt-0.5">
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        checked={!!importUseFixedValue[field.key]}
                                        onChange={(e) =>
                                          setImportUseFixedValue((prev) => ({ ...prev, [field.key]: e.target.checked }))
                                        }
                                      />
                                      Use one value for all rows instead
                                    </label>
                                    {importUseFixedValue[field.key] && (
                                      <Select
                                        value={importFixedValues[field.key] || ""}
                                        onValueChange={(val) =>
                                          setImportFixedValues((prev) => ({ ...prev, [field.key]: val }))
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue
                                            placeholder={
                                              columnValueOptions.length > 0
                                                ? `Pick ${field.label.toLowerCase()}`
                                                : "No values found in column"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-64">
                                          {columnValueOptions.map((v) => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={generateImportPreview} disabled={!canPreviewImport}>
                            Preview Templates
                          </Button>
                          {importPreview.length > 0 && (
                            <Button size="sm" onClick={() => bulkImportMutation.mutate()} disabled={bulkImportMutation.isPending}>
                              {bulkImportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              {bulkImportMutation.isPending
                                ? "Importing…"
                                : `Import ${importPreview.length} Template${importPreview.length === 1 ? "" : "s"}`}
                            </Button>
                          )}
                        </div>

                        {importPreview.length > 0 && (
                          <div className="max-h-56 overflow-y-auto border rounded p-2 space-y-2 text-xs">
                            {importPreview.map((group, i) => (
                              <div key={i} className="border-b last:border-b-0 pb-2 last:pb-0">
                                <p className="font-medium">
                                  {group.name}{" "}
                                  <span className="text-muted-foreground font-normal">
                                    · {group.category} · {group.items.length} items
                                  </span>
                                </p>
                                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                                  {group.items.slice(0, 4).map((it, j) => <li key={j}>• {it}</li>)}
                                  {group.items.length > 4 && <li>… and {group.items.length - 4} more</li>}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!parsingPdf && importFile && importFile.type === "application/pdf" && extracted.headers.length === 0 && (
                      <p className="text-sm text-muted-foreground">No table structure found in this PDF.</p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={resetImportDialog}>Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* ---- Manual create ---- */}
              <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                  setCreateOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />New Template</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display text-xl">Create Checklist Template</DialogTitle>
                  </DialogHeader>
                  <TemplateForm
                    formName={formName}
                    setFormName={setFormName}
                    formCategory={formCategory}
                    setFormCategory={setFormCategory}
                    formItems={formItems}
                    setFormItems={setFormItems}
                    formProjectId={formProjectId}
                    setFormProjectId={setFormProjectId}
                    formCategoryId={formCategoryId}
                    setFormCategoryId={setFormCategoryId}
                    formSubCategoryId={formSubCategoryId}
                    setFormSubCategoryId={setFormSubCategoryId}
                    allProjects={allProjects}
                    formProjectTowers={formProjectTowers}
                    formCategoryFloors={formCategoryFloors}
                    onSubmit={handleCreate}
                    submitLabel="Create Template"
                    submitting={createMutation.isPending}
                    onCancel={() => { setCreateOpen(false); resetForm(); }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select
              value={filterProjectId}
              onValueChange={(v) => {
                setFilterProjectId(v === "__all__" ? "" : v);
                setFilterCategoryId("");
                setFilterSubCategoryId("");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Projects</SelectItem>
                {allProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterCategoryId}
              onValueChange={(v) => {
                setFilterCategoryId(v === "__all__" ? "" : v);
                setFilterSubCategoryId("");
              }}
              disabled={!filterProjectId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {filterProjectTowers.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterSubCategoryId}
              onValueChange={(v) => setFilterSubCategoryId(v === "__all__" ? "" : v)}
              disabled={!filterCategoryId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sub Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sub Categories</SelectItem>
                {filterCategoryFloors.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name || `Floor ${f.number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={!category ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => setCategory(null)}>All</Badge>
            {categories.map(c => (
              <Badge key={c} variant={category === c ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => setCategory(c)}>{c}</Badge>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => {
              const linkedProject = template.projectId ? projectById.get(template.projectId) : undefined;
              const linkedCategory = template.categoryId ? towerById.get(template.categoryId) : undefined;
              const linkedSubCategory = template.subCategoryId ? floorById.get(template.subCategoryId) : undefined;

              return (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-display">{template.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dialog
                          open={editingTemplate?.id === template.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setEditingTemplate(null);
                              resetForm();
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(template)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="font-display text-xl">Edit Template</DialogTitle>
                            </DialogHeader>
                            <TemplateForm
                              formName={formName}
                              setFormName={setFormName}
                              formCategory={formCategory}
                              setFormCategory={setFormCategory}
                              formItems={formItems}
                              setFormItems={setFormItems}
                              formProjectId={formProjectId}
                              setFormProjectId={setFormProjectId}
                              formCategoryId={formCategoryId}
                              setFormCategoryId={setFormCategoryId}
                              formSubCategoryId={formSubCategoryId}
                              setFormSubCategoryId={setFormSubCategoryId}
                              allProjects={allProjects}
                              formProjectTowers={formProjectTowers}
                              formCategoryFloors={formCategoryFloors}
                              onSubmit={handleEdit}
                              submitLabel="Save Changes"
                              submitting={updateMutation.isPending}
                              onCancel={() => { setEditingTemplate(null); resetForm(); }}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs w-fit">{template.category}</Badge>
                      {linkedProject && (
                        <Badge variant="outline" className="text-xs w-fit">{linkedProject.name}</Badge>
                      )}
                      {linkedCategory && (
                        <Badge variant="outline" className="text-xs w-fit">{linkedCategory.name}</Badge>
                      )}
                      {linkedSubCategory && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {linkedSubCategory.name || `Floor ${linkedSubCategory.number}`}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {template.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3">{template.items.length} items</p>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="p-6 text-sm text-muted-foreground text-center">No templates match your search.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="project-checklists" className="mt-4">
          <ProjectChecklistsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Checklists;