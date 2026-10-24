import jsPDF from "jspdf";
import {
  ApiTask,
  ApiProject,
  ApiTower,
  ApiFloor,
  ApiUnit,
  ApiSubTask,
  ApiDocument,
  Organization,
  OrganizationCompany,
  Entity,
  User,
  resolveImageUrl,
  organizationApi,
  companyApi,
  entityApi,
  tasksApi,
  documentsApi,
} from "@/lib/api";
import { getAccessToken } from "@/utils/token";

export interface TaskPdfExportOptions {
  project?: ApiProject | null;
  tower?: ApiTower | null;
  floor?: ApiFloor | null;
  unit?: ApiUnit | null;
  organization?: Organization | null;
  company?: OrganizationCompany | null;
  entity?: Entity | null;
  assigneeName?: string;
  dependencyTitle?: string;
  subtasks?: ApiSubTask[];
  attachments?: ApiDocument[];
  comments?: { id: number; user: string; date: string; text: string }[];
  currentUser?: User | null;
  onProgress?: (status: string) => void;
}

// Helper to determine if a document is an image / site photo
export function isImageDoc(doc: ApiDocument): boolean {
  const type = (doc.type || "").toUpperCase();
  if (["JPG", "JPEG", "PNG", "WEBP", "GIF", "SVG"].includes(type)) return true;
  const name = (doc.name || "").toLowerCase();
  const file = (doc.file || "").toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    file.endsWith(".jpg") ||
    file.endsWith(".jpeg") ||
    file.endsWith(".png") ||
    file.endsWith(".webp") ||
    file.endsWith(".gif")
  );
}

// Helper to resolve an absolute, clickable file URL for documents and photos in PDF
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const resolved = resolveImageUrl(url);
  if (!resolved) return null;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
  }
  return resolved;
}

// Convert image URL to Base64 data URL and measure natural dimensions
async function fetchImageAsBase64(
  url: string,
  token?: string | null
): Promise<{ dataUrl: string; width: number; height: number; format: "JPEG" | "PNG" } | null> {
  try {
    const headers: HeadersInit = {};
    if (token && !url.startsWith("data:") && !url.startsWith("blob:")) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          width: img.naturalWidth || img.width || 400,
          height: img.naturalHeight || img.height || 300,
        });
      img.onerror = () => resolve({ width: 400, height: 300 });
      img.src = dataUrl;
    });

    const isPng = blob.type.toLowerCase().includes("png") || url.toLowerCase().endsWith(".png");
    return {
      dataUrl,
      width: dims.width,
      height: dims.height,
      format: isPng ? "PNG" : "JPEG",
    };
  } catch (err) {
    console.warn("Could not load image for PDF:", url, err);
    return null;
  }
}

function formatLabel(str: string | null | undefined): string {
  if (!str) return "—";
  return str.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates an executive, organization-branded Task Management PDF Report
 * following modern real estate inspection and project tracking standards.
 */
export async function exportTaskToPDF(
  task: ApiTask,
  opts: TaskPdfExportOptions = {}
): Promise<void> {
  const { onProgress } = opts;
  if (onProgress) onProgress("Initializing report template…");

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const token = getAccessToken();

  // Page Dimensions & Bounds (A4: 595.28 x 841.89 pt)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2; // 523.28 pt
  const pageBottom = 795;
  let y = 30;

  // 1. Resolve Organization Dynamically
  let resolvedOrg = opts.organization || null;
  const targetOrgId = task.organizationId || opts.project?.organizationId || null;

  if (!resolvedOrg) {
    try {
      if (targetOrgId) {
        resolvedOrg = await organizationApi.retrieve(targetOrgId);
      } else {
        const orgs = await organizationApi.list();
        if (orgs.length === 1) {
          resolvedOrg = orgs[0];
        } else if (orgs.length > 1 && opts.currentUser?.company) {
          resolvedOrg = orgs.find((o) => o.id === opts.currentUser?.company) || orgs[0];
        }
      }
    } catch (e) {
      console.warn("Could not fetch organization for PDF:", e);
    }
  }

  // 2. Resolve Company & Entity
  let resolvedCompany = opts.company || null;
  const targetCompanyId = task.companyId || opts.project?.companyId || null;
  if (!resolvedCompany && resolvedOrg?.id && targetCompanyId) {
    try {
      const companies = await companyApi.list(resolvedOrg.id);
      resolvedCompany = companies.find((c) => c.id === targetCompanyId) || null;
    } catch (e) {
      console.warn("Could not fetch company for PDF:", e);
    }
  }

  let resolvedEntity = opts.entity || null;
  const targetEntityId = task.entityId || opts.project?.entityId || null;
  if (!resolvedEntity && resolvedOrg?.id && targetEntityId) {
    try {
      const entities = await entityApi.list(resolvedOrg.id);
      resolvedEntity = entities.find((e) => e.id === targetEntityId) || null;
    } catch (e) {
      console.warn("Could not fetch entity for PDF:", e);
    }
  }

  // Resolve Organization Branding Names
  const taskRecord = task as unknown as Record<string, unknown>;
  const orgName =
    resolvedOrg?.name ||
    (taskRecord.organizationName as string | undefined) ||
    opts.project?.organizationName ||
    opts.currentUser?.company_name ||
    "Konstruct Tracker";

  const companyName =
    resolvedCompany?.company_name ||
    (taskRecord.companyName as string | undefined) ||
    opts.project?.companyName ||
    (opts.currentUser?.company_name !== orgName ? opts.currentUser?.company_name : undefined);

  const entityName =
    resolvedEntity?.entity_name ||
    (taskRecord.entityName as string | undefined) ||
    opts.project?.entityName ||
    undefined;

  // Resolve Logo URL
  const rawLogo =
    resolvedOrg?.logo ||
    opts.project?.organizationLogo ||
    null;
  const logoUrl = resolveImageUrl(rawLogo);

  // Pre-load Logo if available
  let loadedLogo: { dataUrl: string; width: number; height: number; format: "JPEG" | "PNG" } | null = null;
  if (logoUrl) {
    if (onProgress) onProgress("Loading organization logo…");
    loadedLogo = await fetchImageAsBase64(logoUrl, token);
  }

  // Pre-load and reconcile Subtasks
  let subtasks = opts.subtasks || task.subtasks || [];
  if (subtasks.length === 0 && task.id) {
    try {
      const fetchedSubtasks = await tasksApi.subtasks.list(task.id);
      if (fetchedSubtasks && fetchedSubtasks.length > 0) {
        subtasks = fetchedSubtasks as unknown as ApiSubTask[];
      }
    } catch (e) {
      // non-fatal
    }
  }

  // Pre-load and reconcile Attachments
  let allAttachments = opts.attachments || [];
  if (allAttachments.length === 0 && task.id) {
    try {
      const fetchedDocs = await documentsApi.list({ task: task.id });
      if (fetchedDocs && fetchedDocs.length > 0) {
        allAttachments = fetchedDocs;
      }
    } catch (e) {
      // non-fatal
    }
  }

  // Pre-load and reconcile Comments
  let comments = opts.comments || task.comments || [];
  if (comments.length === 0 && task.id) {
    try {
      const fetchedComments = await tasksApi.getComments(task.id);
      if (fetchedComments && fetchedComments.length > 0) {
        comments = fetchedComments;
      }
    } catch (e) {
      // non-fatal
    }
  }

  // Pre-load Site Photos
  const photoDocs = allAttachments.filter(isImageDoc);
  const fileDocs = allAttachments.filter((doc) => !isImageDoc(doc));

  const loadedPhotos: Array<{
    doc: ApiDocument;
    dataUrl: string;
    width: number;
    height: number;
    format: "JPEG" | "PNG";
  }> = [];

  if (photoDocs.length > 0) {
    if (onProgress) onProgress(`Loading ${photoDocs.length} site evidence photo(s)…`);
    for (const p of photoDocs) {
      const fullUrl = resolveImageUrl(p.file);
      if (fullUrl) {
        const loaded = await fetchImageAsBase64(fullUrl, token);
        if (loaded) {
          loadedPhotos.push({
            doc: p,
            dataUrl: loaded.dataUrl,
            width: loaded.width,
            height: loaded.height,
            format: loaded.format,
          });
        }
      }
    }
  }

  if (onProgress) onProgress("Rendering document layout…");

  // Helper: Page management
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageBottom) {
      doc.addPage();
      y = 50;
      drawRunningHeader();
    }
  };

  const drawRunningHeader = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const leftText = [orgName, opts.project?.name, task.title].filter(Boolean).join("  ·  ");
    doc.text(leftText, marginX, 32);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(marginX, 38, marginX + contentWidth, 38);
  };

  // Helper: Draw Section Title Banner
  const drawSectionHeader = (title: string, countText?: string) => {
    checkPageBreak(28);
    y += 8;

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.75);
    doc.rect(marginX, y, contentWidth, 18, "FD");

    doc.setFillColor(37, 99, 235);
    doc.rect(marginX, y, 3.5, 18, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), marginX + 10, y + 12.5);

    if (countText) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(countText, marginX + contentWidth - 8, y + 12.5, { align: "right" });
    }

    y += 23;
  };

  // Helper: Status badge rendering inside tables
  const drawBadge = (
    text: string,
    bx: number,
    by: number,
    type: "success" | "warning" | "danger" | "info" | "neutral" = "neutral"
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const txtW = doc.getTextWidth(text);
    const badgeW = txtW + 10;
    const badgeH = 13;

    let fill: [number, number, number] = [248, 250, 252];
    let border: [number, number, number] = [203, 213, 225];
    let textCol: [number, number, number] = [15, 23, 42]; // Normal Black text for neutral / Not Started

    if (type === "success") {
      fill = [220, 252, 231];
      border = [187, 247, 208];
      textCol = [22, 101, 52];
    } else if (type === "warning") {
      fill = [254, 243, 199];
      border = [253, 230, 138];
      textCol = [146, 64, 14];
    } else if (type === "danger") {
      fill = [254, 226, 226];
      border = [254, 202, 202];
      textCol = [153, 27, 27];
    } else if (type === "info") {
      fill = [219, 234, 254];
      border = [191, 219, 254];
      textCol = [30, 64, 175];
    }

    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by - 9, badgeW, badgeH, 2.5, 2.5, "FD");

    doc.setTextColor(textCol[0], textCol[1], textCol[2]);
    doc.text(text, bx + 5, by);
    return badgeW;
  };

  const drawFormatBadge = (ext: string, bx: number, by: number) => {
    let fill: [number, number, number] = [241, 245, 249];
    let border: [number, number, number] = [203, 213, 225];
    let textCol: [number, number, number] = [51, 65, 85];

    const upper = (ext || "").toUpperCase();
    if (upper.includes("XLS") || upper.includes("CSV") || upper.includes("SHEET")) {
      fill = [236, 253, 245];
      border = [167, 243, 208];
      textCol = [4, 120, 87]; // Emerald green
    } else if (upper.includes("PDF")) {
      fill = [254, 242, 242];
      border = [254, 202, 202];
      textCol = [185, 28, 28]; // Crimson red
    } else if (upper.includes("DOC") || upper.includes("WORD") || upper.includes("TXT")) {
      fill = [239, 246, 255];
      border = [191, 219, 254];
      textCol = [29, 78, 216]; // Royal blue
    }

    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.5);
    const badgeW = 44;
    const badgeH = 13;
    doc.roundedRect(bx, by - 9, badgeW, badgeH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(textCol[0], textCol[1], textCol[2]);
    doc.text(upper.slice(0, 7), bx + badgeW / 2, by, { align: "center" });
  };

  const getStatusType = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
    const s = (status || "").toLowerCase().trim();
    // "Not Started", "Pending", or neutral values appear in normal black text
    if (
      s === "not started" ||
      s === "not_started" ||
      s.startsWith("not start") ||
      s === "pending" ||
      s === "unassigned" ||
      s === "none"
    ) {
      return "neutral";
    }
    if (s.includes("complete") || s.includes("done") || s.includes("pass") || s.includes("verify") || s === "yes") return "success";
    if (s.includes("progress") || s.includes("ready") || s.includes("active") || s.includes("ongoing")) return "info";
    if (s.includes("delay") || s.includes("block") || s.includes("reject") || s.includes("critical") || s === "no") return "danger";
    if (s.includes("review")) return "warning";
    return "neutral";
  };

  const safeLink = (x: number, y: number, w: number, h: number, url: string | null | undefined) => {
    try {
      if (url && Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0) {
        doc.link(x, y, w, h, { url });
      }
    } catch (err) {
      console.warn("Could not attach hyperlink in PDF:", url, err);
    }
  };

  // ==========================================================================
  // 1. TOP HEADER: DYNAMIC ORGANIZATION BRANDING + TITLE
  // ==========================================================================
  const headerStartY = y;
  let textLeftX = marginX;

  // Render Organization Logo if available
  if (loadedLogo) {
    try {
      const maxLogoW = 90;
      const maxLogoH = 44;
      const aspect = loadedLogo.width / loadedLogo.height;
      let logoW = maxLogoW;
      let logoH = maxLogoW / aspect;
      if (logoH > maxLogoH) {
        logoH = maxLogoH;
        logoW = maxLogoH * aspect;
      }

      doc.addImage(loadedLogo.dataUrl, loadedLogo.format, marginX, y, logoW, logoH);
      textLeftX = marginX + logoW + 14;
    } catch (logoErr) {
      console.warn("Could not render logo in PDF:", logoErr);
      textLeftX = marginX;
    }
  }

  // Organization & Corporate Hierarchy
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(orgName, textLeftX, y + 14);

  const subHeaderParts = [companyName, entityName].filter(Boolean);
  if (subHeaderParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(subHeaderParts.join("  ·  "), textLeftX, y + 27);
  }

  // Right-side document metadata block: Date only (TASK MANAGEMENT REPORT and Task ID removed per user request)
  const rightMetaX = marginX + contentWidth;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  doc.text(`Report Date: ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, rightMetaX, y + 14, { align: "right" });

  y = Math.max(headerStartY + 38, y + 34);

  // Gradient / Accent colored horizontal bar
  doc.setFillColor(37, 99, 235);
  doc.rect(marginX, y, contentWidth, 2, "F");
  y += 8;

  // ==========================================================================
  // 1.5 PROMINENT TASK TITLE & STATUS HERO CARD
  // ==========================================================================
  checkPageBreak(40);
  const taskTitleText = task.title || "Untitled Task";
  const titleLines = doc.splitTextToSize(taskTitleText, contentWidth - 140);
  const heroH = Math.max(34, titleLines.length * 13 + 16);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.75);
  doc.roundedRect(marginX, y, contentWidth, heroH, 3, 3, "FD");

  // Left accent bar
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(marginX, y, 4, heroH, 1.5, 1.5, "F");

  // Eyebrow label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TASK NAME & EXECUTION SCOPE", marginX + 12, y + 11);

  // Main prominent Task Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  titleLines.forEach((tl: string, idx: number) => {
    doc.text(tl, marginX + 12, y + 24 + idx * 12);
  });

  // Right-side badges inside hero card
  const heroBadgeRightX = marginX + contentWidth - 8;
  const heroStatus = formatLabel(task.status);
  const heroStatusType = getStatusType(task.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const statusBadgeW = doc.getTextWidth(heroStatus) + 12;
  drawBadge(heroStatus, heroBadgeRightX - statusBadgeW, y + 13, heroStatusType);

  if (task.priority) {
    const prioText = `${formatLabel(task.priority)} Priority`;
    const prioBadgeW = doc.getTextWidth(prioText) + 12;
    drawBadge(
      prioText,
      heroBadgeRightX - prioBadgeW,
      y + 28,
      task.priority.toLowerCase() === "high" ? "danger" : "neutral"
    );
  }

  y += heroH + 6;

  // ==========================================================================
  // 2. STRUCTURED PROJECT & TASK OVERVIEW (REFERENCE TABLE FORMAT)
  // ==========================================================================
  drawSectionHeader("Project & Task Information");

  const hierarchyList = [
    opts.tower ? opts.tower.name : (task.towerId ? `Tower #${task.towerId}` : undefined),
    opts.floor ? (opts.floor.name || `Floor ${opts.floor.number}`) : (task.floorId ? `Floor #${task.floorId}` : undefined),
    opts.unit ? `Unit ${opts.unit.unitNumber}` : (task.unitId ? `Unit #${task.unitId}` : undefined),
  ].filter(Boolean).join("  >  ") || "General Site";

  // 4-Column Grid Table matching Reference Inspection Sheet
  const colW = contentWidth / 4;
  const rowH = 27;

  const tableFields = [
    [
      { label: "TASK NAME", val: task.title || "—" },
      { label: "PROJECT", val: opts.project?.name || "—" },
      { label: "LOCATION / HIERARCHY", val: hierarchyList },
      { label: "DEPARTMENT", val: task.department || "General" },
    ],
    [
      { label: "STAGE / PHASE", val: task.phase || "Execution" },
      { label: "STATUS", val: formatLabel(task.status), badge: getStatusType(task.status) },
      { label: "PRIORITY", val: formatLabel(task.priority), badge: task.priority?.toLowerCase() === "high" ? "danger" : "neutral" },
      { label: "PROGRESS", val: `${task.progress ?? 0}%` },
    ],
    [
      { label: "ASSIGNED OWNER", val: opts.assigneeName || "Unassigned" },
      { label: "PREDECESSOR (DEPENDS ON)", val: opts.dependencyTitle || "No dependency" },
      { label: "START DATE", val: task.startDate || "—" },
      { label: "DUE DATE", val: task.endDate || "—" },
    ],
    [
      { label: "CRITICAL PATH", val: task.criticalPath ? "YES" : "NO", badge: task.criticalPath ? "danger" : "neutral" },
      {
        label: "BASELINE SCHEDULE",
        val: task.baselineStartDate && task.baselineEndDate
          ? `${task.baselineStartDate} to ${task.baselineEndDate}`
          : (task.baselineStartDate || task.baselineEndDate || "—"),
      },
      {
        label: "SCHEDULE VARIANCE",
        val: task.delayDays && task.delayDays > 0 ? `+${task.delayDays}d Delay` : "On Schedule",
        badge: (task.delayDays && task.delayDays > 0 ? "danger" : "success") as "danger" | "success",
      },
      {
        label: "DURATION",
        val: task.durationDays != null ? `${task.durationDays} Days` : "—",
      },
    ],
  ];

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.75);

  tableFields.forEach((row) => {
    checkPageBreak(rowH);

    row.forEach((cell, cIdx) => {
      const cellX = marginX + cIdx * colW;

      // Header label box
      doc.setFillColor(248, 250, 252);
      doc.rect(cellX, y, colW, 11.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(cell.label, cellX + 6, y + 8.5);

      // Value box
      doc.setFillColor(255, 255, 255);
      doc.rect(cellX, y + 11.5, colW, rowH - 11.5, "FD");

      if (cell.badge) {
        drawBadge(cell.val, cellX + 6, y + 22.5, cell.badge);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const truncated = doc.splitTextToSize(cell.val, colW - 12)[0] || "—";
        doc.text(truncated, cellX + 6, y + 22.5);
      }
    });

    y += rowH;
  });
  y += 10;

  // Task Scope & Description Box
  if (task.description) {
    checkPageBreak(40);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("TASK DESCRIPTION & SCOPE NOTES", marginX, y + 9);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const descLines = doc.splitTextToSize(task.description, contentWidth - 16);
    const descH = Math.max(descLines.length * 12 + 12, 28);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, descH, 3, 3, "FD");

    descLines.forEach((l: string, idx: number) => {
      doc.text(l, marginX + 8, y + 14 + idx * 12);
    });

    y += descH + 4;
  }

  // ==========================================================================
  // 3. QUALITY INSPECTION & CHECKLIST TABLE
  // ==========================================================================
  const checklist = task.checklist || [];
  if (checklist.length > 0) {
    const completedCount = checklist.filter((c) => c.completed).length;
    drawSectionHeader(
      "Quality Inspection & Checklist Sign-off",
      `${completedCount}/${checklist.length} Completed (${Math.round((completedCount / checklist.length) * 100)}%)`
    );

    const chCols = [
      { label: "#", w: 26 },
      { label: "CHECKLIST INSPECTION ITEM", w: 325 },
      { label: "STATUS", w: 86 },
      { label: "QA SIGN-OFF", w: 86.28 },
    ];

    // Table Header
    checkPageBreak(25);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 18, "FD");

    let hx = marginX;
    chCols.forEach((c) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(c.label, hx + 5, y + 12);
      hx += c.w;
    });
    y += 18;

    // Table Rows
    checklist.forEach((item, idx) => {
      const itemLines = doc.splitTextToSize(item.title, chCols[1].w - 10);
      const rowHeight = Math.max(itemLines.length * 12 + 10, 22);

      checkPageBreak(rowHeight);

      // Alternating row background
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      // Index
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(idx + 1), marginX + 7, y + 14);

      // Title
      doc.setTextColor(30, 41, 59);
      itemLines.forEach((l: string, lIdx: number) => {
        doc.text(l, marginX + chCols[0].w + 5, y + 13 + lIdx * 12);
      });

      // Status Badge
      const statusX = marginX + chCols[0].w + chCols[1].w + 5;
      if (item.completed) {
        drawBadge("COMPLETED", statusX, y + 14, "success");
      } else {
        drawBadge("PENDING", statusX, y + 14, "warning");
      }

      // Verification note
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        item.completed ? "Verified on Site" : "Pending Sign-off",
        marginX + chCols[0].w + chCols[1].w + chCols[2].w + 6,
        y + 14
      );

      y += rowHeight;
    });
    y += 10;
  }

  // ==========================================================================
  // 4. SUBTASKS BREAKDOWN TABLE
  // ==========================================================================
  if (subtasks.length > 0) {
    drawSectionHeader("Subtasks Execution Breakdown", `${subtasks.length} Subtasks`);

    const stCols = [
      { label: "#", w: 26 },
      { label: "SUBTASK TITLE", w: 265 },
      { label: "STATUS", w: 86 },
      { label: "PROGRESS", w: 60 },
      { label: "SCHEDULE BOUNDS", w: 86.28 },
    ];

    checkPageBreak(25);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 18, "FD");

    let hx = marginX;
    stCols.forEach((c) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(c.label, hx + 5, y + 12);
      hx += c.w;
    });
    y += 18;

    subtasks.forEach((st: ApiSubTask | (ApiSubTask & { name?: string }), idx: number) => {
      const stName = st.title || (st as { name?: string }).name || `Subtask #${st.id}`;
      const nameLines = doc.splitTextToSize(stName, stCols[1].w - 10);
      const rowHeight = Math.max(nameLines.length * 12 + 10, 22);

      checkPageBreak(rowHeight);

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(idx + 1), marginX + 7, y + 14);

      doc.setTextColor(30, 41, 59);
      nameLines.forEach((l: string, lIdx: number) => {
        doc.text(l, marginX + stCols[0].w + 5, y + 13 + lIdx * 12);
      });

      const stStatus = formatLabel(st.status || "Pending");
      drawBadge(stStatus, marginX + stCols[0].w + stCols[1].w + 5, y + 14, getStatusType(st.status));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`${st.progress || 0}%`, marginX + stCols[0].w + stCols[1].w + stCols[2].w + 6, y + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const dateStr = st.startDate && st.endDate ? `${st.startDate} → ${st.endDate}` : (st.startDate || st.endDate || "—");
      doc.text(dateStr, marginX + stCols[0].w + stCols[1].w + stCols[2].w + stCols[3].w + 6, y + 14);

      y += rowHeight;
    });
  }

  // ==========================================================================
  // 5. SITE EVIDENCE & TASK PHOTOS (COMPACT ONE-BY-ONE ROWS)
  // ==========================================================================
  if (loadedPhotos.length > 0) {
    drawSectionHeader("Site Evidence & Photo Inspections", `${loadedPhotos.length} Photo Records`);

    const photoRowH = 36;
    const thumbBoxW = 44;
    const thumbBoxH = 30;

    loadedPhotos.forEach((item, pIdx) => {
      checkPageBreak(photoRowH + 2);

      const rowY = y;

      // Alternating row background
      if (pIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, rowY, contentWidth, photoRowH, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, rowY + photoRowH, marginX + contentWidth, rowY + photoRowH);

      // Thumbnail container box
      const thumbX = marginX + 6;
      const thumbY = rowY + (photoRowH - thumbBoxH) / 2;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(thumbX, thumbY, thumbBoxW, thumbBoxH, 2, 2, "FD");

      // Scale photo proportionally into thumbnail box
      const aspect = item.width / item.height;
      let imgW = thumbBoxW - 4;
      let imgH = imgW / aspect;
      if (imgH > thumbBoxH - 4) {
        imgH = thumbBoxH - 4;
        imgW = imgH * aspect;
      }
      const imgX = thumbX + (thumbBoxW - imgW) / 2;
      const imgY = thumbY + (thumbBoxH - imgH) / 2;

      try {
        doc.addImage(item.dataUrl, item.format, imgX, imgY, imgW, imgH);
      } catch (imgErr) {
        console.warn("Could not render photo thumbnail:", item.doc.name, imgErr);
      }

      const photoUrl = resolveFileUrl(item.doc.file);
      if (photoUrl) {
        safeLink(thumbX, thumbY, thumbBoxW, thumbBoxH, photoUrl);
      }

      // Index number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(pIdx + 1), marginX + thumbBoxW + 12, rowY + 15);

      // Photo Title (Clickable link)
      const textX = marginX + thumbBoxW + 24;
      const maxTextW = contentWidth - thumbBoxW - 110;
      const caption = doc.splitTextToSize(item.doc.name || "Site Photo", maxTextW)[0] || "Site Photo";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(caption, textX, rowY + 14);

      if (photoUrl) {
        safeLink(textX, rowY + 5, doc.getTextWidth(caption), 12, photoUrl);
      }

      // Metadata (Date, File Size, Type)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const metaParts: string[] = [];
      if (item.doc.date) metaParts.push(item.doc.date);
      if (item.doc.size) metaParts.push(`Size: ${item.doc.size}`);
      if (item.doc.type) metaParts.push(`Format: ${item.doc.type.toUpperCase()}`);
      const metaStr = metaParts.join("  ·  ");
      doc.text(metaStr || "Inspection Record", textX, rowY + 26);

      // Action: "Open Photo" Button
      const btnW = 70;
      const btnH = 15;
      const btnX = marginX + contentWidth - btnW - 6;
      const btnY = rowY + (photoRowH - btnH) / 2;

      if (photoUrl) {
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(147, 197, 253);
        doc.setLineWidth(0.6);
        doc.roundedRect(btnX, btnY, btnW, btnH, 2.5, 2.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(29, 78, 216);
        doc.text("Open Photo", btnX + btnW / 2, btnY + 10.5, { align: "center" });

        safeLink(btnX, btnY, btnW, btnH, photoUrl);
      }

      y += photoRowH;
    });
    y += 8;
  }

  // ==========================================================================
  // 6. ATTACHED DOCUMENTS & SPECIFICATIONS
  // ==========================================================================
  if (fileDocs.length > 0) {
    drawSectionHeader("Attachments & Supporting Documentation", `${fileDocs.length} Documents Attached`);

    const docCols = [
      { label: "#", w: 22 },
      { label: "DOCUMENT TITLE", w: 222 },
      { label: "FORMAT", w: 50 },
      { label: "FILE SIZE", w: 56 },
      { label: "DATE UPLOADED", w: 85 },
      { label: "ACTION", w: 88.28 },
    ];

    checkPageBreak(25);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 18, "FD");

    let hx = marginX;
    docCols.forEach((c) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      if (c.label === "ACTION") {
        doc.text(c.label, hx + c.w / 2, y + 12, { align: "center" });
      } else {
        doc.text(c.label, hx + 5, y + 12);
      }
      hx += c.w;
    });
    y += 18;

    fileDocs.forEach((d, idx) => {
      const fileUrl = resolveFileUrl(d.file);
      const nameLines = doc.splitTextToSize(d.name || "Document", docCols[1].w - 10);
      const rowHeight = Math.max(nameLines.length * 12 + 10, 24);

      checkPageBreak(rowHeight);

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(idx + 1), marginX + 7, y + 15);

      // Document Title (Clickable link in Royal Blue)
      const titleX = marginX + docCols[0].w + 5;
      if (fileUrl) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(29, 78, 216); // Royal Blue
        nameLines.forEach((l: string, lIdx: number) => {
          doc.text(l, titleX, y + 15 + lIdx * 12);
        });
        // Make document title clickable
        safeLink(titleX, y + 2, docCols[1].w - 8, rowHeight - 4, fileUrl);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        nameLines.forEach((l: string, lIdx: number) => {
          doc.text(l, titleX, y + 15 + lIdx * 12);
        });
      }

      // Column starting offsets
      const formatColX = marginX + docCols[0].w + docCols[1].w;
      const sizeColX = formatColX + docCols[2].w;
      const dateColX = sizeColX + docCols[3].w;
      const actionColX = dateColX + docCols[4].w;
      const actionColW = docCols[5].w;

      // Format Badge (Excel, PDF, Word, etc.)
      const badgeW = 44;
      const formatX = formatColX + (docCols[2].w - badgeW) / 2;
      const fileExt = (d.type || d.name?.split(".").pop() || "FILE").toUpperCase().replace(".", "");
      drawFormatBadge(fileExt, formatX, y + 15);

      // File Size
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(d.size || "—", sizeColX + 5, y + 15);

      // Date Uploaded
      doc.text(d.date || "—", dateColX + 5, y + 15);

      // Action: Styled Modern Clickable Button
      if (fileUrl) {
        const btnW = 70;
        const btnH = 15;
        const btnX = actionColX + (actionColW - btnW) / 2;
        const btnY = y + (rowHeight - btnH) / 2;

        // Button background
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(147, 197, 253);
        doc.setLineWidth(0.6);
        doc.roundedRect(btnX, btnY, btnW, btnH, 2.5, 2.5, "FD");

        // Button text centered without corrupted unicode arrows
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(29, 78, 216);
        doc.text("Open File", btnX + btnW / 2, btnY + 10.5, { align: "center" });

        // Make button clickable
        safeLink(btnX, btnY, btnW, btnH, fileUrl);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Local File", actionColX + actionColW / 2, y + 15, { align: "center" });
      }

      y += rowHeight;
    });
  }

  // ==========================================================================
  // 7. COMMENTS & ACTIVITY AUDIT TRAIL
  // ==========================================================================
  if (comments.length > 0) {
    drawSectionHeader("Comments & Communication Log", `${comments.length} Log Entries`);

    const comCols = [
      { label: "DATE & TIME", w: 110 },
      { label: "USER / AUTHOR", w: 120 },
      { label: "COMMENT / ACTIVITY RECORD", w: 293.28 },
    ];

    checkPageBreak(25);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 18, "FD");

    let hx = marginX;
    comCols.forEach((c) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(c.label, hx + 5, y + 12);
      hx += c.w;
    });
    y += 18;

    comments.forEach((c, idx) => {
      const commentLines = doc.splitTextToSize(c.text || "", comCols[2].w - 10);
      const rowHeight = Math.max(commentLines.length * 12 + 10, 24);

      checkPageBreak(rowHeight);

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(c.date || "—", marginX + 5, y + 14);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(c.user || "User", marginX + comCols[0].w + 5, y + 14);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      commentLines.forEach((l: string, lIdx: number) => {
        doc.text(l, marginX + comCols[0].w + comCols[1].w + 5, y + 13 + lIdx * 12);
      });

      y += rowHeight;
    });
  }

  // ==========================================================================
  // 8. FINAL PASS: RUNNING FOOTER WITH PAGE NUMBERS ("PAGE X OF Y")
  // ==========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(marginX, 808, marginX + contentWidth, 808);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    const leftFooter = `${orgName}  |  Task Management Report — ${task.title}`;
    doc.text(leftFooter, marginX, 820);

    const rightFooter = `Page ${p} of ${totalPages}   ·   Generated on ${now.toLocaleDateString("en-GB")}`;
    doc.text(rightFooter, marginX + contentWidth, 820, { align: "right" });
  }

  // Sanitize Filename for Download
  const cleanOrg = (orgName || "Organization").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);
  const cleanProject = (opts.project?.name || "Project").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);
  const cleanTitle = (task.title || "Task").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const filename = `${cleanOrg}_${cleanProject}_Task-${task.id || 0}_${cleanTitle}.pdf`;

  if (onProgress) onProgress("Saving PDF file…");
  doc.save(filename);
}
