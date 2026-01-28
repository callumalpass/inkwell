import { useDrawingStore, type Tool } from "../../stores/drawing-store";
import { useViewStore, type ViewMode } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useNavigate, useParams } from "react-router-dom";
import type { PenStyle } from "../../lib/pen-styles";
import { TranscriptionIndicator } from "./TranscriptionIndicator";
import { OfflineIndicator } from "./OfflineIndicator";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { COLOR_PRESETS } from "../../lib/constants";
import type { GridType } from "./PageBackground";

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

const GRID_TYPE_LABELS: Record<GridType, string> = {
  none: "Plain",
  lined: "Lined",
  grid: "Grid",
  dotgrid: "Dots",
};

/** Base styles for toolbar buttons — sized for e-ink touch targets. */
const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";
const BTN_DISABLED = "opacity-25";

export function Toolbar() {
  const { tool, color, width, penStyle, setTool, setColor, setWidth, setPenStyle, debugLastPointCount } =
    useDrawingStore();
  const { viewMode, setViewMode } = useViewStore();
  const { pages, currentPageIndex, goToNextPage, goToPrevPage, addNewPage, settings, updateSettings } =
    useNotebookPagesStore();
  const gridType = (settings.gridType ?? "none") as GridType;
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();

  const currentPage = pages[currentPageIndex] ?? null;
  const currentPageId = currentPage?.id ?? "";
  const { undo, redo, canUndo, canRedo } = useUndoRedo(currentPageId);

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
    <div className="border-b-2 border-gray-400 bg-white px-4 py-1.5">
      {/* Row 1: Drawing tools */}
      <div className="flex items-center gap-2">
        {/* Tool selector */}
        <div className="flex gap-1">
          {(["pen", "eraser"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`${BTN} capitalize ${tool === t ? BTN_ACTIVE : BTN_INACTIVE}`}
            >
              {t}
            </button>
          ))}
        </div>

        <Divider />

        {/* Width selector */}
        <div className="flex gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                width === w
                  ? "border-black bg-gray-100"
                  : "border-gray-300 bg-white"
              }`}
            >
              <span
                className="rounded-full"
                style={{ width: w + 4, height: w + 4, backgroundColor: color }}
              />
            </button>
          ))}
        </div>

        {/* Color selector (visible when tool is pen) */}
        {tool === "pen" && (
          <>
            <Divider />
            <div className="flex gap-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => setColor(preset.color)}
                  aria-label={preset.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border-2 ${
                    color === preset.color
                      ? "border-black"
                      : "border-gray-300"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: preset.color,
                    }}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Pen style selector (visible when tool is pen) */}
        {tool === "pen" && (
          <>
            <Divider />
            <div className="flex gap-1">
              {(["pressure", "uniform", "ballpoint"] as PenStyle[]).map((ps) => (
                <button
                  key={ps}
                  onClick={() => setPenStyle(ps)}
                  className={`${BTN} ${penStyle === ps ? BTN_ACTIVE : BTN_INACTIVE}`}
                >
                  {PEN_STYLE_LABELS[ps]}
                </button>
              ))}
            </div>
          </>
        )}

        <Divider />

        {/* Undo / Redo */}
        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className={`${BTN} ${BTN_INACTIVE} ${!canUndo ? BTN_DISABLED : ""}`}
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            className={`${BTN} ${BTN_INACTIVE} ${!canRedo ? BTN_DISABLED : ""}`}
          >
            Redo
          </button>
        </div>
      </div>

      {/* Row 2: Page & view controls */}
      <div className="mt-1.5 flex items-center gap-2 border-t border-gray-200 pt-1.5">
        {/* Page navigation (visible in single-page mode) */}
        {viewMode === "single" && pages.length > 0 && (
          <>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageNav("prev")}
                disabled={currentPageIndex === 0}
                className={`${BTN} ${BTN_INACTIVE} ${currentPageIndex === 0 ? BTN_DISABLED : ""}`}
              >
                Prev
              </button>
              <span className="px-1 text-sm font-medium text-gray-800">
                {currentPageIndex + 1}/{pages.length}
              </span>
              <button
                onClick={() => handlePageNav("next")}
                disabled={currentPageIndex >= pages.length - 1}
                className={`${BTN} ${BTN_INACTIVE} ${currentPageIndex >= pages.length - 1 ? BTN_DISABLED : ""}`}
              >
                Next
              </button>
            </div>
            <Divider />
          </>
        )}

        {/* New page button */}
        <button
          onClick={handleAddPage}
          className={`${BTN} ${BTN_INACTIVE} font-semibold`}
        >
          + Page
        </button>

        <Divider />

        {/* Grid type selector */}
        <div className="flex gap-1">
          {(["none", "lined", "grid", "dotgrid"] as GridType[]).map((gt) => (
            <button
              key={gt}
              onClick={() => updateSettings({ gridType: gt })}
              className={`${BTN} ${gridType === gt ? BTN_ACTIVE : BTN_INACTIVE}`}
            >
              {GRID_TYPE_LABELS[gt]}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Transcription indicator (visible in single-page mode) */}
        {viewMode === "single" && currentPage && (
          <TranscriptionIndicator pageId={currentPage.id} />
        )}

        {/* View mode toggle */}
        <div className="flex gap-1">
          {(["single", "scroll", "canvas"] as ViewMode[]).map((vm) => (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
              className={`${BTN} ${viewMode === vm ? BTN_ACTIVE : BTN_INACTIVE}`}
            >
              {VIEW_MODE_LABELS[vm]}
            </button>
          ))}
        </div>

        <OfflineIndicator />
        {debugLastPointCount > 0 && (
          <span className="text-xs text-gray-600">{debugLastPointCount}pts</span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-6 w-px bg-gray-400" />;
}
