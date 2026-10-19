import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BreadcrumbCrumb {
  id?: string | number;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface HierarchicalBreadcrumbProps {
  items: BreadcrumbCrumb[];
  onBack?: () => void;
  backLabel?: string;
  className?: string;
  actions?: React.ReactNode;
}

export const HierarchicalBreadcrumb: React.FC<HierarchicalBreadcrumbProps> = ({
  items,
  onBack,
  backLabel,
  className,
  actions,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 sm:p-2.5 rounded-xl bg-card/75 border border-border/80 shadow-xs backdrop-blur-md",
        className
      )}
    >
      {/* Breadcrumb Trail */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 text-xs sm:text-sm"
      >
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 mr-1"
            title={backLabel || "Go back"}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{backLabel || "Back"}</span>
          </Button>
        )}

        {items.map((crumb, idx) => {
          const isLast = idx === items.length - 1;
          const isActive = crumb.active ?? isLast;

          return (
            <React.Fragment key={crumb.id ?? `${crumb.label}-${idx}`}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 select-none" />
              )}

              {isActive ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary font-semibold text-xs sm:text-sm shadow-2xs shrink-0 max-w-[200px] sm:max-w-xs truncate"
                  aria-current="page"
                  title={crumb.label}
                >
                  {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                  <span className="truncate">{crumb.label}</span>
                  {crumb.sublabel && (
                    <span className="text-[10px] opacity-75 font-normal ml-0.5 hidden sm:inline">
                      ({crumb.sublabel})
                    </span>
                  )}
                </div>
              ) : crumb.href ? (
                <Link
                  to={crumb.href}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0 max-w-[160px] sm:max-w-xs truncate font-medium"
                  title={crumb.label}
                >
                  {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0 max-w-[160px] sm:max-w-xs truncate font-medium cursor-pointer"
                  title={crumb.label}
                >
                  {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                  <span className="truncate">{crumb.label}</span>
                </button>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-muted-foreground shrink-0 max-w-[160px] sm:max-w-xs truncate font-medium"
                  title={crumb.label}
                >
                  {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                  <span className="truncate">{crumb.label}</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Action buttons (e.g. Add Tower, Export) */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
