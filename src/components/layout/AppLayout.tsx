import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import {
  Search, Camera, Clock, CheckCircle, LogOut, X,
  Building2, Layers, ListChecks, AlertTriangle, User as UserIcon,
} from "lucide-react";
import { UserProfileModal } from "./UserProfileModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth, AuthUser } from "@/contexts/AuthContext";
import {
  projectsApi, towersApi, floorsApi, tasksApi, hurdlesApi,
  type ApiProject, type ApiTower, type ApiFloor, type ApiTask, type ApiHurdle,
} from "@/lib/api";

interface AppLayoutProps {
  children: React.ReactNode;
}

// ---------- Helper: get user initials ----------
function getUserInitials(user: AuthUser | null): string {
  if (!user) return "?";

  // Prefer the display name, fall back to username if name is blank.
  const source = (user.name && user.name.trim()) || (user.username && user.username.trim()) || "";
  if (!source) return "?";

  // ✅ NEW — usernames like "Vibe@Admin" aren't emails, they're
  // "Company@Role"-style handles. Take the first letter of each segment
  // around the "@" instead of treating the whole thing as one word.
  // "Vibe@Admin" -> "VA"
  if (source.includes("@")) {
    const parts = source.split("@").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return parts[0]?.charAt(0).toUpperCase() ?? "?";
  }

  const nameParts = source.split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }
  const first = nameParts[0].charAt(0).toUpperCase();
  const last = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  return first + last;
}

// ---------- Top Search (NEW) ----------
// A single flat search result, normalized across the 5 entity types so the
// dropdown can render/group them uniformly.
type SearchResultType = "project" | "tower" | "floor" | "task" | "hurdle";
interface SearchResult {
  type: SearchResultType;
  id: number;
  title: string;
  subtitle?: string;
  // Parent ids needed to build the correct drill-down path for towers/floors
  // (e.g. /projects/:projectId/towers/:towerId), so selecting a result can
  // route straight to that exact item instead of just the dashboard.
  projectId?: number;
  towerId?: number;
}

const RESULT_ICON: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  project: Building2,
  tower: Building2,
  floor: Layers,
  task: ListChecks,
  hurdle: AlertTriangle,
};

const RESULT_LABEL: Record<SearchResultType, string> = {
  project: "Project",
  tower: "Tower",
  floor: "Floor",
  task: "Task",
  hurdle: "Hurdle",
};

const MAX_PER_GROUP = 4;

function TopSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | SearchResultType>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stale time 0 ensures deleted projects or updated items disappear instantly from search
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: isOpen,
    staleTime: 0,
  });
  const { data: towers = [], isLoading: towersLoading } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list,
    enabled: isOpen,
    staleTime: 0,
  });
  const { data: floors = [], isLoading: floorsLoading } = useQuery({
    queryKey: ["floors"],
    queryFn: floorsApi.list,
    enabled: isOpen,
    staleTime: 0,
  });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
    enabled: isOpen,
    staleTime: 0,
  });
  const { data: hurdles = [], isLoading: hurdlesLoading } = useQuery({
    queryKey: ["hurdles"],
    queryFn: hurdlesApi.list,
    enabled: isOpen,
    staleTime: 0,
  });

  const isLoading = projectsLoading || towersLoading || floorsLoading || tasksLoading || hurdlesLoading;

  const towerById = useMemo(() => new Map(towers.map((t: ApiTower) => [t.id, t])), [towers]);
  const projectById = useMemo(() => new Map(projects.map((p: ApiProject) => [p.id, p])), [projects]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchResult[];

    const scoreMatch = (title: string, subtitle?: string | null): number => {
      const t = title.toLowerCase();
      const s = (subtitle || "").toLowerCase();
      if (t === q) return 1000;
      if (t.startsWith(q)) return 800;
      if (t.split(/\s+/).some((w) => w.startsWith(q))) return 600;
      if (t.includes(q)) return 400;
      if (s.startsWith(q)) return 300;
      if (s.includes(q)) return 200;
      return 0;
    };

    const projectResults: (SearchResult & { score: number })[] = projects
      .map((p: ApiProject) => ({
        type: "project" as const,
        id: p.id,
        title: p.name,
        subtitle: p.location,
        score: Math.max(scoreMatch(p.name, p.location), scoreMatch(p.reraNumber || "", p.location)),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GROUP);

    const towerResults: (SearchResult & { score: number })[] = towers
      .map((t: ApiTower) => {
        const projName = projectById.get(t.projectId)?.name;
        return {
          type: "tower" as const,
          id: t.id,
          title: t.name,
          subtitle: projName,
          projectId: t.projectId,
          score: scoreMatch(t.name, projName),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GROUP);

    const floorResults: (SearchResult & { score: number })[] = floors
      .map((f: ApiFloor) => {
        const towerName = towerById.get(f.towerId)?.name;
        return {
          type: "floor" as const,
          id: f.id,
          title: f.name,
          subtitle: towerName,
          projectId: f.projectId,
          towerId: f.towerId,
          score: scoreMatch(f.name, towerName),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GROUP);

    const taskResults: (SearchResult & { score: number })[] = tasks
      .map((t: ApiTask) => {
        const subtitle = [t.department, t.phase].filter(Boolean).join(" · ");
        return {
          type: "task" as const,
          id: t.id,
          title: t.title,
          subtitle,
          score: Math.max(scoreMatch(t.title, subtitle), scoreMatch(t.department || "", t.phase)),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GROUP);

    const hurdleResults: (SearchResult & { score: number })[] = hurdles
      .map((h: ApiHurdle) => ({
        type: "hurdle" as const,
        id: h.id,
        title: h.title,
        subtitle: h.affectedTower,
        score: Math.max(
          scoreMatch(h.title, h.affectedTower),
          scoreMatch(h.type || "", h.responsibleDepartment)
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GROUP);

    let all = [
      ...projectResults,
      ...towerResults,
      ...floorResults,
      ...taskResults,
      ...hurdleResults,
    ];

    if (categoryFilter !== "all") {
      all = all.filter((r) => r.type === categoryFilter);
    }

    return all;
  }, [query, projects, towers, floors, tasks, hurdles, projectById, towerById, categoryFilter]);

  const grouped = useMemo(() => {
    const groups: Partial<Record<SearchResultType, SearchResult[]>> = {};
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type]!.push(r);
    });
    return groups;
  }, [results]);

  // Close on outside click / Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleSelectResult = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");

    // Route each result type to its actual detail view instead of just the
    // dashboard, so picking a result shows that specific project/tower/
    // floor/task/hurdle rather than a generic landing page.
    switch (result.type) {
      case "project":
        navigate(`/projects/${result.id}`);
        break;
      case "tower":
        // Tower routes are nested under their project.
        navigate(`/projects/${result.projectId}/towers/${result.id}`);
        break;
      case "floor":
        // Floor routes are nested under project + tower.
        navigate(`/projects/${result.projectId}/towers/${result.towerId}/floors/${result.id}`);
        break;
      case "task":
        // Tasks page reads openTaskId from navigation state and
        // auto-opens that task's detail dialog.
        navigate("/tasks", { state: { openTaskId: result.id } });
        break;
      case "hurdle":
        // Hurdle Tracker reads openHurdleId from navigation state and
        // auto-opens that hurdle's detail dialog.
        navigate("/hurdles", { state: { openHurdleId: result.id } });
        break;
      default:
        navigate("/", { state: { searchResult: result } });
    }
  };

  const showDropdown = isOpen && query.trim().length > 0;
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative flex max-w-md flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search projects, tasks, hurdles..."
        className="pl-9 pr-8 bg-muted/50 border-0 h-9"
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute top-full mt-2 w-full max-h-[460px] overflow-y-auto rounded-lg border bg-popover shadow-lg z-50">
          {/* Configurable category pills */}
          <div className="flex items-center gap-1.5 p-2 border-b border-border/60 bg-muted/30 overflow-x-auto text-xs">
            {(["all", "project", "tower", "floor", "task", "hurdle"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat === "all" ? "All" : RESULT_LABEL[cat] + "s"}
              </button>
            ))}
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">Searching…</p>
          )}
          {!isLoading && !hasResults && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No results for "{query}" {categoryFilter !== "all" ? `in ${RESULT_LABEL[categoryFilter]}s` : ""}
            </p>
          )}
          {!isLoading && hasResults && (
            <div className="py-1">
              {(Object.keys(grouped) as SearchResultType[]).map(type => {
                const items = grouped[type]!;
                const Icon = RESULT_ICON[type];
                return (
                  <div key={type} className="py-1">
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {RESULT_LABEL[type]}s
                    </p>
                    {items.map(item => (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Profile Menu Component (UPDATED) ----------
interface ProfileMenuProps {
  user: AuthUser | null;
  onLogout: () => void;
}

function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  // Existing state
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInImage, setCheckInImage] = useState<string | null>(null);
  const [checkOutImage, setCheckOutImage] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"in" | "out" | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false); // NEW: loading for camera start
  const [isConfirming, setIsConfirming] = useState(false); // NEW: prevent double‑click
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Location states
  const [checkInLocation, setCheckInLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [checkOutLocation, setCheckOutLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initials = getUserInitials(user);
  const displayName = user?.name || user?.username || "User";
  // ✅ NEW — superusers have no Role record assigned on the backend (role
  // is null for SuperAdmin by design), so user.role comes back blank for
  // them. Show "Super Admin" explicitly in that case instead of falling
  // through to a blank/"User" label.
  const displayRole = user?.is_superuser ? "Super Admin" : user?.role || "";

  // ---------- Improved camera start with fallback & retry ----------
  // Camera and geolocation are browser APIs that ONLY work in a "secure
  // context" — https://, or http://localhost during local dev. This has
  // nothing to do with the user's role: if the app is opened over a plain
  // http:// address (a deployed domain without TLS, or a LAN IP like
  // http://192.168.x.x:5173), EVERY user's browser silently blocks camera
  // and location — it just looks "admin only" because the person testing
  // as SuperAdmin was usually doing so on localhost. Detect it up front so
  // the error message tells you what's actually wrong.
  const isSecureContext =
    typeof window !== "undefined" &&
    (window.isSecureContext ?? (window.location.protocol === "https:" || window.location.hostname === "localhost"));

  const startCamera = async () => {
    if (isStartingCamera) return;
    setIsStartingCamera(true);
    setCameraError(null);
    setIsCameraReady(false);

    // Stop any existing stream
    stopCamera();

    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera requires a secure connection (HTTPS). This page was opened over an insecure address, " +
          "so the browser is blocking camera access for every user here — not just this account. " +
          "Ask your admin to serve the app over HTTPS (or open it via localhost while testing locally)."
      );
      setIsCameraReady(false);
      setIsStartingCamera(false);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (envError) {
        console.warn("Rear camera failed, trying front camera:", envError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraReady(true);
        setCameraError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        "Could not access camera. Please allow camera permissions and try again."
      );
      setIsCameraReady(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  // Camera lifecycle
  useEffect(() => {
    if (isDialogOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setCapturedTimestamp(null);
      setCameraError(null);
      setIsCameraReady(false);
      setLocationError(null);
      setIsConfirming(false);
    }
    return () => stopCamera();
  }, [isDialogOpen]);

  // ---------- Capture photo with timestamp ----------
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const fullTimestamp = `${dateStr} ${timeStr}`;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 60, canvas.width - 20, 50);
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fullTimestamp, canvas.width / 2, canvas.height - 35);

    const imageData = canvas.toDataURL("image/png");
    setCapturedImage(imageData);
    setCapturedTimestamp(fullTimestamp);
  };

  // ---------- Location helper ----------
  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!isSecureContext) {
        reject(new Error("Location requires a secure connection (HTTPS)."));
        return;
      }
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          // GeolocationPositionError.code: 1 = permission denied,
          // 2 = position unavailable, 3 = timeout.
          if (error.code === 1) {
            reject(new Error("Location permission was denied. Please allow location access in your browser settings."));
          } else {
            reject(new Error(error.message || "Could not determine your location."));
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // ---------- Confirm handler – now with loading state ----------
  const handleConfirm = async () => {
    if (!capturedImage) {
      alert("Please capture a photo first.");
      return;
    }
    if (isConfirming) return;

    setIsConfirming(true);

    let location: { lat: number; lng: number } | null = null;
    try {
      location = await getLocation();
    } catch (err) {
      console.warn("Location capture failed:", err);
      const msg = err instanceof Error ? err.message : "Could not get location.";
      setLocationError(`${msg} Proceeding without it.`);
    }

    const now = new Date();
    const timestamp = capturedTimestamp || now.toLocaleString();

    if (actionType === "in") {
      setCheckInImage(capturedImage);
      setCheckInTime(timestamp);
      setCheckInLocation(location);
      setIsCheckedIn(true);
    } else if (actionType === "out") {
      setCheckOutImage(capturedImage);
      setCheckOutTime(timestamp);
      setCheckOutLocation(location);
      setIsCheckedIn(false);
      // Logout after checkout
      onLogout();
    }

    // Close dialog and reset states
    setIsDialogOpen(false);
    setActionType(null);
    setCapturedImage(null);
    setCapturedTimestamp(null);
    setIsConfirming(false);
  };

  const handleAction = (type: "in" | "out") => {
    if (type === "in" && isCheckedIn) {
      alert("You are already checked in.");
      return;
    }
    if (type === "out" && !isCheckedIn) {
      alert("You are not checked in.");
      return;
    }
    setActionType(type);
    setCapturedImage(null);
    setCapturedTimestamp(null);
    setCameraError(null);
    setIsDialogOpen(true);
  };

  const isActionIn = actionType === "in";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative flex items-center gap-2 h-9 rounded-full px-2 hover:bg-muted/50"
          >
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </div>
              {isCheckedIn && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
              )}
            </div>
            {/* ✅ NEW — visible username (+ role) in the top-right corner */}
            <span className="hidden sm:flex flex-col items-start leading-tight max-w-[140px]">
              <span className="text-sm font-medium truncate w-full text-left">{displayName}</span>
              {displayRole && (
                <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                  {displayRole}
                </span>
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              {user?.email && user.email.trim() && (
                <p className="text-[11px] leading-none text-muted-foreground truncate">{user.email}</p>
              )}
              {displayRole && (
                <p className="text-xs leading-none text-primary font-medium">{displayRole}</p>
              )}
              <p className="text-xs leading-none text-muted-foreground">
                {isCheckedIn ? "✅ Checked In" : "⏳ Checked Out"}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileModalOpen(true)} className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>View Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction("in")} disabled={isCheckedIn}>
            <Camera className="mr-2 h-4 w-4" />
            <span>Check In</span>
            {isCheckedIn && <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction("out")} disabled={!isCheckedIn}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Check Out</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            <div className="flex flex-col gap-1">
              {checkInTime && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>In: {checkInTime}</span>
                </div>
              )}
              {checkInLocation && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground">📍</span>
                  <span className="text-muted-foreground/80">
                    {checkInLocation.lat.toFixed(6)}, {checkInLocation.lng.toFixed(6)}
                  </span>
                </div>
              )}
              {checkOutTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>Out: {checkOutTime}</span>
                </div>
              )}
              {checkOutLocation && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground">📍</span>
                  <span className="text-muted-foreground/80">
                    {checkOutLocation.lat.toFixed(6)}, {checkOutLocation.lng.toFixed(6)}
                  </span>
                </div>
              )}
              {!checkInTime && !checkOutTime && (
                <span className="text-muted-foreground/60">No activity yet</span>
              )}
              {locationError && (
                <span className="text-destructive text-[10px]">{locationError}</span>
              )}
            </div>
          </DropdownMenuLabel>
          {(checkInImage || checkOutImage) && <DropdownMenuSeparator />}
          {checkInImage && (
            <DropdownMenuItem disabled className="flex items-center gap-2">
              <img src={checkInImage} alt="Check-in" className="h-8 w-8 rounded object-cover" />
              <span className="text-xs truncate">Check-in photo</span>
            </DropdownMenuItem>
          )}
          {checkOutImage && (
            <DropdownMenuItem disabled className="flex items-center gap-2">
              <img src={checkOutImage} alt="Check-out" className="h-8 w-8 rounded object-cover" />
              <span className="text-xs truncate">Check-out photo</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog – with retry button and confirming state */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isActionIn ? "Check In" : "Check Out"} – Take Photo
            </DialogTitle>
            <DialogDescription>
              Use your camera to take a photo. The current date &amp; time will be stamped on the image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative w-full overflow-hidden rounded-lg border bg-black shadow-md aspect-video max-h-[300px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isCameraReady && !cameraError ? "hidden" : ""}`}
              />
              {cameraError && (
                <div className="flex h-full flex-col items-center justify-center text-center text-white bg-black/50 p-4">
                  <p className="text-sm">{cameraError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-white border-white/50 hover:bg-white/20"
                    onClick={() => startCamera()}
                    disabled={isStartingCamera}
                  >
                    {isStartingCamera ? "Starting..." : "Retry Camera"}
                  </Button>
                </div>
              )}
              {!isCameraReady && !cameraError && (
                <div className="flex h-full items-center justify-center text-white bg-black/50">
                  <div className="text-center">
                    <Camera className="mx-auto h-8 w-8 mb-2 animate-pulse" />
                    <p className="text-sm">{isStartingCamera ? "Starting camera..." : "Camera not ready"}</p>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <img
                    src={capturedImage}
                    alt="Captured with timestamp"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="flex flex-wrap items-center gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={capturePhoto}
                disabled={!isCameraReady || !!capturedImage}
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture Photo
              </Button>
              {capturedImage && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCapturedImage(null);
                    setCapturedTimestamp(null);
                  }}
                >
                  Retake
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={handleConfirm}
                disabled={!capturedImage || isConfirming}
                className={isConfirming ? "opacity-50 cursor-not-allowed" : ""}
              >
                {isConfirming ? "Confirming..." : `Confirm ${isActionIn ? "Check In" : "Check Out"}`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsDialogOpen(false);
                  setActionType(null);
                  setCapturedImage(null);
                  setCapturedTimestamp(null);
                  setIsConfirming(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserProfileModal
        user={user}
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />
    </>
  );
}

// ---------- Main AppLayout (unchanged) ----------
export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 md:gap-4 border-b bg-card/80 backdrop-blur-sm px-3 md:px-6">
            <SidebarTrigger className="flex shrink-0" title="Toggle sidebar (Minimize / Maximize)" />
            <div className="flex-1 flex items-center min-w-0">
              <TopSearch />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <ThemeToggle />
              <NotificationBell />
              <ProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6 overflow-auto">{children}</main>
        </div>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}