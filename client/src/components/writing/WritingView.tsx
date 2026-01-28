import { useViewStore } from "../../stores/view-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { Toolbar } from "./toolbar";
import { SinglePageView } from "./SinglePageView";
import { ScrollPageListView } from "./ScrollPageListView";
import { CanvasView } from "./CanvasView";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { PageLinksPanel } from "./PageLinksPanel";
import { PageTagsPanel } from "./PageTagsPanel";
import { useUndoRedoKeyboard } from "../../hooks/useUndoRedo";
import { useOfflineSync } from "../../hooks/useOfflineSync";

export function WritingView() {
  const viewMode = useViewStore((s) => s.viewMode);
  const currentPageId = useNotebookPagesStore(
    (s) => s.pages[s.currentPageIndex]?.id ?? "",
  );
  useUndoRedoKeyboard(currentPageId);
  useOfflineSync();

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      {viewMode === "single" && <SinglePageView />}
      {viewMode === "scroll" && <ScrollPageListView />}
      {viewMode === "canvas" && <CanvasView />}
      <TranscriptionPanel />
      <PageLinksPanel />
      <PageTagsPanel />
    </div>
  );
}
