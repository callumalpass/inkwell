import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotebookPagesStore } from "../stores/notebook-pages-store";
import { usePageStore } from "../stores/page-store";
import { useBatchSave } from "../hooks/useBatchSave";
import { WritingView } from "../components/writing/WritingView";

export function WritingPage() {
  const { notebookId, pageId } = useParams<{
    notebookId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const { pages, loading, error, loadNotebookPages, setCurrentPageIndex } =
    useNotebookPagesStore();
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);

  useEffect(() => {
    if (notebookId) loadNotebookPages(notebookId);
  }, [notebookId, loadNotebookPages]);

  // Set current page index based on route param
  useEffect(() => {
    if (pageId && pages.length > 0) {
      const idx = pages.findIndex((p) => p.id === pageId);
      if (idx >= 0) setCurrentPageIndex(idx);
    }
  }, [pageId, pages, setCurrentPageIndex]);

  // Load strokes for the current page
  useEffect(() => {
    if (pageId) loadPageStrokes(pageId);
  }, [pageId, loadPageStrokes]);

  // Batch save flushes all pending strokes across pages
  useBatchSave();

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load notebook</p>
          <button
            onClick={() => navigate("/")}
            className="mt-2 text-sm text-gray-600 underline"
          >
            Back to notebooks
          </button>
        </div>
      </div>
    );
  }

  if (loading || pages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <WritingView />;
}
