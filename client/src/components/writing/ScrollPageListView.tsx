import { useEffect, useMemo } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { useVisiblePages } from "../../hooks/useVisiblePages";
import { PageSurface } from "./PageSurface";

export function ScrollPageListView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const { visiblePageIds, observeRef } = useVisiblePages(pageIds);

  const visibleArray = useMemo(
    () => Array.from(visiblePageIds),
    [visiblePageIds],
  );

  useMultiPageWebSocket(visibleArray);

  useEffect(() => {
    for (const pid of visiblePageIds) {
      loadPageStrokes(pid);
    }
  }, [visiblePageIds, loadPageStrokes]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-6">
        {pages.map((page) => (
          <div key={page.id} ref={observeRef(page.id)} className="w-full">
            {visiblePageIds.has(page.id) ? (
              <PageSurface pageId={page.id} />
            ) : (
              <div
                className="w-full bg-gray-50"
                style={{ aspectRatio: "1404 / 1872" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
