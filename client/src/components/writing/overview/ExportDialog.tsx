import { useEffect, useState } from "react";
import { exportPagePdf, exportPagePng } from "../../../api/export";
import { showError, showSuccess } from "../../../stores/toast-store";
import { BTN, BTN_ACTIVE, BTN_INACTIVE } from "./styles";

type ExportFormat = "pdf" | "png";
type PageSize = "original" | "a4" | "letter";
type PngScale = 1 | 2 | 3 | 4;

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

export interface ExportDialogProps {
  open: boolean;
  pageIds: string[];
  onClose: () => void;
}

export function ExportDialog({ open, pageIds, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSize, setPageSize] = useState<PageSize>("original");
  const [includeTranscription, setIncludeTranscription] = useState(false);
  const [pngScale, setPngScale] = useState<PngScale>(2);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormat("pdf");
      setPageSize("original");
      setIncludeTranscription(false);
      setPngScale(2);
      setExporting(false);
      setExportProgress(0);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setError(null);
    try {
      for (let i = 0; i < pageIds.length; i++) {
        const pageId = pageIds[i];
        if (format === "pdf") {
          await exportPagePdf(pageId, { includeTranscription, pageSize });
        } else {
          await exportPagePng(pageId, { scale: pngScale });
        }
        setExportProgress(i + 1);
      }
      showSuccess(
        `Exported ${pageIds.length} page${pageIds.length > 1 ? "s" : ""}`,
      );
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      showError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Export {pageIds.length} pages</h2>
        <p className="mt-1 text-xs text-gray-500">
          This will download one file per page.
        </p>
        <div className="mt-4 space-y-4">
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
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

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
                    >
                      {PAGE_SIZE_LABELS[ps]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={includeTranscription}
                  onChange={(e) => setIncludeTranscription(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Include transcription
              </label>
            </>
          )}

          {format === "png" && (
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
                  >
                    {PNG_SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Exporting pages...</span>
                <span>{exportProgress} of {pageIds.length}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-black transition-all duration-200 ease-out"
                  style={{ width: `${(exportProgress / pageIds.length) * 100}%` }}
                  data-testid="export-progress-bar"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className={`${BTN} ${BTN_INACTIVE}`}
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className={`${BTN} ${BTN_ACTIVE}`}
              disabled={exporting}
              data-testid="export-submit"
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
