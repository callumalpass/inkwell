import { useState, useEffect, useCallback } from "react";
import {
  exportPagePdf,
  exportPagePng,
  exportNotebookPdf,
  type PageExportPdfOptions,
  type PageExportPngOptions,
  type NotebookExportPdfOptions,
} from "../../api/export";

type ExportFormat = "pdf" | "png";
type PageSize = "original" | "a4" | "letter";
type PngScale = 1 | 2 | 3 | 4;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, shows page export options (PDF + PNG). */
  pageId?: string;
  /** When set, shows notebook export options (PDF only). */
  notebookId?: string;
  /** Notebook title, used for the PDF filename. */
  notebookTitle?: string;
}

const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  original: "Original",
  a4: "A4",
  letter: "Letter",
};

const PNG_SCALE_LABELS: Record<PngScale, string> = {
  1: "1\u00d7",
  2: "2\u00d7",
  3: "3\u00d7",
  4: "4\u00d7",
};

const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";

export function ExportDialog({
  open,
  onClose,
  pageId,
  notebookId,
  notebookTitle,
}: ExportDialogProps) {
  const isPageExport = !!pageId;
  const isNotebookExport = !!notebookId && !pageId;

  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSize, setPageSize] = useState<PageSize>("original");
  const [includeTranscription, setIncludeTranscription] = useState(false);
  const [pngScale, setPngScale] = useState<PngScale>(2);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFormat("pdf");
      setPageSize("original");
      setIncludeTranscription(false);
      setPngScale(2);
      setExporting(false);
      setError(null);
    }
  }, [open]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    },
    [onClose, exporting],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      if (isPageExport && format === "pdf") {
        const opts: PageExportPdfOptions = { includeTranscription, pageSize };
        await exportPagePdf(pageId!, opts);
      } else if (isPageExport && format === "png") {
        const opts: PageExportPngOptions = { scale: pngScale };
        await exportPagePng(pageId!, opts);
      } else if (isNotebookExport) {
        const opts: NotebookExportPdfOptions = { includeTranscription, pageSize };
        await exportNotebookPdf(notebookId!, notebookTitle || notebookId!, opts);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const title = isPageExport ? "Export Page" : "Export Notebook";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="export-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg" data-testid="export-dialog">
        <h2 className="text-lg font-semibold">{title}</h2>

        <div className="mt-4 space-y-4">
          {/* Format selector (page export only) */}
          {isPageExport && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Format
              </label>
              <div className="flex gap-1">
                {(["pdf", "png"] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`${BTN} uppercase ${format === f ? BTN_ACTIVE : BTN_INACTIVE}`}
                    data-testid={`format-${f}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PDF options */}
          {format === "pdf" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Page Size
                </label>
                <div className="flex gap-1">
                  {(["original", "a4", "letter"] as PageSize[]).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setPageSize(ps)}
                      className={`${BTN} ${pageSize === ps ? BTN_ACTIVE : BTN_INACTIVE}`}
                      data-testid={`pagesize-${ps}`}
                    >
                      {PAGE_SIZE_LABELS[ps]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={includeTranscription}
                    onChange={(e) => setIncludeTranscription(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="include-transcription"
                  />
                  Include transcription
                </label>
              </div>
            </>
          )}

          {/* PNG options */}
          {isPageExport && format === "png" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Scale
              </label>
              <div className="flex gap-1">
                {([1, 2, 3, 4] as PngScale[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPngScale(s)}
                    className={`${BTN} ${pngScale === s ? BTN_ACTIVE : BTN_INACTIVE}`}
                    data-testid={`scale-${s}`}
                  >
                    {PNG_SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600" data-testid="export-error">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            data-testid="export-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            data-testid="export-submit"
          >
            {exporting ? "Exporting\u2026" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
