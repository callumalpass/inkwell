import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotebooksPage } from "./NotebooksPage";
import * as pagesApi from "../api/pages";
import { useNotebookStore } from "../stores/notebook-store";

const mockNavigate = vi.fn();
const mockCreateNotebook = vi.fn();
const mockFetchNotebooks = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../api/pages", () => ({
  createPage: vi.fn(),
}));

vi.mock("../stores/notebook-store", () => ({
  useNotebookStore: vi.fn(),
}));

vi.mock("../stores/toast-store", () => ({
  showError: vi.fn(),
}));

vi.mock("../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/notebooks/NotebookList", () => ({
  NotebookList: () => <div data-testid="notebook-list" />,
}));

vi.mock("../components/notebooks/CreateNotebookDialog", () => ({
  CreateNotebookDialog: () => null,
}));

vi.mock("../components/notebooks/RecentPagesMenu", () => ({
  RecentPagesMenu: () => <div data-testid="recent-pages-menu" />,
}));

vi.mock("../components/export/ExportDialog", () => ({
  ExportDialog: () => null,
}));

vi.mock("../components/settings/SettingsPanel", () => ({
  SettingsPanel: () => null,
}));

vi.mock("../components/search/SearchView", () => ({
  SearchView: () => null,
}));

describe("NotebooksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotebookStore).mockReturnValue({
      notebooks: [],
      loading: false,
      error: null,
      fetchNotebooks: mockFetchNotebooks,
      createNotebook: mockCreateNotebook,
      renameNotebook: vi.fn(),
      updateNotebookTags: vi.fn(),
      duplicateNotebook: vi.fn(),
      deleteNotebook: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a quick notebook with a scratch tag and opens its first page", async () => {
    mockCreateNotebook.mockResolvedValue({
      id: "nb_quick",
      title: "Quick",
      createdAt: "2026-04-06T14:32:00.000Z",
      updatedAt: "2026-04-06T14:32:00.000Z",
      tags: ["scratch"],
    });
    vi.mocked(pagesApi.createPage).mockResolvedValue({
      id: "pg_first",
      notebookId: "nb_quick",
      pageNumber: 1,
      canvasX: 0,
      canvasY: 0,
      createdAt: "2026-04-06T14:32:01.000Z",
      updatedAt: "2026-04-06T14:32:01.000Z",
    });

    render(<NotebooksPage />);

    fireEvent.click(screen.getByTestId("quick-notebook-button"));

    await waitFor(() => {
      expect(mockCreateNotebook).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
        ["scratch"],
      );
    });
    expect(pagesApi.createPage).toHaveBeenCalledWith("nb_quick");
    expect(mockNavigate).toHaveBeenCalledWith("/notebook/nb_quick/page/pg_first");
  });
});
