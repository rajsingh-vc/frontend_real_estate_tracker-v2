import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Landmark, Users, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  societyApi, projectsApi,
  type SocietyPayload, ApiError,
} from "@/lib/api";

type SocietyStatus = "in_formation" | "registered" | "committee_formed";

const defaultStepNames = [
  "Conveyance Deed Preparation",
  "Society Registration Application",
  "First AGM",
  "Committee Election",
  "Bank Account Opening",
];

const Society = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newSociety, setNewSociety] = useState({
    name: "",
    projectId: "",
    status: "in_formation" as SocietyStatus,
  });

  const { data: societies, isLoading, isError, error } = useQuery({
    queryKey: ["societies"],
    queryFn: societyApi.list,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: open });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["societies"] });
  const onMutationError = (fallback: string) => (err: unknown) => {
    toast({
      title: fallback,
      description: err instanceof ApiError ? err.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: SocietyPayload) => societyApi.create(payload),
    onSuccess: () => {
      invalidate();
      setNewSociety({ name: "", projectId: "", status: "in_formation" });
      setOpen(false);
    },
    onError: onMutationError("Couldn't create society"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SocietyStatus }) => societyApi.update(id, { status }),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't update society"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => societyApi.remove(id),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't delete society"),
  });

  const toggleStepMutation = useMutation({
    mutationFn: ({ societyId, stepId }: { societyId: number; stepId: number }) => societyApi.toggleStep(societyId, stepId),
    onSuccess: invalidate,
    onError: onMutationError("Couldn't update step"),
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSociety.name.trim() || !newSociety.projectId) return;

    createMutation.mutate({
      name: newSociety.name.trim(),
      project: Number(newSociety.projectId),
      status: newSociety.status,
      steps: defaultStepNames.map((name) => ({ name, completed: false })),
    });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading societies…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load societies{error instanceof ApiError ? `: ${error.message}` : ""}. Is the backend running?
      </p>
    );
  }

  const allSocieties = societies ?? [];
  const committeesFormed = allSocieties.filter((society) => society.status === "committee_formed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Society Formation</h1>
          <p className="text-muted-foreground mt-1">Post-handover society setup tracking</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Society
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Landmark className="h-5 w-5 text-primary" /><div><p className="text-xl font-display font-bold">{allSocieties.length}</p><p className="text-xs text-muted-foreground">Societies</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-info" /><div><p className="text-xl font-display font-bold">{committeesFormed}</p><p className="text-xs text-muted-foreground">Committees Formed</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><FileText className="h-5 w-5 text-warning" /><div><p className="text-xl font-display font-bold">{allSocieties.filter((society) => society.status === "in_formation").length}</p><p className="text-xs text-muted-foreground">In Formation</p></div></CardContent></Card>
      </div>

      {allSocieties.map((society) => (
        <Card key={society.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display">{society.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{society.projectName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={society.status}
                  onValueChange={(value: SocietyStatus) => updateMutation.mutate({ id: society.id, status: value })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_formation">In Formation</SelectItem>
                    <SelectItem value="committee_formed">Committee Formed</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deleteMutation.mutate(society.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Badge className="capitalize w-fit">{society.status.replace("_", " ")}</Badge>
            <Progress value={society.progress} className="h-2 mt-2" />
          </CardHeader>

          <CardContent className="space-y-2">
            {society.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                <Checkbox
                  checked={step.completed}
                  onCheckedChange={() => toggleStepMutation.mutate({ societyId: society.id, stepId: step.id })}
                />
                <span className={`text-sm flex-1 ${step.completed ? "line-through text-muted-foreground" : ""}`}>{step.name}</span>
                <Badge variant="secondary" className="text-xs capitalize">{step.completed ? "Completed" : "Pending"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {allSocieties.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No societies yet.</CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Society</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="society-name">Society Name</Label>
              <Input
                id="society-name"
                value={newSociety.name}
                onChange={(event) => setNewSociety((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={newSociety.projectId} onValueChange={(value) => setNewSociety((prev) => ({ ...prev, projectId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={newSociety.status}
                onValueChange={(value: SocietyStatus) => setNewSociety((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_formation">In Formation</SelectItem>
                  <SelectItem value="committee_formed">Committee Formed</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newSociety.name.trim() || !newSociety.projectId || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Society"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Society;
