import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { Bell, Search, Camera, Clock, CheckCircle, LogOut } from "lucide-react";
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

interface AppLayoutProps {
  children: React.ReactNode;
}

// ---------- Helper: get user initials ----------
function getUserInitials(user: AuthUser | null): string {
  if (!user) return "?";
  if (user.username === "Vibe@Admin") {
    return "VB";
  }
  const nameParts = user.name?.trim().split(/\s+/) || [];
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }
  const first = nameParts[0].charAt(0).toUpperCase();
  const last = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  return first + last;
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

  // Location states
  const [checkInLocation, setCheckInLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [checkOutLocation, setCheckOutLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initials = getUserInitials(user);
  const displayName = user?.name || user?.username || "User";

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
            className="relative h-9 w-9 rounded-full p-0 hover:bg-muted/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {initials}
            </div>
            {isCheckedIn && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {isCheckedIn ? "✅ Checked In" : "⏳ Checked Out"}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
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
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 md:px-6">
            <SidebarTrigger className="hidden md:flex" />
            <div className="flex-1 flex items-center gap-4">
              <div className="relative hidden md:flex max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search projects, tasks, hurdles..." className="pl-9 bg-muted/50 border-0 h-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  3
                </span>
              </Button>
              <ProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">{children}</main>
        </div>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}