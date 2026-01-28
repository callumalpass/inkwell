import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useViewStore } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { Toolbar } from "./toolbar";
import { SinglePageView } from "./SinglePageView";
import { CanvasView } from "./CanvasView";
import { OverviewView } from "./OverviewView";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { PageLinksPanel } from "./PageLinksPanel";
import { PageTagsPanel } from "./PageTagsPanel";
import { SearchView } from "../search/SearchView";
import { KeyboardShortcutsDialog } from "../ui/KeyboardShortcutsDialog";
import { useUndoRedoKeyboard } from "../../hooks/useUndoRedo";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { usePageNavKeyboard } from "../../hooks/usePageNavKeyboard";
import { useFitAll } from "../../hooks/useFitAll";
import { showSuccess, showError } from "../../stores/toast-store";

export function WritingView() {
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();
  const viewMode = useViewStore((s) => s.viewMode);
  const setViewMode = useViewStore((s) => s.setViewMode);
  const currentPageId = useNotebookPagesStore(
    (s) => s.pages[s.currentPageIndex]?.id ?? "",
  );
  const addNewPage = useNotebookPagesStore((s) => s.addNewPage);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);

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
    }
  }, [handleCreatePage, setViewMode, fitAll]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      {viewMode === "single" && <SinglePageView />}
      {viewMode === "canvas" && <CanvasView />}
      {viewMode === "overview" && <OverviewView />}
      <TranscriptionPanel />
      <PageLinksPanel />
      <PageTagsPanel />
      <SearchView open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
