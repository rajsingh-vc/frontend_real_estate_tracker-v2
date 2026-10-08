import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Send, Trash2, ArrowLeft, ChevronRight, X, Minus,
  ExternalLink, Sparkles, RefreshCw,
} from "lucide-react";
import {
  projectsApi, tasksApi, hurdlesApi, towersApi, analyticsApi, ApiError,
  type ApiProject, type ApiTask, type ApiHurdle, type ApiTower,
} from "@/lib/api";
import {
  AnswerBody, resolveLocalAnswer, buildGroundingContext, navTopics,
  type ChatMessage, type LiveContext, type DrillStep,
} from "@/pages/AIAssistant";

interface AIAssistantWidgetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showFloatingTrigger?: boolean;
}

export function AIAssistantWidget({
  open: controlledOpen,
  onOpenChange,
  showFloatingTrigger = true,
}: AIAssistantWidgetProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setIsOpen = (value: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  // ── Live Data Queries ──
  const { data: rawProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const { data: rawTasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
  });
  const { data: rawHurdles = [], isLoading: hurdlesLoading, refetch: refetchHurdles } = useQuery({
    queryKey: ["hurdles"],
    queryFn: hurdlesApi.list,
  });
  const { data: rawTowers = [], isLoading: towersLoading, refetch: refetchTowers } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list,
  });

  // Filter strictly by active / existing projects
  const liveContext: LiveContext = useMemo(() => {
    const projects = rawProjects.filter(
      (p) => p && p.status?.toLowerCase() !== "deleted" && p.status?.toLowerCase() !== "archived"
    );
    const activeProjectIds = new Set(projects.map((p) => p.id));
    const tasks = rawTasks.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
    const towers = rawTowers.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
    const hurdles = rawHurdles.filter((h) => {
      if (h.affectedTaskId) return tasks.some((t) => t.id === h.affectedTaskId);
      return true;
    });

    return { projects, tasks, towers, hurdles };
  }, [rawProjects, rawTasks, rawTowers, rawHurdles]);

  const refreshAll = () => {
    refetchProjects();
    refetchTasks();
    refetchHurdles();
    refetchTowers();
  };

  const getStorageKey = () => (user ? `ai_chat_messages_${user.id}` : "ai_chat_messages_guest");
  const getDrillStorageKey = () => (user ? `ai_drill_stack_${user.id}` : "ai_drill_stack_guest");

  const buildInitialMessage = (): ChatMessage => {
    if (liveContext.projects.length > 0) {
      const sampleProj = liveContext.projects[0].name;
      return {
        role: "assistant",
        text: `Hi! I'm your **Project Intelligence AI Assistant**. Ask me anything about your active projects, tasks, or hurdles.\n\nTry: "Tell me about ${sampleProj}", "Show overdue tasks", or "Department performance chart".`,
        grounded: true,
      };
    }
    return {
      role: "assistant",
      text: "Hello! I'm your **Project Intelligence AI Assistant**. Once you add projects and tasks, I will provide live progress metrics, risk predictions, and interactive reports.",
      grounded: true,
    };
  };

  const loadMessages = (): ChatMessage[] => {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    return [buildInitialMessage()];
  };

  const loadDrillStack = (): DrillStep[] => {
    try {
      const stored = localStorage.getItem(getDrillStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [drillStack, setDrillStack] = useState<DrillStep[]>(loadDrillStack());
  const [drillOpen, setDrillOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(messages));
  }, [messages, user]);

  useEffect(() => {
    setMessages(loadMessages());
  }, [user]);

  useEffect(() => {
    localStorage.setItem(getDrillStorageKey(), JSON.stringify(drillStack));
  }, [drillStack, user]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, sending]);

  const clearChat = () => {
    setMessages([buildInitialMessage()]);
  };

  const openDrill = (query: string) => {
    const answer = resolveLocalAnswer(query, liveContext);
    if (!answer) return;
    const label = answer.chart?.title || answer.charts?.[0]?.title || (query.length > 32 ? query.slice(0, 32) + "…" : query);
    setDrillStack((prev) => [...prev, { query, label, answer }]);
    setDrillOpen(true);
  };

  const drillBack = () => {
    setDrillStack((prev) => {
      if (prev.length <= 1) {
        setDrillOpen(false);
        return prev;
      }
      return prev.slice(0, -1);
    });
  };

  const jumpToDrillLevel = (index: number) => {
    setDrillStack((prev) => prev.slice(0, index + 1));
  };

  const clearDrill = () => {
    setDrillStack([]);
    setDrillOpen(false);
  };

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || sending) return;

    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setInput("");

    const local = resolveLocalAnswer(msg, liveContext);
    if (local) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: local.text, chart: local.chart, charts: local.charts, grounded: true },
      ]);
      return;
    }

    setSending(true);
    try {
      const context = buildGroundingContext(liveContext);
      const { response } = await analyticsApi.aiAssistant(`${context}\n\nUser question: ${msg}`);
      setMessages((prev) => [...prev, { role: "assistant", text: response, grounded: false }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof ApiError ? `Sorry, I couldn't process that: ${err.message}` : "Sorry, I couldn't reach the server. Is the backend running?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = useMemo(() => {
    const list = [
      "Which project is most delayed?",
      "Show overdue tasks",
      "Predict next delay risk",
      "Department performance chart",
      "Task status distribution pie chart",
    ];
    if (liveContext.projects.length > 0) {
      list.push(`Tell me about ${liveContext.projects[0].name}`);
    }
    return list;
  }, [liveContext.projects]);

  const currentDrill = drillStack[drillStack.length - 1];
  const isLoading = projectsLoading || tasksLoading;

  // ── Drag & Drop position tracking for Circular Button ──
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("ai_assistant_icon_pos");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null; // default to bottom-right
  });

  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  // Handle start dragging circular button (mouse or touch)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return; // only left click

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = buttonRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : window.innerWidth - 70;
    const currentY = rect ? rect.top : window.innerHeight - 70;

    dragInfoRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
      hasMoved: false,
    };

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - dragInfoRef.current.startX;
      const deltaY = curY - dragInfoRef.current.startY;

      if (!dragInfoRef.current.hasMoved && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
        dragInfoRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfoRef.current.hasMoved) {
        const buttonWidth = buttonRef.current?.offsetWidth || 48;
        const buttonHeight = buttonRef.current?.offsetHeight || 48;
        const minX = 12;
        const maxX = window.innerWidth - buttonWidth - 12;
        const minY = 12;
        const maxY = window.innerHeight - buttonHeight - 12;

        const newX = Math.min(Math.max(minX, dragInfoRef.current.initialX + deltaX), maxX);
        const newY = Math.min(Math.max(minY, dragInfoRef.current.initialY + deltaY), maxY);

        setPosition({ x: newX, y: newY });
      }
    };

    const handleEnd = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);

      if (dragInfoRef.current.hasMoved) {
        setPosition((currentPos) => {
          if (currentPos) {
            try {
              localStorage.setItem("ai_assistant_icon_pos", JSON.stringify(currentPos));
            } catch (_) {}
          }
          return currentPos;
        });

        setTimeout(() => {
          setIsDragging(false);
          dragInfoRef.current.hasMoved = false;
        }, 50);
      } else {
        setIsDragging(false);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
  };

  const handleButtonClick = () => {
    if (dragInfoRef.current.hasMoved || isDragging) return;
    setIsOpen(true);
  };

  // ── Drag & Drop for Open AI Assistant Window ──
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("ai_assistant_win_pos");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const windowDragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const handleWindowDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    if ('button' in e && e.button !== 0) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = windowRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : window.innerWidth - 400;
    const currentY = rect ? rect.top : window.innerHeight - 510;

    windowDragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
    };

    setIsDraggingWindow(true);

    const handleWindowMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - windowDragRef.current.startX;
      const deltaY = curY - windowDragRef.current.startY;

      const winWidth = windowRef.current?.offsetWidth || 380;
      const winHeight = windowRef.current?.offsetHeight || 490;
      const minX = 8;
      const maxX = window.innerWidth - winWidth - 8;
      const minY = 8;
      const maxY = window.innerHeight - winHeight - 8;

      const newX = Math.min(Math.max(minX, windowDragRef.current.initialX + deltaX), maxX);
      const newY = Math.min(Math.max(minY, windowDragRef.current.initialY + deltaY), maxY);

      setWindowPosition({ x: newX, y: newY });
    };

    const handleWindowEnd = () => {
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("mouseup", handleWindowEnd);
      window.removeEventListener("touchmove", handleWindowMove);
      window.removeEventListener("touchend", handleWindowEnd);
      setIsDraggingWindow(false);

      setWindowPosition((currentPos) => {
        if (currentPos) {
          try {
            localStorage.setItem("ai_assistant_win_pos", JSON.stringify(currentPos));
          } catch (_) {}
        }
        return currentPos;
      });
    };

    window.addEventListener("mousemove", handleWindowMove);
    window.addEventListener("mouseup", handleWindowEnd);
    window.addEventListener("touchmove", handleWindowMove, { passive: true });
    window.addEventListener("touchend", handleWindowEnd);
  };

  return (
    <>
      {/* ── Circular Draggable Floating Toggle Button (Without any hover text) ── */}
      {showFloatingTrigger && !isOpen && (
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handleButtonClick}
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
              : undefined
          }
          className={`fixed ${!position ? 'bottom-6 right-6' : ''} z-50 group h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-600 via-primary to-purple-600 text-white shadow-xl shadow-indigo-600/40 hover:shadow-indigo-600/60 border-2 border-white/30 backdrop-blur-md flex items-center justify-center select-none touch-none ${
            isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-110 active:scale-95'
          } transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
        >
          {/* Subtle pulse ring */}
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping pointer-events-none opacity-40" />

          {/* Bot Icon */}
          <Bot className="h-6 w-6 text-white transition-transform group-hover:rotate-6 drop-shadow-md" />

          {/* Sparkle badge */}
          <Sparkles className="absolute top-0.5 right-0.5 h-3 w-3 text-amber-300 animate-pulse drop-shadow" />

          {/* Live indicator dot */}
          <span className="absolute bottom-0.5 right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-slate-900" />
          </span>
        </button>
      )}

      {/* ── Compact, Draggable Floating AI Assistant Window ── */}
      {isOpen && (
        <div
          ref={windowRef}
          style={
            windowPosition
              ? { left: `${windowPosition.x}px`, top: `${windowPosition.y}px`, right: 'auto', bottom: 'auto' }
              : undefined
          }
          className={`fixed ${
            !windowPosition
              ? position && position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500)
                ? 'bottom-4 sm:bottom-6 left-4 sm:left-6'
                : 'bottom-4 sm:bottom-6 right-4 sm:right-6'
              : ''
          } z-50 w-[92vw] sm:w-[370px] md:w-[385px] h-[490px] max-h-[75vh] rounded-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200`}
        >
          {/* Draggable Header */}
          <div
            onMouseDown={handleWindowDragStart}
            onTouchStart={handleWindowDragStart}
            className={`px-3 py-2 border-b bg-card/75 flex items-center justify-between gap-2 shrink-0 select-none ${
              isDraggingWindow ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="Drag header to move"
          >
            <div className="flex items-center gap-2 min-w-0 pointer-events-none">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-xs text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-semibold text-xs leading-tight truncate">AI Assistant</h3>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                    Live
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">Real-time project intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={refreshAll}
                title="Refresh project data"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={clearChat}
                title="Clear chat"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                asChild
                title="Open full page"
              >
                <Link to="/ai-assistant">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick-topic navigation chips */}
          <div className="px-2.5 py-1.5 border-b bg-muted/20 flex gap-1 overflow-x-auto scrollbar-none shrink-0">
            {navTopics.map((topic) => (
              <button
                key={topic.label}
                onClick={() => send(topic.query)}
                disabled={sending}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-background hover:bg-muted/60 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <topic.icon className="h-2.5 w-2.5 text-primary" />
                {topic.label}
              </button>
            ))}
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3 space-y-2.5 overflow-y-auto min-h-0 bg-background/50 text-xs">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-normal rounded-tr-xs"
                      : "bg-muted/70 text-foreground border border-border/50 rounded-tl-xs shadow-xs"
                  }`}
                >
                  <AnswerBody text={msg.text} chart={msg.chart} charts={msg.charts} onDrillQuery={openDrill} />
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary animate-pulse" />
                </div>
                <div className="max-w-[80%] rounded-xl px-2.5 py-1.5 text-[11px] bg-muted text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce"></span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
                  <span>Analyzing live projects…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input & Suggested Prompts */}
          <div className="border-t p-2.5 bg-card/80 shrink-0 space-y-1.5">
            {messages.length <= 2 && (
              <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-[10px] px-2 py-0.5 rounded-full border bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI about projects, delays, hurdles…"
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={sending}
                className="h-8 text-xs bg-background"
                autoFocus
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => send()} disabled={sending || !input.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drill-down modal ── */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2 shrink-0" onClick={drillBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="font-display text-base text-left">{currentDrill?.label ?? "Details"}</DialogTitle>
            </div>
          </DialogHeader>

          {drillStack.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground -mt-2">
              {drillStack.map((step, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  <button
                    onClick={() => jumpToDrillLevel(idx)}
                    className={`hover:underline ${idx === drillStack.length - 1 ? "text-foreground font-medium" : ""}`}
                  >
                    {step.label}
                  </button>
                </span>
              ))}
            </div>
          )}

          {currentDrill && (
            <div className="text-sm">
              <AnswerBody
                text={currentDrill.answer.text}
                chart={currentDrill.answer.chart}
                charts={currentDrill.answer.charts}
                onDrillQuery={openDrill}
              />
            </div>
          )}

          <div className="flex justify-end pt-2 border-t mt-2">
            <Button variant="ghost" size="sm" onClick={clearDrill} className="text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear drill history
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
