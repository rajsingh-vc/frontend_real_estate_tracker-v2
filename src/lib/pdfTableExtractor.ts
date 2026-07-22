// src/lib/pdfTableExtractor.ts
//
// Shared PDF table-extraction + column auto-matching helpers.
//
// This used to live inline inside Documents.tsx (the Task import flow).
// Since the same "upload a PDF -> map its columns to fields -> bulk-create
// records" pattern is meant to power extraction across many modules, this
// file pulls the module-agnostic parts out so each consumer only has to
// define its own field list + synonym map (see Checklists.tsx for the
// second consumer). The parsing logic itself is unchanged.

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let pdfWorkerConfigured = false;
function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfWorkerConfigured = true;
  } catch (error) {
    console.error("Failed to set PDF worker:", error);
  }
}

export interface TableStructure {
  headers: string[];
  rows: string[][];
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

function clusterValues(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: { sum: number; count: number }[] = [];
  for (const v of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && v - last.sum / last.count <= tol) {
      last.sum += v;
      last.count += 1;
    } else {
      clusters.push({ sum: v, count: 1 });
    }
  }
  return clusters.map((c) => c.sum / c.count);
}

function nearest(value: number, buckets: number[]): number {
  let best = buckets[0];
  let bestDist = Math.abs(value - best);
  for (const b of buckets) {
    const d = Math.abs(value - b);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const isHeaderLikeToken = (s: string) => /[a-zA-Z]{2,}/.test(s);

/**
 * Parses a PDF's first "table-shaped" region into headers + rows by
 * clustering text items into column bands (x) and row bands (y).
 * Heuristic, not a real table parser — works well for simple single-table
 * PDFs (schedules, checklists, punch lists) exported from Excel/Word.
 */
export async function extractTableStructure(file: File): Promise<TableStructure> {
  ensurePdfWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const items: PdfTextItem[] = [];
  const PAGE_Y_GAP = 1_000_000;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const pageOffset = (i - 1) * PAGE_Y_GAP;
    for (const item of textContent.items as any[]) {
      const tx = item.transform;
      const x = Math.round(tx[4]);
      const y = Math.round(viewport.height - tx[5]) + pageOffset;
      const str = item.str.trim();
      if (str.length > 0) {
        items.push({ str, x, y });
      }
    }
  }

  if (items.length === 0) return { headers: [], rows: [] };

  const tolerance = 5;
  const HEADER_BAND_TOLERANCE = tolerance * 4;
  const page1Items = items.filter((it) => it.y < PAGE_Y_GAP);
  const headerBandYs = clusterValues(
    page1Items.map((it) => it.y),
    HEADER_BAND_TOLERANCE
  ).sort((a, b) => a - b);

  const itemsByBand = new Map<number, PdfTextItem[]>();
  for (const it of page1Items) {
    const b = nearest(it.y, headerBandYs);
    if (!itemsByBand.has(b)) itemsByBand.set(b, []);
    itemsByBand.get(b)!.push(it);
  }

  const candidateBands = headerBandYs.slice(0, 8);
  let headerBandY = candidateBands[0] ?? headerBandYs[0];
  let bestCount = -1;
  for (const b of candidateBands) {
    const bandItems = itemsByBand.get(b) || [];
    const wordyCount = bandItems.filter((it) => isHeaderLikeToken(it.str)).length;
    if (wordyCount < 2) continue;
    if (bandItems.length > bestCount) {
      bestCount = bandItems.length;
      headerBandY = b;
    }
  }
  if (bestCount === -1) headerBandY = candidateBands[0] ?? headerBandYs[0];

  const headerBandItems = (itemsByBand.get(headerBandY) || []).sort(
    (a, b) => a.x - b.x
  );
  const headerBandMaxY =
    headerBandItems.length > 0
      ? Math.max(...headerBandItems.map((it) => it.y)) + tolerance
      : -Infinity;

  let headerColXs = clusterValues(
    headerBandItems.map((it) => it.x),
    tolerance
  ).sort((a, b) => a - b);

  const headerCellMap: { [x: number]: string } = {};
  for (const it of headerBandItems) {
    const cx = nearest(it.x, headerColXs);
    headerCellMap[cx] = headerCellMap[cx] ? `${headerCellMap[cx]} ${it.str}` : it.str;
  }

  let tableMaxX = Infinity;
  if (headerColXs.length > 2) {
    const gaps = headerColXs.slice(1).map((x, i) => x - headerColXs[i]);
    const medianGap = median(gaps);
    let maxGap = -Infinity;
    let maxGapIdx = -1;
    gaps.forEach((g, i) => {
      if (g > maxGap) {
        maxGap = g;
        maxGapIdx = i;
      }
    });
    if (maxGapIdx >= 0 && maxGap > Math.max(3 * medianGap, 80)) {
      headerColXs = headerColXs.slice(0, maxGapIdx + 1);
      tableMaxX = headerColXs[headerColXs.length - 1] + maxGap / 2;
    }
  }

  const headers = headerColXs.map(
    (cx, i) => headerCellMap[cx]?.trim() || `Column ${i + 1}`
  );
  const headerSignature = headers.join("|").toLowerCase();

  const bodyItems = items.filter((it) => it.y > headerBandMaxY && it.x <= tableMaxX);
  if (bodyItems.length === 0) return { headers, rows: [] };

  const rowYs = clusterValues(
    bodyItems.map((it) => it.y),
    tolerance
  );

  const grid: { [y: number]: { [x: number]: string } } = {};
  for (const it of bodyItems) {
    const ry = nearest(it.y, rowYs);
    const cx = nearest(it.x, headerColXs);
    if (!grid[ry]) grid[ry] = {};
    grid[ry][cx] = grid[ry][cx] ? `${grid[ry][cx]} ${it.str}` : it.str;
  }

  const sortedRowYs = Object.keys(grid)
    .map(Number)
    .sort((a, b) => a - b);

  const rows: string[][] = [];
  for (const rowY of sortedRowYs) {
    const rowCells = grid[rowY] || {};
    const rowValues = headerColXs.map((cx) => (rowCells[cx] || "").trim());
    if (!rowValues.some((v) => v.length > 0)) continue;
    if (rowValues.join("|").toLowerCase() === headerSignature) continue;
    rows.push(rowValues);
  }

  return { headers, rows };
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Finds the best-matching PDF header for a target field key, given a map of
 * field key -> candidate synonym strings. Tries an exact normalized match
 * first, then falls back to a substring match. Each module passes its own
 * synonymsMap so the same matcher works for Task fields, Checklist fields,
 * or anything else.
 */
export function autoMatchColumn(
  headers: string[],
  fieldKey: string,
  synonymsMap: Record<string, string[]>
): string | undefined {
  const synonyms = synonymsMap[fieldKey] || [fieldKey];
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    norm: normalizeHeader(h),
  }));

  for (const syn of synonyms) {
    const normSyn = normalizeHeader(syn);
    const exact = normalizedHeaders.find((h) => h.norm === normSyn);
    if (exact) return exact.original;
  }

  for (const syn of synonyms) {
    const normSyn = normalizeHeader(syn);
    const partial = normalizedHeaders.find(
      (h) => h.norm.includes(normSyn) || normSyn.includes(h.norm)
    );
    if (partial) return partial.original;
  }

  return undefined;
}