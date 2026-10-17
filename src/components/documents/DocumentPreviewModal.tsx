import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Eye,
  File,
  HardDrive,
  User as UserIcon,
} from "lucide-react";
import type { ApiDocument } from "@/lib/api";

interface DocumentPreviewModalProps {
  document: ApiDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScheduleWizard?: (doc: ApiDocument) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document: doc,
  open,
  onOpenChange,
  onOpenScheduleWizard,
}) => {
  if (!doc) return null;

  const ext = (doc.type || doc.file.rsplit?.(".")?.pop() || "").toUpperCase();
  const isImage = ["PNG", "JPG", "JPEG", "WEBP"].includes(ext);
  const isPdf = ext === "PDF";
  const isSchedule = ["MPP", "XML", "MSPDI", "XER"].includes(ext) || doc.isSchedule;
  const isSpreadsheet = ["XLS", "XLSX", "XLSM", "CSV"].includes(ext);
  const isWord = ["DOC", "DOCX"].includes(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-card/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {isPdf && <FileText className="h-5 w-5" />}
              {isImage && <ImageIcon className="h-5 w-5" />}
              {isSchedule && <FileCode className="h-5 w-5" />}
              {isSpreadsheet && <FileSpreadsheet className="h-5 w-5" />}
              {!isPdf && !isImage && !isSchedule && !isSpreadsheet && <File className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold truncate max-w-md">
                {doc.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doc.projectName} • {doc.date} • {doc.size}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {ext}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              v{doc.version || 1}
            </Badge>
          </div>
        </div>

        {/* Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-muted/20 min-h-[350px]">
          {isImage && (
            <div className="max-h-[500px] w-full flex items-center justify-center overflow-hidden rounded-xl border border-border bg-background/50 p-2">
              <img
                src={doc.file}
                alt={doc.name}
                className="max-h-[460px] max-w-full object-contain rounded-lg"
              />
            </div>
          )}

          {isPdf && (
            <div className="w-full h-[520px] rounded-xl overflow-hidden border border-border shadow-inner bg-background">
              <iframe
                src={`${doc.file}#toolbar=0`}
                title={doc.name}
                className="w-full h-full border-0"
              />
            </div>
          )}

          {isSchedule && (
            <div className="text-center p-8 max-w-md space-y-4 bg-card border border-border/80 rounded-2xl shadow-sm">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FileCode className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Microsoft Project Schedule</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This document contains project scheduling data (tasks, WBS, milestones, and dependencies).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left bg-muted/40 p-3 rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground">Original Name:</span>
                  <p className="font-medium truncate">{doc.originalFilename || doc.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium text-primary capitalize">{doc.processingStatus || "Ready"}</p>
                </div>
              </div>

              {onOpenScheduleWizard && (
                <Button
                  className="w-full bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenScheduleWizard(doc);
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open MPP Schedule Import Wizard
                </Button>
              )}
            </div>
          )}

          {!isImage && !isPdf && !isSchedule && (
            <div className="text-center p-8 max-w-md space-y-3 bg-card border border-border rounded-2xl">
              <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <File className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-foreground">{doc.name}</h3>
              <p className="text-xs text-muted-foreground">
                Preview is not natively available for .{ext.toLowerCase()} files in browser. You can download and open this file locally.
              </p>
              <Button asChild size="sm" variant="outline">
                <a href={doc.file} download target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1.5" />
                  Download File ({doc.size})
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>Category: <strong className="text-foreground">{doc.category}</strong></span>
            {doc.description && <span>• {doc.description}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={doc.file} target="_blank" rel="noreferrer" download>
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </a>
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
