import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePageStore } from "../stores/page-store";
import { useBatchSave } from "../hooks/useBatchSave";
import { useWebSocket } from "../hooks/useWebSocket";
import { WritingView } from "../components/writing/WritingView";

export function WritingPage() {
  const { pageId } = useParams<{ notebookId: string; pageId: string }>();
  const navigate = useNavigate();
  const { loading, error, loadPage } = usePageStore();

  useEffect(() => {
    if (pageId) loadPage(pageId);
  }, [pageId, loadPage]);

  useBatchSave(pageId);
  useWebSocket(pageId);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load page</p>
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <WritingView />;
}
