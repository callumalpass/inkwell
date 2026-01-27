import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotebooksPage } from "./pages/NotebooksPage";
import { WritingPage } from "./pages/WritingPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NotebooksPage />} />
        <Route path="/notebook/:notebookId/page/:pageId" element={<WritingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
