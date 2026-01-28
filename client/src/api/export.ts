const BASE_URL = "/api";

export interface PageExportPdfOptions {
  includeTranscription?: boolean;
  pageSize?: "original" | "a4" | "letter";
}

export interface NotebookExportPdfOptions {
  includeTranscription?: boolean;
  pageSize?: "original" | "a4" | "letter";
}

export interface PageExportPngOptions {
  scale?: number;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

async function downloadBlob(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Export failed (${res.status}): ${body}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function exportPagePdf(
  pageId: string,
  options: PageExportPdfOptions = {},
): Promise<void> {
  const query = buildQuery({
    includeTranscription: options.includeTranscription ? "true" : undefined,
    pageSize: options.pageSize && options.pageSize !== "original" ? options.pageSize : undefined,
  });
  return downloadBlob(
    `${BASE_URL}/pages/${pageId}/export/pdf${query}`,
    `${pageId}.pdf`,
  );
}

export function exportNotebookPdf(
  notebookId: string,
  notebookTitle: string,
  options: NotebookExportPdfOptions = {},
): Promise<void> {
  const query = buildQuery({
    includeTranscription: options.includeTranscription ? "true" : undefined,
    pageSize: options.pageSize && options.pageSize !== "original" ? options.pageSize : undefined,
  });
  const safeTitle = notebookTitle.replace(/[^a-zA-Z0-9_-]/g, "_") || notebookId;
  return downloadBlob(
    `${BASE_URL}/notebooks/${notebookId}/export/pdf${query}`,
    `${safeTitle}.pdf`,
  );
}

export function exportPagePng(
  pageId: string,
  options: PageExportPngOptions = {},
): Promise<void> {
  const query = buildQuery({
    scale: options.scale && options.scale !== 1 ? String(options.scale) : undefined,
  });
  return downloadBlob(
    `${BASE_URL}/pages/${pageId}/export/png${query}`,
    `${pageId}.png`,
  );
}
