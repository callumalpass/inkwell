import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useTagsPanelStore } from "../../stores/tags-panel-store";
import { useBookmarkPanelStore } from "../../stores/bookmark-panel-store";
import { findNearestPageInDirection, type Direction } from "../../lib/page-direction-nav";
import type { PageMeta } from "../../api/pages";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

const DIRECTION_BUTTONS: Array<{ dir: Direction; label: string; title: string }> = [
  { dir: "up", label: "\u2191", title: "Nearest page above" },
  { dir: "left", label: "\u2190", title: "Nearest page to the left" },
  { dir: "right", label: "\u2192", title: "Nearest page to the right" },
  { dir: "down", label: "\u2193", title: "Nearest page below" },
];

export function QuickActionsBar() {
  const { notebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();
  const viewMode = useViewStore((s) => s.viewMode);
  const canvasTransform = useViewStore((s) => s.canvasTransform);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const canvasContainerSize = useViewStore((s) => s.canvasContainerSize);
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);

  const linksPanelOpen = useLinksPanelStore((s) => s.panelOpen);
  const linksPanelPageId = useLinksPanelStore((s) => s.panelPageId);
  const openLinksPanel = useLinksPanelStore((s) => s.openPanel);
  const closeLinksPanel = useLinksPanelStore((s) => s.closePanel);

  const tagsPanelOpen = useTagsPanelStore((s) => s.panelOpen);
  const tagsPanelPageId = useTagsPanelStore((s) => s.panelPageId);
  const openTagsPanel = useTagsPanelStore((s) => s.openPanel);
  const closeTagsPanel = useTagsPanelStore((s) => s.closePanel);

  const bookmarksPanelOpen = useBookmarkPanelStore((s) => s.panelOpen);
  const openBookmarksPanel = useBookmarkPanelStore((s) => s.openPanel);
  const closeBookmarksPanel = useBookmarkPanelStore((s) => s.closePanel);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [canHistoryBack, setCanHistoryBack] = useState(false);
  const [canHistoryForward, setCanHistoryForward] = useState(false);
  const activationHistoryRef = useRef<string[]>([]);
  const historyCursorRef = useRef(-1);
  const skipRecordRef = useRef(false);

  const currentPage = pages[currentPageIndex];
  const currentPageId = currentPage?.id ?? null;

  const targetsByDirection = useMemo(() => {
    if (!currentPageId) {
      return {
        up: null,
        down: null,
        left: null,
        right: null,
      } as const;
    }

    return {
      up: findNearestPageInDirection(
        pages,
        currentPageId,
        "up",
        PAGE_RENDER_WIDTH,
        PAGE_RENDER_HEIGHT,
      ),
      down: findNearestPageInDirection(
        pages,
        currentPageId,
        "down",
        PAGE_RENDER_WIDTH,
        PAGE_RENDER_HEIGHT,
      ),
      left: findNearestPageInDirection(
        pages,
        currentPageId,
        "left",
        PAGE_RENDER_WIDTH,
        PAGE_RENDER_HEIGHT,
      ),
      right: findNearestPageInDirection(
        pages,
        currentPageId,
        "right",
        PAGE_RENDER_WIDTH,
        PAGE_RENDER_HEIGHT,
      ),
    } as const;
  }, [pages, currentPageId]);

  const closeMetaPanels = useCallback(() => {
    closeLinksPanel();
    closeTagsPanel();
    closeBookmarksPanel();
  }, [closeLinksPanel, closeTagsPanel, closeBookmarksPanel]);

  const centerCanvasOnPage = useCallback((page: PageMeta) => {
    if (viewMode !== "canvas") return;

    const { width, height } = canvasContainerSize;
    if (width <= 0 || height <= 0) return;

    const pageCenterX = page.canvasX + PAGE_RENDER_WIDTH / 2;
    const pageCenterY = page.canvasY + PAGE_RENDER_HEIGHT / 2;

    setCanvasTransform({
      ...canvasTransform,
      x: -pageCenterX * canvasTransform.scale + width / 2,
      y: -pageCenterY * canvasTransform.scale + height / 2,
    });
  }, [viewMode, canvasContainerSize, canvasTransform, setCanvasTransform]);

  const goToPage = useCallback((pageId: string) => {
    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex < 0) return;
    const targetPage = pages[pageIndex];
    setCurrentPageIndex(pageIndex);
    if (targetPage) {
      centerCanvasOnPage(targetPage);
    }
    if (notebookId) {
      navigate(`/notebook/${notebookId}/page/${pageId}`, { replace: true });
    }
  }, [pages, setCurrentPageIndex, centerCanvasOnPage, notebookId, navigate]);

  const handleDirectionalNavigate = useCallback((direction: Direction) => {
    const targetPageId = targetsByDirection[direction];
    if (!targetPageId) return;
    goToPage(targetPageId);
  }, [targetsByDirection, goToPage]);

  const updateHistoryControls = useCallback(() => {
    const cursor = historyCursorRef.current;
    const historyLength = activationHistoryRef.current.length;
    setCanHistoryBack(cursor > 0);
    setCanHistoryForward(cursor >= 0 && cursor < historyLength - 1);
  }, []);

  useEffect(() => {
    activationHistoryRef.current = [];
    historyCursorRef.current = -1;
    skipRecordRef.current = false;
    updateHistoryControls();
  }, [notebookId, updateHistoryControls]);

  useEffect(() => {
    if (!currentPageId) {
      updateHistoryControls();
      return;
    }

    if (skipRecordRef.current) {
      skipRecordRef.current = false;
      updateHistoryControls();
      return;
    }

    const history = activationHistoryRef.current;
    const cursor = historyCursorRef.current;
    if (cursor >= 0 && history[cursor] === currentPageId) {
      updateHistoryControls();
      return;
    }

    const truncated = history.slice(0, cursor + 1);
    if (truncated[truncated.length - 1] !== currentPageId) {
      truncated.push(currentPageId);
    }
    activationHistoryRef.current = truncated;
    historyCursorRef.current = truncated.length - 1;
    updateHistoryControls();
  }, [currentPageId, updateHistoryControls]);

  const handleHistoryBack = useCallback(() => {
    if (!canHistoryBack) return;
    const nextCursor = historyCursorRef.current - 1;
    if (nextCursor < 0) return;
    const targetPageId = activationHistoryRef.current[nextCursor];
    if (!targetPageId) return;
    skipRecordRef.current = true;
    historyCursorRef.current = nextCursor;
    updateHistoryControls();
    goToPage(targetPageId);
  }, [canHistoryBack, goToPage, updateHistoryControls]);

  const handleHistoryForward = useCallback(() => {
    if (!canHistoryForward) return;
    const nextCursor = historyCursorRef.current + 1;
    const targetPageId = activationHistoryRef.current[nextCursor];
    if (!targetPageId) return;
    skipRecordRef.current = true;
    historyCursorRef.current = nextCursor;
    updateHistoryControls();
    goToPage(targetPageId);
  }, [canHistoryForward, goToPage, updateHistoryControls]);

  const linksActive = linksPanelOpen;
  const tagsActive = tagsPanelOpen;
  const bookmarksActive = bookmarksPanelOpen;

  const toggleLinks = useCallback(() => {
    if (!currentPageId) return;
    if (linksActive) {
      closeLinksPanel();
      return;
    }
    closeMetaPanels();
    openLinksPanel(currentPageId);
  }, [currentPageId, linksActive, closeLinksPanel, closeMetaPanels, openLinksPanel]);

  const toggleTags = useCallback(() => {
    if (!currentPageId) return;
    if (tagsActive) {
      closeTagsPanel();
      return;
    }
    closeMetaPanels();
    openTagsPanel(currentPageId);
  }, [currentPageId, tagsActive, closeTagsPanel, closeMetaPanels, openTagsPanel]);

  const toggleBookmarks = useCallback(() => {
    if (!currentPageId) return;
    if (bookmarksActive) {
      closeBookmarksPanel();
      return;
    }
    closeMetaPanels();
    openBookmarksPanel(currentPageId);
  }, [currentPageId, bookmarksActive, closeBookmarksPanel, closeMetaPanels, openBookmarksPanel]);

  if (viewMode !== "single" && viewMode !== "canvas") return null;
  if (pages.length === 0) return null;

  return (
    <div className="fixed right-0 bottom-4 z-40 flex items-center" data-testid="quick-actions-root">
      {!isCollapsed && (
        <div
          className="mr-1 rounded-lg border border-gray-300 bg-white/95 p-1.5 shadow-md backdrop-blur-sm"
          data-testid="quick-actions-panel"
        >
          <div className="grid grid-cols-3 gap-1">
            <DirectionButton
              onClick={handleHistoryBack}
              disabled={!canHistoryBack}
              ariaLabel="Navigate to previous active page"
              title="Previous active page"
            >
              {"\u2039"}
            </DirectionButton>
            <DirectionButton
              onClick={() => handleDirectionalNavigate("up")}
              disabled={!targetsByDirection.up}
              ariaLabel="Navigate to nearest page up"
              title={DIRECTION_BUTTONS[0].title}
            >
              {DIRECTION_BUTTONS[0].label}
            </DirectionButton>
            <DirectionButton
              onClick={handleHistoryForward}
              disabled={!canHistoryForward}
              ariaLabel="Navigate to next active page"
              title="Next active page"
            >
              {"\u203A"}
            </DirectionButton>

            <DirectionButton
              onClick={() => handleDirectionalNavigate("left")}
              disabled={!targetsByDirection.left}
              ariaLabel="Navigate to nearest page left"
              title={DIRECTION_BUTTONS[1].title}
            >
              {DIRECTION_BUTTONS[1].label}
            </DirectionButton>
            <div className="flex h-8 w-8 items-center justify-center text-[10px] font-semibold text-gray-500">
              XY
            </div>
            <DirectionButton
              onClick={() => handleDirectionalNavigate("right")}
              disabled={!targetsByDirection.right}
              ariaLabel="Navigate to nearest page right"
              title={DIRECTION_BUTTONS[2].title}
            >
              {DIRECTION_BUTTONS[2].label}
            </DirectionButton>

            <div />
            <DirectionButton
              onClick={() => handleDirectionalNavigate("down")}
              disabled={!targetsByDirection.down}
              ariaLabel="Navigate to nearest page down"
              title={DIRECTION_BUTTONS[3].title}
            >
              {DIRECTION_BUTTONS[3].label}
            </DirectionButton>
            <div />
          </div>

          <div className="my-1 h-px bg-gray-200" />

          <div className="flex items-center gap-1">
            <MetaButton
              onClick={toggleLinks}
              active={linksActive}
              ariaLabel="Toggle links panel"
              title="Links"
            >
              L
            </MetaButton>
            <MetaButton
              onClick={toggleTags}
              active={tagsActive}
              ariaLabel="Toggle tags panel"
              title="Tags"
            >
              T
            </MetaButton>
            <MetaButton
              onClick={toggleBookmarks}
              active={bookmarksActive}
              ariaLabel="Toggle bookmarks panel"
              title="Bookmarks"
            >
              B
            </MetaButton>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsCollapsed((v) => !v)}
        className="h-12 w-5 rounded-l-md border border-r-0 border-gray-300 bg-white/95 text-xs text-gray-500 shadow-sm backdrop-blur-sm"
        aria-label={isCollapsed ? "Show quick actions" : "Hide quick actions"}
        data-testid="quick-actions-toggle"
      >
        {isCollapsed ? "\u2039" : "\u203A"}
      </button>
    </div>
  );
}

interface DirectionButtonProps {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  title: string;
  children: string;
}

function DirectionButton({
  onClick,
  disabled,
  ariaLabel,
  title,
  children,
}: DirectionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="h-8 w-8 rounded border border-gray-300 bg-white text-sm text-gray-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface MetaButtonProps {
  onClick: () => void;
  active: boolean;
  ariaLabel: string;
  title: string;
  children: string;
}

function MetaButton({ onClick, active, ariaLabel, title, children }: MetaButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`h-7 w-7 rounded border text-xs font-semibold ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 bg-white text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
