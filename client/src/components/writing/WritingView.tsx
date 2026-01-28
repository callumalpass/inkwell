import { useViewStore } from "../../stores/view-store";
import { Toolbar } from "./Toolbar";
import { SinglePageView } from "./SinglePageView";
import { ScrollPageListView } from "./ScrollPageListView";
import { CanvasView } from "./CanvasView";
import { TranscriptionPanel } from "./TranscriptionPanel";

export function WritingView() {
  const viewMode = useViewStore((s) => s.viewMode);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      {viewMode === "single" && <SinglePageView />}
      {viewMode === "scroll" && <ScrollPageListView />}
      {viewMode === "canvas" && <CanvasView />}
      <TranscriptionPanel />
    </div>
  );
}
