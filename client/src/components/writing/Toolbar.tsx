import { useState, useRef, useEffect } from "react";
import { useDrawingStore, type Tool } from "../../stores/drawing-store";
import { useViewStore, type ViewMode } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useNavigate, useParams } from "react-router-dom";
import type { PenStyle } from "../../lib/pen-styles";
import { TranscriptionIndicator } from "./TranscriptionIndicator";
import { OfflineIndicator } from "./OfflineIndicator";
import { ExportDialog } from "../export/ExportDialog";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { NotebookSettingsDialog } from "../settings/NotebookSettingsDialog";
import {
  COLOR_PRESETS,
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  VIEW_MIN_ZOOM,
  VIEW_MAX_ZOOM,
} from "../../lib/constants";
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

/** Width (px) below which the toolbar switches to compact mode. */
const COMPACT_BREAKPOINT = 768;

export function Toolbar() {
  const { tool, color, width, penStyle, setTool, setColor, setWidth, setPenStyle, debugLastPointCount } =
    useDrawingStore();
  const { viewMode, setViewMode } = useViewStore();
  const activeTransform = useViewStore((s) =>
    s.viewMode === "canvas"
      ? s.canvasTransform
      : s.viewMode === "scroll"
        ? s.scrollViewTransform
        : s.singlePageTransform,
  );
  const setActiveTransform = useViewStore((s) =>
    s.viewMode === "canvas"
      ? s.setCanvasTransform
      : s.viewMode === "scroll"
        ? s.setScrollViewTransform
        : s.setSinglePageTransform,
  );
  const minZoom = viewMode === "canvas" ? CANVAS_MIN_ZOOM : VIEW_MIN_ZOOM;
  const maxZoom = viewMode === "canvas" ? CANVAS_MAX_ZOOM : VIEW_MAX_ZOOM;
  const { pages, currentPageIndex, goToNextPage, goToPrevPage, addNewPage, settings, updateSettings } =
    useNotebookPagesStore();
  const gridType = (settings.gridType ?? "none") as GridType;
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();

  const currentPage = pages[currentPageIndex] ?? null;
  const currentPageId = currentPage?.id ?? "";
  const { undo, redo, canUndo, canRedo } = useUndoRedo(currentPageId);

  const linksPanelOpen = useLinksPanelStore((s) => s.panelOpen);
  const openLinksPanel = useLinksPanelStore((s) => s.openPanel);
  const closeLinksPanel = useLinksPanelStore((s) => s.closePanel);

  const [expanded, setExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notebookSettingsOpen, setNotebookSettingsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const compact = entry.contentRect.width < COMPACT_BREAKPOINT;
      setIsCompact(compact);
      if (!compact) setExpanded(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const ZOOM_FACTOR = 1.2;

  const handleZoomIn = () => {
    const newScale = Math.min(maxZoom, activeTransform.scale * ZOOM_FACTOR);
    setActiveTransform({ ...activeTransform, scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(minZoom, activeTransform.scale / ZOOM_FACTOR);
    setActiveTransform({ ...activeTransform, scale: newScale });
  };

  const handleZoomReset = () => {
    setActiveTransform({ x: 0, y: 0, scale: 1 });
  };

  const zoomPercent = Math.round(activeTransform.scale * 100);
  const canZoomIn = activeTransform.scale < maxZoom;
  const canZoomOut = activeTransform.scale > minZoom;

  const toggleExpanded = () => setExpanded((e) => !e);

  return (
    <div
      ref={toolbarRef}
      className={`border-b-2 border-gray-400 bg-white ${isCompact ? "px-3" : "px-4"} py-1.5`}
    >
      {isCompact ? (
        /* ── Compact layout ──────────────────────────────────────────── */
        <>
          {/* Primary row: essential tools always visible */}
          <div className="flex items-center gap-1.5">
            {/* Home */}
            <button
              onClick={() => navigate("/")}
              aria-label="Home"
              className={`${BTN} ${BTN_INACTIVE}`}
            >
              Home
            </button>

            <Divider />

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

            {/* Current width+color swatch — tap to expand settings */}
            <button
              onClick={toggleExpanded}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white"
              aria-label="Pen settings"
            >
              <span
                className="rounded-full"
                style={{ width: width + 4, height: width + 4, backgroundColor: color }}
              />
            </button>

            <div className="flex-1" />

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

            <Divider />

            {/* Expand / collapse toggle */}
            <button
              onClick={toggleExpanded}
              className={`${BTN} ${expanded ? BTN_ACTIVE : BTN_INACTIVE}`}
              aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
              aria-expanded={expanded}
            >
              {expanded ? "▲" : "⋯"}
            </button>

            <OfflineIndicator />
          </div>

          {/* Expanded panel */}
          {expanded && (
            <div className="mt-1.5 space-y-1.5 border-t border-gray-200 pt-1.5">
              {/* Width selector */}
              <ToolbarRow label="Width">
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
              </ToolbarRow>

              {/* Color selector */}
              {tool === "pen" && (
                <ToolbarRow label="Color">
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
                </ToolbarRow>
              )}

              {/* Pen style selector */}
              {tool === "pen" && (
                <ToolbarRow label="Style">
                  {(["pressure", "uniform", "ballpoint"] as PenStyle[]).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setPenStyle(ps)}
                      className={`${BTN} ${penStyle === ps ? BTN_ACTIVE : BTN_INACTIVE}`}
                    >
                      {PEN_STYLE_LABELS[ps]}
                    </button>
                  ))}
                </ToolbarRow>
              )}

              {/* Grid type selector */}
              <ToolbarRow label="Grid">
                {(["none", "lined", "grid", "dotgrid"] as GridType[]).map((gt) => (
                  <button
                    key={gt}
                    onClick={() => updateSettings({ gridType: gt })}
                    className={`${BTN} ${gridType === gt ? BTN_ACTIVE : BTN_INACTIVE}`}
                  >
                    {GRID_TYPE_LABELS[gt]}
                  </button>
                ))}
              </ToolbarRow>

              {/* View mode */}
              <ToolbarRow label="View">
                {(["single", "scroll", "canvas"] as ViewMode[]).map((vm) => (
                  <button
                    key={vm}
                    onClick={() => setViewMode(vm)}
                    className={`${BTN} ${viewMode === vm ? BTN_ACTIVE : BTN_INACTIVE}`}
                  >
                    {VIEW_MODE_LABELS[vm]}
                  </button>
                ))}
              </ToolbarRow>

              {/* Notebook Settings */}
              <ToolbarRow label="Setup">
                <button
                  onClick={() => setNotebookSettingsOpen(true)}
                  className={`${BTN} ${BTN_INACTIVE}`}
                  data-testid="toolbar-notebook-settings-compact"
                >
                  Notebook Settings
                </button>
              </ToolbarRow>

              {/* Page navigation, add page, zoom */}
              <div className="flex flex-wrap items-center gap-1.5">
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

                <button
                  onClick={handleAddPage}
                  className={`${BTN} ${BTN_INACTIVE} font-semibold`}
                >
                  + Page
                </button>

                <Divider />

                {/* Export button */}
                {currentPage && (
                  <>
                    <button
                      onClick={() => setExportOpen(true)}
                      className={`${BTN} ${BTN_INACTIVE}`}
                      aria-label="Export page"
                      data-testid="toolbar-export-compact"
                    >
                      Export
                    </button>
                    <Divider />
                  </>
                )}

                {/* Links button */}
                {currentPage && (
                  <>
                    <button
                      onClick={() =>
                        linksPanelOpen ? closeLinksPanel() : openLinksPanel(currentPage.id)
                      }
                      className={`${BTN} ${linksPanelOpen ? BTN_ACTIVE : BTN_INACTIVE}`}
                      aria-label="Page links"
                      data-testid="toolbar-links-compact"
                    >
                      Links
                    </button>
                    <Divider />
                  </>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleZoomOut}
                    disabled={!canZoomOut}
                    aria-label="Zoom out"
                    className={`${BTN} ${BTN_INACTIVE} ${!canZoomOut ? BTN_DISABLED : ""}`}
                  >
                    −
                  </button>
                  <button
                    onClick={handleZoomReset}
                    aria-label="Reset zoom"
                    className="min-w-[3.5rem] px-1 py-2 text-center text-sm font-medium text-gray-800"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={!canZoomIn}
                    aria-label="Zoom in"
                    className={`${BTN} ${BTN_INACTIVE} ${!canZoomIn ? BTN_DISABLED : ""}`}
                  >
                    +
                  </button>
                </div>

                <div className="flex-1" />

                {viewMode === "single" && currentPage && (
                  <TranscriptionIndicator pageId={currentPage.id} />
                )}
                {debugLastPointCount > 0 && (
                  <span className="text-xs text-gray-600">{debugLastPointCount}pts</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Full-size layout ────────────────────────────────────────── */
        <>
          {/* Row 1: Drawing tools */}
          <div className="flex items-center gap-2">
            {/* Home */}
            <button
              onClick={() => navigate("/")}
              aria-label="Home"
              className={`${BTN} ${BTN_INACTIVE}`}
            >
              Home
            </button>

            <Divider />

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

            {/* Export button */}
            {currentPage && (
              <>
                <button
                  onClick={() => setExportOpen(true)}
                  className={`${BTN} ${BTN_INACTIVE}`}
                  aria-label="Export page"
                  data-testid="toolbar-export"
                >
                  Export
                </button>
                <Divider />
              </>
            )}

            {/* Links button */}
            {currentPage && (
              <>
                <button
                  onClick={() =>
                    linksPanelOpen ? closeLinksPanel() : openLinksPanel(currentPage.id)
                  }
                  className={`${BTN} ${linksPanelOpen ? BTN_ACTIVE : BTN_INACTIVE}`}
                  aria-label="Page links"
                  data-testid="toolbar-links"
                >
                  Links
                </button>
                <Divider />
              </>
            )}

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

            <Divider />

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                disabled={!canZoomOut}
                aria-label="Zoom out"
                className={`${BTN} ${BTN_INACTIVE} ${!canZoomOut ? BTN_DISABLED : ""}`}
              >
                −
              </button>
              <button
                onClick={handleZoomReset}
                aria-label="Reset zoom"
                className="min-w-[3.5rem] px-1 py-2 text-center text-sm font-medium text-gray-800"
              >
                {zoomPercent}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={!canZoomIn}
                aria-label="Zoom in"
                className={`${BTN} ${BTN_INACTIVE} ${!canZoomIn ? BTN_DISABLED : ""}`}
              >
                +
              </button>
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

            <Divider />

            {/* Notebook Settings */}
            <button
              onClick={() => setNotebookSettingsOpen(true)}
              className={`${BTN} ${BTN_INACTIVE}`}
              aria-label="Notebook settings"
              data-testid="toolbar-notebook-settings"
            >
              Settings
            </button>

            <OfflineIndicator />
            {debugLastPointCount > 0 && (
              <span className="text-xs text-gray-600">{debugLastPointCount}pts</span>
            )}
          </div>
        </>
      )}

      {currentPage && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          pageId={currentPage.id}
          notebookId={notebookId}
        />
      )}

      <NotebookSettingsDialog
        open={notebookSettingsOpen}
        onClose={() => setNotebookSettingsOpen(false)}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-6 w-px bg-gray-400" />;
}

function ToolbarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
