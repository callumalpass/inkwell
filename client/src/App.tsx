import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { NotebooksPage } from "./pages/NotebooksPage";
import { WritingPage } from "./pages/WritingPage";
import { useEffect, useState } from "react";
import { listPages, createPage } from "./api/pages";
import { useSettingsStore } from "./stores/settings-store";

function NotebookRedirect() {
  const { notebookId } = useParams<{ notebookId: string }>();
  const [targetPageId, setTargetPageId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!notebookId) return;

    listPages(notebookId)
      .then(async (pages) => {
        if (pages.length > 0) {
          setTargetPageId(pages[0].id);
        } else {
          const page = await createPage(notebookId);
          setTargetPageId(page.id);
        }
      })
      .catch(() => setError(true));
  }, [notebookId]);

  if (error) return <Navigate to="/" replace />;
  if (!targetPageId) return null;
  return <Navigate to={`/notebook/${notebookId}/page/${targetPageId}`} replace />;
}

export function App() {
  const { loaded, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (!loaded) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NotebooksPage />} />
        <Route path="/notebook/:notebookId" element={<NotebookRedirect />} />
        <Route path="/notebook/:notebookId/page/:pageId" element={<WritingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
