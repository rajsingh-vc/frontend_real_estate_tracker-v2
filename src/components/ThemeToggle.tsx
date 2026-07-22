import { Moon, Sun, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme-mode") as ThemeMode | null;
      if (saved) return saved;
      // default to auto
      return "auto";
    }
    return "auto";
  });

  // Helper: determine if it should be dark based on time
  const isDarkByTime = () => {
    const now = new Date();
    const hours = now.getHours();
    // Dark from 6 PM (18) to 6 AM (5:59)
    return hours >= 18 || hours < 6;
  };

  // Apply theme based on current mode and time
  const applyTheme = (currentMode: ThemeMode) => {
    const shouldBeDark = currentMode === "dark" || (currentMode === "auto" && isDarkByTime());
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Apply on mount and when mode changes
  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  // For auto mode: check every minute and update if needed
  useEffect(() => {
    if (mode !== "auto") return;
    const interval = setInterval(() => {
      applyTheme("auto");
    }, 60000); // every minute
    return () => clearInterval(interval);
  }, [mode]);

  // Also re‑apply when the user returns to the tab (in case they changed system time)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mode === "auto") {
        applyTheme("auto");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [mode]);

  // Determine which icon to show on the button
  const getIcon = () => {
    if (mode === "light") return <Sun className="h-4 w-4" />;
    if (mode === "dark") return <Moon className="h-4 w-4" />;
    // auto: show a clock or semi‑sun/moon – we use Clock
    return <Clock className="h-4 w-4" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          {getIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
          {mode === "light" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
          {mode === "dark" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("auto")}>
          <Clock className="mr-2 h-4 w-4" />
          <span>Auto</span>
          {mode === "auto" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}