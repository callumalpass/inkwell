import { useState, useEffect, useCallback } from "react";
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
import { useUndoRedoKeyboard } from "../../hooks/useUndoRedo";
import { useOfflineSync } from "../../hooks/useOfflineSync";

export function WritingView() {
  const viewMode = useViewStore((s) => s.viewMode);
  const currentPageId = useNotebookPagesStore(
    (s) => s.pages[s.currentPageIndex]?.id ?? "",
  );
  const [searchOpen, setSearchOpen] = useState(false);

  useUndoRedoKeyboard(currentPageId);
  useOfflineSync();

  // Global keyboard shortcut: Ctrl+K or Cmd+K to open search
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

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
    </div>
  );
}
