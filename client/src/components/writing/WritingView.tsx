import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useViewStore } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { useUIStore } from "../../stores/ui-store";
import { useTranscriptionStore } from "../../stores/transcription-store";
import { useBookmarkPanelStore } from "../../stores/bookmark-panel-store";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useTagsPanelStore } from "../../stores/tags-panel-store";
import { Toolbar } from "./toolbar";
import { SinglePageView } from "./SinglePageView";
import { CanvasView } from "./CanvasView";
import { OverviewView } from "./OverviewView";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { PageLinksPanel } from "./PageLinksPanel";
import { PageTagsPanel } from "./PageTagsPanel";
import { PageBookmarksPanel } from "./PageBookmarksPanel";
import { SearchView } from "../search/SearchView";
import { KeyboardShortcutsDialog } from "../ui/KeyboardShortcutsDialog";
import { ViewErrorBoundary } from "../ui/ViewErrorBoundary";
import { WelcomeTooltip } from "../ui/WelcomeTooltip";
import { PageJumpDialog } from "./PageJumpDialog";
import { QuickActionsBar } from "./QuickActionsBar";
import { useUndoRedoKeyboard } from "../../hooks/useUndoRedo";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { usePageNavKeyboard } from "../../hooks/usePageNavKeyboard";
import { useFitAll } from "../../hooks/useFitAll";
import { showSuccess, showError } from "../../stores/toast-store";

export function WritingView() {
  const navigate = useNavigate();
  const { notebookId, pageId } = useParams<{ notebookId: string; pageId: string }>();
  const viewMode = useViewStore((s) => s.viewMode);
  const setViewMode = useViewStore((s) => s.setViewMode);
  const currentPageId = useNotebookPagesStore(
    (s) => s.pages[s.currentPageIndex]?.id ?? "",
  );
  const addNewPage = useNotebookPagesStore((s) => s.addNewPage);
  const toggleBookmark = useNotebookPagesStore((s) => s.toggleBookmark);
  const setTool = useDrawingStore((s) => s.setTool);
  const pageJumpOpen = useUIStore((s) => s.pageJumpOpen);
  const setPageJumpOpen = useUIStore((s) => s.setPageJumpOpen);
  const triggerTranscription = useTranscriptionStore((s) => s.triggerTranscription);
  const linksPanelOpen = useLinksPanelStore((s) => s.panelOpen);
  const linksPanelPageId = useLinksPanelStore((s) => s.panelPageId);
  const openLinksPanel = useLinksPanelStore((s) => s.openPanel);
  const tagsPanelOpen = useTagsPanelStore((s) => s.panelOpen);
  const tagsPanelPageId = useTagsPanelStore((s) => s.panelPageId);
  const openTagsPanel = useTagsPanelStore((s) => s.openPanel);
  const bookmarksPanelOpen = useBookmarkPanelStore((s) => s.panelOpen);
  const bookmarksPanelPageId = useBookmarkPanelStore((s) => s.panelPageId);
  const openBookmarksPanel = useBookmarkPanelStore((s) => s.openPanel);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const previousViewModeRef = useRef(viewMode);

  const { fitAll } = useFitAll();

  useUndoRedoKeyboard(currentPageId);
  useOfflineSync();
  usePageNavKeyboard();

  const handleCreatePage = useCallback(async () => {
    if (creatingPage || !notebookId) return;
    setCreatingPage(true);
    try {
      const newPage = await addNewPage();
      showSuccess("New page created");
      navigate(`/notebook/${notebookId}/page/${newPage.id}`, { replace: true });
    } catch (err) {
      console.error("Failed to create page:", err);
      showError("Failed to create page");
    } finally {
      setCreatingPage(false);
    }
  }, [creatingPage, notebookId, addNewPage, navigate]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+K or Cmd+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }

    // Don't handle other shortcuts when typing in an input
    const target = e.target as HTMLElement;
    const isInputField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    if (isInputField) return;

    // ? to show keyboard shortcuts
    if (e.key === "?") {
      e.preventDefault();
      setShortcutsOpen(true);
      return;
    }

    // N to create new page (without modifiers)
    if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      handleCreatePage();
      return;
    }

    // View mode shortcuts: 1 = single, 2 = canvas, 3 = overview
    if (e.key === "1" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setViewMode("single");
      return;
    }
    if (e.key === "2" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setViewMode("canvas");
      return;
    }
    if (e.key === "3" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setViewMode("overview");
      return;
    }

    // F to fit all pages (only in canvas view)
    if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      fitAll();
      return;
    }

    // G to open page jump dialog (only in single view)
    if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (viewMode === "single") {
        setPageJumpOpen(true);
      }
      return;
    }

    // P for pen tool
    if (e.key === "p" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setTool("pen");
      return;
    }

    // E for eraser tool
    if (e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setTool("eraser");
      return;
    }

    // H for highlighter tool
    if (e.key === "h" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setTool("highlighter");
      return;
    }

    // B toggles bookmark on current page; Shift+B opens bookmarks panel
    if (e.key.toLowerCase() === "b" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (!currentPageId) return;
      if (e.shiftKey) {
        useLinksPanelStore.getState().closePanel();
        useTagsPanelStore.getState().closePanel();
        useBookmarkPanelStore.getState().openPanel(currentPageId);
        return;
      }
      toggleBookmark(currentPageId).catch((err) => {
        console.error("Failed to toggle bookmark:", err);
        showError("Failed to update bookmark");
      });
      return;
    }

    // T to trigger transcription for current page (single page view only)
    if (e.key === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (viewMode === "single" && currentPageId) {
        triggerTranscription(currentPageId);
      }
    }
  }, [handleCreatePage, setViewMode, fitAll, viewMode, setTool, setPageJumpOpen, currentPageId, toggleBookmark, triggerTranscription]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    const enteredSingleMode = previousViewMode !== "single" && viewMode === "single";

    if (enteredSingleMode && notebookId && currentPageId && pageId !== currentPageId) {
      navigate(`/notebook/${notebookId}/page/${currentPageId}`, { replace: true });
    }

    previousViewModeRef.current = viewMode;
  }, [viewMode, notebookId, pageId, currentPageId, navigate]);

  useEffect(() => {
    if (!currentPageId) return;
    if (linksPanelOpen && linksPanelPageId !== currentPageId) {
      openLinksPanel(currentPageId);
    }
    if (tagsPanelOpen && tagsPanelPageId !== currentPageId) {
      openTagsPanel(currentPageId);
    }
    if (bookmarksPanelOpen && bookmarksPanelPageId !== currentPageId) {
      openBookmarksPanel(currentPageId);
    }
  }, [
    currentPageId,
    linksPanelOpen,
    linksPanelPageId,
    openLinksPanel,
    tagsPanelOpen,
    tagsPanelPageId,
    openTagsPanel,
    bookmarksPanelOpen,
    bookmarksPanelPageId,
    openBookmarksPanel,
  ]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      {viewMode === "single" && (
        <ViewErrorBoundary viewName="Single Page View">
          <SinglePageView />
        </ViewErrorBoundary>
      )}
      {viewMode === "canvas" && (
        <ViewErrorBoundary viewName="Canvas View">
          <CanvasView />
        </ViewErrorBoundary>
      )}
      {viewMode === "overview" && (
        <ViewErrorBoundary viewName="Overview">
          <OverviewView />
        </ViewErrorBoundary>
      )}
      <ViewErrorBoundary viewName="Transcription Panel">
        <TranscriptionPanel />
      </ViewErrorBoundary>
      <PageLinksPanel />
      <PageTagsPanel />
      <PageBookmarksPanel />
      <SearchView open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <PageJumpDialog
        open={pageJumpOpen}
        onClose={() => setPageJumpOpen(false)}
      />
      <QuickActionsBar />
      <WelcomeTooltip />
    </div>
  );
}
