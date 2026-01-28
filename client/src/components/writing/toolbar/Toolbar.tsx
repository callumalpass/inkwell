import { useState, useRef, useEffect } from "react";
import { useDrawingStore } from "../../../stores/drawing-store";
import { useViewStore } from "../../../stores/view-store";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { useNavigate, useParams } from "react-router-dom";
import { TranscriptionIndicator } from "../TranscriptionIndicator";
import { OfflineIndicator } from "../OfflineIndicator";
import { SyncIndicator } from "../SyncIndicator";
import { Divider, ToolbarButton } from "./ToolbarPrimitives";
import { ToolSelector } from "./ToolSelector";
import { WidthPicker } from "./WidthPicker";
import { ColorPicker } from "./ColorPicker";
import { PenStylePicker } from "./PenStylePicker";
import { StrokePreview } from "./StrokePreview";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ZoomControls } from "./ZoomControls";
import { PageNavControls } from "./PageNavControls";
import { ViewModePicker } from "./ViewModePicker";
import { GridTypePicker } from "./GridTypePicker";
import { LineSpacingPicker } from "./LineSpacingPicker";
import { PageActionButtons } from "./PageActionButtons";

/** Width (px) below which the toolbar switches to compact mode. */
const COMPACT_BREAKPOINT = 768;

export function Toolbar() {
  const isPen = useDrawingStore((s) => s.tool === "pen");
  const debugLastPointCount = useDrawingStore((s) => s.debugLastPointCount);
  const viewMode = useViewStore((s) => s.viewMode);
  const currentPage = useNotebookPagesStore(
    (s) => s.pages[s.currentPageIndex] ?? null,
  );
  const currentPageId = currentPage?.id ?? "";
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();

  const [expanded, setExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
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

  return (
    <div
      ref={toolbarRef}
      className={`border-b-2 border-gray-400 bg-white ${isCompact ? "px-3" : "px-4"} py-1.5`}
    >
      {isCompact ? (
        <CompactLayout
          isPen={isPen}
          expanded={expanded}
          toggleExpanded={() => setExpanded((e) => !e)}
          currentPageId={currentPageId}
          currentPage={currentPage}
          notebookId={notebookId}
          viewMode={viewMode}
          debugLastPointCount={debugLastPointCount}
          navigate={navigate}
        />
      ) : (
        <FullLayout
          isPen={isPen}
          currentPageId={currentPageId}
          currentPage={currentPage}
          notebookId={notebookId}
          viewMode={viewMode}
          debugLastPointCount={debugLastPointCount}
          navigate={navigate}
        />
      )}
    </div>
  );
}

/* ── Compact layout ──────────────────────────────────────────── */

interface CompactLayoutProps {
  isPen: boolean;
  expanded: boolean;
  toggleExpanded: () => void;
  currentPageId: string;
  currentPage: { id: string } | null;
  notebookId: string | undefined;
  viewMode: string;
  debugLastPointCount: number;
  navigate: ReturnType<typeof useNavigate>;
}

function CompactLayout({
  isPen,
  expanded,
  toggleExpanded,
  currentPageId,
  currentPage,
  notebookId,
  viewMode,
  debugLastPointCount,
  navigate,
}: CompactLayoutProps) {
  return (
    <>
      {/* Primary row: essential tools always visible */}
      <div className="flex items-center gap-1.5">
        <ToolbarButton onClick={() => navigate("/")} aria-label="Home">
          Home
        </ToolbarButton>

        <Divider />

        <ToolSelector />

        <Divider />

        {/* Stroke preview swatch — tap to expand settings */}
        <button
          onClick={toggleExpanded}
          className="flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-1"
          aria-label="Pen settings"
        >
          <StrokePreview />
        </button>

        <Divider />

        <PageNavControls />

        <div className="flex-1" />

        <UndoRedoButtons pageId={currentPageId} />

        <Divider />

        {/* Expand / collapse toggle */}
        <ToolbarButton
          onClick={toggleExpanded}
          active={expanded}
          aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
          aria-expanded={expanded}
        >
          {expanded ? "\u25B2" : "\u22EF"}
        </ToolbarButton>

        <SyncIndicator />
        <OfflineIndicator />
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-1.5 space-y-1.5 border-t border-gray-200 pt-1.5">
          <WidthPicker showLabel />
          {isPen && <ColorPicker showLabel />}
          {isPen && <PenStylePicker showLabel />}
          <GridTypePicker showLabel />
          <LineSpacingPicker showLabel />
          <ViewModePicker showLabel />

          {/* Notebook Settings row */}
          <div className="flex items-center gap-1.5">
            <span className="w-12 shrink-0 text-xs font-medium text-gray-500">Setup</span>
            <PageActionButtons
              currentPageId={currentPage?.id ?? null}
              notebookId={notebookId}
              testIdSuffix="compact"
            />
          </div>

          {/* Zoom + indicators */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ZoomControls />

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
  );
}

/* ── Full-size layout ────────────────────────────────────────── */

interface FullLayoutProps {
  isPen: boolean;
  currentPageId: string;
  currentPage: { id: string } | null;
  notebookId: string | undefined;
  viewMode: string;
  debugLastPointCount: number;
  navigate: ReturnType<typeof useNavigate>;
}

function FullLayout({
  isPen,
  currentPageId,
  currentPage,
  notebookId,
  viewMode,
  debugLastPointCount,
  navigate,
}: FullLayoutProps) {
  return (
    <>
      {/* Row 1: Drawing tools */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton onClick={() => navigate("/")} aria-label="Home">
          Home
        </ToolbarButton>

        <Divider />

        <ToolSelector />

        <Divider />

        <WidthPicker />

        {isPen && (
          <>
            <Divider />
            <ColorPicker />
          </>
        )}

        {isPen && (
          <>
            <Divider />
            <PenStylePicker />
          </>
        )}

        {isPen && (
          <>
            <Divider />
            <StrokePreview />
          </>
        )}

        <Divider />

        <UndoRedoButtons pageId={currentPageId} />
      </div>

      {/* Row 2: Page & view controls */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-1.5">
        <PageNavControls />

        <Divider />

        <PageActionButtons
          currentPageId={currentPage?.id ?? null}
          notebookId={notebookId}
        />

        <GridTypePicker />
        <LineSpacingPicker />

        <Divider />

        <ZoomControls />

        <div className="flex-1" />

        {viewMode === "single" && currentPage && (
          <TranscriptionIndicator pageId={currentPage.id} />
        )}

        <ViewModePicker />

        <SyncIndicator />
        <OfflineIndicator />
        {debugLastPointCount > 0 && (
          <span className="text-xs text-gray-600">{debugLastPointCount}pts</span>
        )}
      </div>
    </>
  );
}
