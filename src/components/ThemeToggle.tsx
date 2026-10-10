import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme-mode");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved as ThemeMode;
      }
      if (saved === "auto") {
        return "system";
      }
    }
    return "system";
  });

  // System mode logic:
  // 5 AM (05:00) to 6 PM (18:00) is light mode
  // 6 PM (18:00) to 5 AM (04:59) is dark mode
  const isDarkByTime = () => {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 18 || hours < 5;
  };

  // Apply theme based on current mode
  const applyTheme = (currentMode: ThemeMode) => {
    let isDark = false;
    if (currentMode === "dark") {
      isDark = true;
    } else if (currentMode === "light") {
      isDark = false;
    } else {
      // System mode: 5 AM - 6 PM Light, 6 PM - 5 AM Dark
      isDark = isDarkByTime();
    }

    if (isDark) {
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

    // If system mode, check every minute and when switching back to tab
    if (mode === "system") {
      const interval = setInterval(() => {
        applyTheme("system");
      }, 60000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          applyTheme("system");
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [mode]);

  // Click cycle: Light -> Dark -> System -> Light
  const handleToggle = () => {
    setMode((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const getIcon = () => {
    if (mode === "light") return <Sun className="h-4 w-4" />;
    if (mode === "dark") return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getTitle = () => {
    if (mode === "light") return "Light Mode";
    if (mode === "dark") return "Dark Mode";
    return "System Mode";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-foreground hover:bg-muted/80 transition-colors"
      onClick={handleToggle}
      title={getTitle()}
      aria-label={getTitle()}
    >
      {getIcon()}
    </Button>
  );
}

