import { useDrawingStore, type Tool } from "../../stores/drawing-store";
import { useViewStore, type ViewMode } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useNavigate, useParams } from "react-router-dom";
import type { PenStyle } from "../../lib/pen-styles";
import { TranscriptionIndicator } from "./TranscriptionIndicator";

const WIDTHS = [2, 3, 5, 8];

const PEN_STYLE_LABELS: Record<PenStyle, string> = {
  pressure: "Pressure",
  uniform: "Uniform",
  ballpoint: "Ballpoint",
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  single: "Single",
  scroll: "Scroll",
  canvas: "Canvas",
};

export function Toolbar() {
  const { tool, width, penStyle, setTool, setWidth, setPenStyle, debugLastPointCount } =
    useDrawingStore();
  const { viewMode, setViewMode } = useViewStore();
  const { pages, currentPageIndex, goToNextPage, goToPrevPage, addNewPage } =
    useNotebookPagesStore();
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();

  const currentPage = pages[currentPageIndex] ?? null;

  const handlePageNav = (direction: "prev" | "next") => {
    if (direction === "prev") {
      goToPrevPage();
      const prevPage = pages[currentPageIndex - 1];
      if (prevPage && notebookId) {
        navigate(`/notebook/${notebookId}/page/${prevPage.id}`, { replace: true });
      }
    } else {
      goToNextPage();
      const nextPage = pages[currentPageIndex + 1];
      if (nextPage && notebookId) {
        navigate(`/notebook/${notebookId}/page/${nextPage.id}`, { replace: true });
      }
    }
  };

  const handleAddPage = async () => {
    try {
      const page = await addNewPage();
      if (notebookId) {
        navigate(`/notebook/${notebookId}/page/${page.id}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to create page:", err);
    }
  };

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
      {/* Tool selector */}
      <div className="flex gap-1">
        {(["pen", "eraser"] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`rounded px-3 py-1 text-sm capitalize ${
              tool === t
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-gray-300" />

      {/* Width selector */}
      <div className="flex gap-1">
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            className={`flex h-7 w-7 items-center justify-center rounded ${
              width === w ? "bg-gray-200" : "hover:bg-gray-100"
            }`}
          >
            <span
              className="rounded-full bg-gray-900"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}
      </div>

      {/* Pen style selector (visible when tool is pen) */}
      {tool === "pen" && (
        <>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex gap-1">
            {(["pressure", "uniform", "ballpoint"] as PenStyle[]).map((ps) => (
              <button
                key={ps}
                onClick={() => setPenStyle(ps)}
                className={`rounded px-2 py-1 text-xs ${
                  penStyle === ps
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {PEN_STYLE_LABELS[ps]}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Page navigation (visible in single-page mode) */}
      {viewMode === "single" && pages.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageNav("prev")}
            disabled={currentPageIndex === 0}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            {currentPageIndex + 1} / {pages.length}
          </span>
          <button
            onClick={() => handlePageNav("next")}
            disabled={currentPageIndex >= pages.length - 1}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* Transcription indicator (visible in single-page mode) */}
      {viewMode === "single" && currentPage && (
        <>
          <div className="h-4 w-px bg-gray-300" />
          <TranscriptionIndicator pageId={currentPage.id} />
        </>
      )}

      {/* New page button */}
      <button
        onClick={handleAddPage}
        className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
      >
        + Page
      </button>

      <div className="h-4 w-px bg-gray-300" />

      {/* View mode toggle */}
      <div className="flex gap-1">
        {(["single", "scroll", "canvas"] as ViewMode[]).map((vm) => (
          <button
            key={vm}
            onClick={() => setViewMode(vm)}
            className={`rounded px-2 py-1 text-xs ${
              viewMode === vm
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {VIEW_MODE_LABELS[vm]}
          </button>
        ))}
      </div>
      {debugLastPointCount > 0 && (
        <span className="text-xs text-gray-400">{debugLastPointCount}pts</span>
      )}
    </div>
  );
}
