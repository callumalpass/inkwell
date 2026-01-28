import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { NotebooksPage } from "./pages/NotebooksPage";
import { WritingPage } from "./pages/WritingPage";
import { useEffect, useState, useCallback, useRef } from "react";
import { listPages, createPage } from "./api/pages";
import { useSettingsStore } from "./stores/settings-store";
import { Toaster } from "./components/ui/Toaster";
import { BulkProgressIndicator } from "./components/ui/BulkProgressIndicator";
import { KeyboardShortcutsDialog } from "./components/ui/KeyboardShortcutsDialog";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { setQuotaExceededCallback } from "./lib/offline-queue";
import { showError } from "./stores/toast-store";

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const quotaWarningShownRef = useRef(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Set up offline queue quota exceeded notification
  useEffect(() => {
    setQuotaExceededCallback(() => {
      // Only show warning once per session to avoid spam
      if (!quotaWarningShownRef.current) {
        quotaWarningShownRef.current = true;
        showError(
          "Offline storage full. Some strokes may not be saved while offline.",
          8000,
        );
      }
    });
    return () => setQuotaExceededCallback(null);
  }, []);

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // ? key to show shortcuts
    if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setShortcutsOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  if (!loaded) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NotebooksPage />} />
          <Route path="/notebook/:notebookId" element={<NotebookRedirect />} />
          <Route path="/notebook/:notebookId/page/:pageId" element={<WritingPage />} />
        </Routes>
        <Toaster />
        <BulkProgressIndicator />
        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
