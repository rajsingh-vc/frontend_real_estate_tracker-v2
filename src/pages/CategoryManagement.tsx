import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  organizationApi, companyApi, entityApi, projectsApi, towersApi, floorsApi, resolveImageUrl,
  type Organization, type OrganizationCompany, type Entity,
  type ApiProject, type ApiTower, type ApiFloor,
  type TowerPayload, type FloorPayload, ApiError,
} from "@/lib/api";
import {
  Building2, Landmark, Network, FolderTree, Layers, Plus, Pencil, Trash2, ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// "Category" = Tower, "Sub Category" = Floor. There's no separate Category
// model on the backend, so this reuses the existing tower/floor hierarchy
// (Project -> Tower -> Floor), which already matches Category -> Sub Category.
// ---------------------------------------------------------------------------

interface CategoryFormValues {
  name: string;
  status: string;
  totalFloors: string;
  progress: string;
}

const defaultCategoryForm: CategoryFormValues = {
  name: "",
  status: "",
  totalFloors: "0",
  progress: "0",
};

interface SubCategoryFormValues {
  number: string;
  name: string;
  status: string;
  progress: string;
}

const defaultSubCategoryForm: SubCategoryFormValues = {
  number: "1",
  name: "",
  status: "",
  progress: "0",
};

// ==================== Category (Tower) Dialog ====================
function CategoryDialog({
  open,
  onOpenChange,
  onSave,
  initialCategory,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: CategoryFormValues) => void;
  initialCategory: ApiTower | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<CategoryFormValues>(defaultCategoryForm);

  useState(() => {
    // initialize once per open via effect below
  });

  // Reset form whenever dialog opens or the record being edited changes.
  // (Using a plain useState above kept only for parity with other dialogs;
  // the real sync happens here.)
  useMemoSyncCategoryForm(open, initialCategory, setForm);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialCategory ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Tower A"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category-status">Status</Label>
              <Input
                id="category-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="e.g. Planning, Active, Completed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-floors">Sub Categories Count</Label>
              <Input
                id="category-floors"
                type="number"
                min={0}
                value={form.totalFloors}
                onChange={(e) => setForm((prev) => ({ ...prev, totalFloors: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category-progress">Progress %</Label>
            <Input
              id="category-progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialCategory ? "Update Category" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Small helper hook-like function to sync form state on open/record change,
// kept separate so CategoryDialog above reads cleanly.
import { useEffect as useMemoSyncEffectImport } from "react";
function useMemoSyncCategoryForm(
  open: boolean,
  initialCategory: ApiTower | null,
  setForm: React.Dispatch<React.SetStateAction<CategoryFormValues>>
) {
  useMemoSyncEffectImport(() => {
    if (!open) return;
    if (!initialCategory) {
      setForm(defaultCategoryForm);
      return;
    }
    setForm({
      name: initialCategory.name,
      status: initialCategory.status ?? "",
      totalFloors: String(initialCategory.totalFloors ?? 0),
      progress: String(initialCategory.progress ?? 0),
    });
  }, [open, initialCategory, setForm]);
}

// ==================== Sub Category (Floor) Dialog ====================
function SubCategoryDialog({
  open,
  onOpenChange,
  onSave,
  initialSubCategory,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SubCategoryFormValues) => void;
  initialSubCategory: ApiFloor | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<SubCategoryFormValues>(defaultSubCategoryForm);

  useEffect(() => {
    if (!open) return;
    if (!initialSubCategory) {
      setForm(defaultSubCategoryForm);
      return;
    }
    setForm({
      number: String(initialSubCategory.number ?? 1),
      name: initialSubCategory.name ?? "",
      status: initialSubCategory.status ?? "",
      progress: String(initialSubCategory.progress ?? 0),
    });
  }, [open, initialSubCategory]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.number.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialSubCategory ? "Edit Sub Category" : "New Sub Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subcategory-number">Sequence #</Label>
              <Input
                id="subcategory-number"
                type="number"
                value={form.number}
                onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategory-name">Sub Category Name</Label>
              <Input
                id="subcategory-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Ground Floor"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subcategory-status">Status</Label>
              <Input
                id="subcategory-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategory-progress">Progress %</Label>
              <Input
                id="subcategory-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : initialSubCategory ? "Update Sub Category" : "Create Sub Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Page ====================
import { useEffect } from "react";

function CategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [organizationId, setOrganizationId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [entityId, setEntityId] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiTower | null>(null);

  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<ApiFloor | null>(null);

  // ---- Data ----
  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: organizationApi.list,
  });

  const orgIdNum = organizationId ? Number(organizationId) : null;

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["organization-companies", orgIdNum],
    queryFn: () => companyApi.list(orgIdNum as number),
    enabled: orgIdNum !== null,
  });

  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ["organization-entities", orgIdNum],
    queryFn: () => entityApi.list(orgIdNum as number),
    enabled: orgIdNum !== null,
  });

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list,
  });

  const { data: allSubCategories = [] } = useQuery({
    queryKey: ["floors"],
    queryFn: floorsApi.list,
  });

  // ---- Derived / filtered ----
  const filteredProjects = allProjects.filter((p) => {
    if (organizationId && String(p.organizationId ?? "") !== organizationId) return false;
    if (companyId && String(p.companyId ?? "") !== companyId) return false;
    if (entityId && String(p.entityId ?? "") !== entityId) return false;
    return true;
  });

  const selectedProject = allProjects.find((p) => p.id === selectedProjectId) ?? null;
  const projectCategories = allCategories.filter((c) => c.projectId === selectedProjectId);
  const selectedCategory = projectCategories.find((c) => c.id === selectedCategoryId) ?? null;
  const categorySubCategories = allSubCategories.filter((s) => s.towerId === selectedCategoryId);

  // ---- Selection handlers ----
  const handleOrgChange = (value: string) => {
    setOrganizationId(value);
    setCompanyId("");
    setEntityId("");
    setSelectedProjectId(null);
    setSelectedCategoryId(null);
  };
  const handleCompanyChange = (value: string) => {
    setCompanyId(value);
    setSelectedProjectId(null);
    setSelectedCategoryId(null);
  };
  const handleEntityChange = (value: string) => {
    setEntityId(value);
    setSelectedProjectId(null);
    setSelectedCategoryId(null);
  };
  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setSelectedCategoryId(null);
  };

  // ---- Mutations ----
  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data: TowerPayload) => towersApi.create(data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      toast({ title: "Category created", description: `"${category.name}" has been added.` });
    },
    onError: onMutationError("Couldn't create category"),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TowerPayload> }) => towersApi.update(id, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      toast({ title: "Category updated", description: `"${category.name}" has been saved.` });
    },
    onError: onMutationError("Couldn't update category"),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => towersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["towers"] });
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Category deleted" });
    },
    onError: onMutationError("Couldn't delete category"),
  });

  const createSubCategoryMutation = useMutation({
    mutationFn: (data: FloorPayload) => floorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Sub category created" });
    },
    onError: onMutationError("Couldn't create sub category"),
  });

  const updateSubCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FloorPayload> }) => floorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Sub category updated" });
    },
    onError: onMutationError("Couldn't update sub category"),
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: (id: number) => floorsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      toast({ title: "Sub category deleted" });
    },
    onError: onMutationError("Couldn't delete sub category"),
  });

  // ---- Save/delete handlers ----
  const handleSaveCategory = (values: CategoryFormValues) => {
    if (!selectedProjectId) return;
    const payload: TowerPayload = {
      projectId: selectedProjectId,
      name: values.name.trim(),
      status: values.status.trim() || "planning",
      totalFloors: Number(values.totalFloors || 0),
      progress: Number(values.progress || 0),
    };
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: payload });
    } else {
      createCategoryMutation.mutate(payload);
    }
    setCategoryDialogOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (category: ApiTower) => {
    if (!window.confirm(`Delete category "${category.name}"? This will also delete its sub categories.`)) return;
    if (selectedCategoryId === category.id) setSelectedCategoryId(null);
    deleteCategoryMutation.mutate(category.id);
  };

  const handleSaveSubCategory = (values: SubCategoryFormValues) => {
    if (!selectedProjectId || !selectedCategoryId) return;
    const payload: FloorPayload = {
      towerId: selectedCategoryId,
      projectId: selectedProjectId,
      number: Number(values.number || 0),
      name: values.name.trim(),
      status: values.status.trim() || "active",
      progress: Number(values.progress || 0),
    };
    if (editingSubCategory) {
      updateSubCategoryMutation.mutate({ id: editingSubCategory.id, data: payload });
    } else {
      createSubCategoryMutation.mutate(payload);
    }
    setSubCategoryDialogOpen(false);
    setEditingSubCategory(null);
  };

  const handleDeleteSubCategory = (subCategory: ApiFloor) => {
    const label = subCategory.name || `Floor ${subCategory.number}`;
    if (!window.confirm(`Delete sub category "${label}"?`)) return;
    deleteSubCategoryMutation.mutate(subCategory.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Category Management</h1>
        <p className="text-muted-foreground mt-1">
          Browse categories and sub categories by organization, company, entity, and project
        </p>
      </div>

      {/* ---- Category filter: Organization / Company / Entity ---- */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <h2 className="font-display font-bold text-base">Category Filters</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Organization
              </Label>
              <Select value={organizationId} onValueChange={handleOrgChange}>
                <SelectTrigger>
                  <SelectValue placeholder={orgsLoading ? "Loading…" : "Select organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org: Organization) => {
                    const orgLogo = resolveImageUrl(org.logo);
                    return (
                      <SelectItem key={org.id} value={String(org.id)}>
                        <div className="flex items-center gap-2">
                          {orgLogo ? (
                            <img src={orgLogo} alt="" className="w-4 h-4 rounded object-contain bg-white dark:bg-card shrink-0" />
                          ) : (
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{org.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" /> Company
              </Label>
              <Select value={companyId} onValueChange={handleCompanyChange} disabled={!organizationId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !organizationId ? "Select organization first" : companiesLoading ? "Loading…" : "Select company"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c: OrganizationCompany) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5" /> Entity
              </Label>
              <Select value={entityId} onValueChange={handleEntityChange} disabled={!organizationId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !organizationId ? "Select organization first" : entitiesLoading ? "Loading…" : "Select entity (optional)"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e: Entity) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.entity_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Projects ---- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-display font-bold text-base">Projects</h2>
          <span className="text-xs text-muted-foreground">({filteredProjects.length})</span>
        </div>

        {projectsLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading projects…</p>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No projects match the selected filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project: ApiProject) => {
              const matchedOrg = organizations.find((o: Organization) => o.id === project.organizationId);
              const orgLogoUrl = resolveImageUrl(project.organizationLogo || matchedOrg?.logo);
              return (
                <Card
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedProjectId === project.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-11 w-11 rounded-xl overflow-hidden shrink-0 border border-border/80 flex items-center justify-center bg-white dark:bg-card p-1 shadow-xs">
                          {orgLogoUrl ? (
                            <img
                              src={orgLogoUrl}
                              alt=""
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                                const fallback = e.currentTarget.parentElement?.querySelector(".fallback-icon");
                                if (fallback) (fallback as HTMLElement).style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div className={`fallback-icon h-full w-full bg-primary/10 flex items-center justify-center ${orgLogoUrl ? "hidden" : "flex"}`}>
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-sm truncate">{project.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{project.location}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize shrink-0 text-xs">
                        {project.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Categories (Towers) ---- */}
      {selectedProject && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedProject.name}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-display font-bold text-base text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Categories
              </span>
              <span className="text-xs">({projectCategories.length})</span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Category
            </Button>
          </div>

          {projectCategories.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground text-center">
                No categories yet for this project.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectCategories.map((category) => (
                <Card
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    selectedCategoryId === category.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-sm">{category.name}</h3>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">{category.status}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Add Sub Category"
                          onClick={(event) => {
                            event.stopPropagation();
                            // Select this category so the Sub Categories
                            // section below is scoped to it, and jump
                            // straight into the create dialog — no need to
                            // click the card first, then hunt for the
                            // "New Sub Category" button separately.
                            setSelectedCategoryId(category.id);
                            setEditingSubCategory(null);
                            setSubCategoryDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCategory(category);
                            setCategoryDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCategory(category);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {category.totalFloors} sub categories · {category.progress}% complete
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Sub Categories (Floors) ---- */}
      {selectedCategory && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{selectedProject?.name}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{selectedCategory.name}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-display font-bold text-base text-foreground">Sub Categories</span>
              <span className="text-xs">({categorySubCategories.length})</span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingSubCategory(null);
                setSubCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Sub Category
            </Button>
          </div>

          {categorySubCategories.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground text-center">
                No sub categories yet for this category.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorySubCategories.map((subCategory) => (
                <Card key={subCategory.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-sm">
                        {subCategory.name || `Floor ${subCategory.number}`}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">{subCategory.status || "Active"}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingSubCategory(subCategory);
                            setSubCategoryDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteSubCategory(subCategory)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{subCategory.progress || 0}% complete</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        onSave={handleSaveCategory}
        initialCategory={editingCategory}
        saving={createCategoryMutation.isPending || updateCategoryMutation.isPending}
      />

      <SubCategoryDialog
        open={subCategoryDialogOpen}
        onOpenChange={(open) => {
          setSubCategoryDialogOpen(open);
          if (!open) setEditingSubCategory(null);
        }}
        onSave={handleSaveSubCategory}
        initialSubCategory={editingSubCategory}
        saving={createSubCategoryMutation.isPending || updateSubCategoryMutation.isPending}
      />
    </div>
  );
}

export default CategoryManagement;