import { useEffect } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { PageSurface } from "./PageSurface";
import type { GridType } from "./PageBackground";

export function SinglePageView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const gridType = useNotebookPagesStore((s) => (s.settings.gridType ?? "none") as GridType);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);

  const currentPage = pages[currentPageIndex];

  useEffect(() => {
    if (currentPage) loadPageStrokes(currentPage.id);
  }, [currentPage?.id, loadPageStrokes]);

  useWebSocket(currentPage?.id);

  if (!currentPage) return null;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-100 p-4">
      <div className="h-full" style={{ aspectRatio: "1404 / 1872" }}>
        <PageSurface pageId={currentPage.id} gridType={gridType} />
      </div>
    </div>
  );
}
