import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverviewView } from "./OverviewView";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import type { PageMeta } from "../../api/pages";

vi.mock("../../api/export", () => ({
  exportPagePdf: vi.fn().mockResolvedValue(undefined),
  exportPagePng: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../api/notebooks", () => ({
  listNotebooks: vi.fn().mockResolvedValue([
    { id: "nb_other", title: "Other Notebook" },
  ]),
}));

vi.mock("../../api/pages", () => ({
  updatePage: vi.fn().mockImplementation((id, data) =>
    Promise.resolve({ id, ...data }),
  ),
  deletePage: vi.fn().mockResolvedValue(undefined),
  movePages: vi.fn().mockResolvedValue(undefined),
}));

function makePage(overrides: Partial<PageMeta> = {}): PageMeta {
  const id = `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    notebookId: "nb_test",
    pageNumber: 1,
    canvasX: 0,
    canvasY: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    links: [],
    ...overrides,
  };
}

beforeEach(() => {
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [],
    currentPageIndex: 0,
    settings: {},
    setCurrentPageIndex: vi.fn(),
    reorderPages: vi.fn().mockResolvedValue(undefined),
    removePages: vi.fn().mockResolvedValue(undefined),
    movePages: vi.fn().mockResolvedValue(undefined),
    updatePageTags: vi.fn().mockResolvedValue(undefined),
  });
  useViewStore.setState({
    viewMode: "overview",
    setViewMode: vi.fn(),
  });
  vi.clearAllMocks();
});

describe("OverviewView", () => {
  it("renders overview view container", () => {
    render(<OverviewView />);
    expect(screen.getByTestId("overview-view")).toBeInTheDocument();
  });

  it("shows Overview (read-only) label", () => {
    render(<OverviewView />);
    expect(screen.getByText("Overview (read-only)")).toBeInTheDocument();
  });

  it("shows Select All and Clear buttons", () => {
    render(<OverviewView />);
    expect(screen.getByText("Select All")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("shows selection count", () => {
    render(<OverviewView />);
    expect(screen.getByText("Selected: 0")).toBeInTheDocument();
  });
});

describe("OverviewView - Page Cards", () => {
  it("renders page cards for each page", () => {
    const pages = [
      makePage({ pageNumber: 1 }),
      makePage({ pageNumber: 2 }),
      makePage({ pageNumber: 3 }),
    ];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("shows checkbox for each page", () => {
    const pages = [makePage({ pageNumber: 1 }), makePage({ pageNumber: 2 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
  });

  it("shows page tags", () => {
    const pages = [
      makePage({ pageNumber: 1, tags: ["meeting", "important"] }),
    ];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    expect(screen.getByText("meeting")).toBeInTheDocument();
    expect(screen.getByText("important")).toBeInTheDocument();
  });

  it("shows +N indicator when page has more than 3 tags", () => {
    const pages = [
      makePage({
        pageNumber: 1,
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      }),
    ];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders thumbnail images", () => {
    const page = makePage({ id: "pg_thumbnail_test", pageNumber: 1 });
    useNotebookPagesStore.setState({ pages: [page] });

    render(<OverviewView />);

    const img = screen.getByAltText("Page 1") as HTMLImageElement;
    expect(img.src).toContain("/api/pages/pg_thumbnail_test/thumbnail");
  });
});

describe("OverviewView - Selection", () => {
  it("toggles selection when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(screen.getByText("Selected: 1")).toBeInTheDocument();
  });

  it("selects all pages when Select All is clicked", async () => {
    const user = userEvent.setup();
    const pages = [
      makePage({ pageNumber: 1 }),
      makePage({ pageNumber: 2 }),
      makePage({ pageNumber: 3 }),
    ];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByText("Select All"));

    expect(screen.getByText("Selected: 3")).toBeInTheDocument();
  });

  it("clears selection when Clear is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 }), makePage({ pageNumber: 2 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    // Select all first
    await user.click(screen.getByText("Select All"));
    expect(screen.getByText("Selected: 2")).toBeInTheDocument();

    // Clear selection
    await user.click(screen.getByText("Clear"));
    expect(screen.getByText("Selected: 0")).toBeInTheDocument();
  });

  it("updates selection count when toggling individual pages", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 }), makePage({ pageNumber: 2 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(screen.getByText("Selected: 1")).toBeInTheDocument();

    await user.click(checkboxes[1]);
    expect(screen.getByText("Selected: 2")).toBeInTheDocument();

    await user.click(checkboxes[0]);
    expect(screen.getByText("Selected: 1")).toBeInTheDocument();
  });
});

describe("OverviewView - Action Buttons", () => {
  it("disables action buttons when no pages selected", () => {
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    expect(screen.getByText("Add Tags")).toBeDisabled();
    expect(screen.getByText("Remove Tags")).toBeDisabled();
    expect(screen.getByText("Export")).toBeDisabled();
    expect(screen.getByText("Move")).toBeDisabled();
    expect(screen.getByText("Delete")).toBeDisabled();
  });

  it("enables action buttons when pages are selected", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(screen.getByText("Add Tags")).not.toBeDisabled();
    expect(screen.getByText("Remove Tags")).not.toBeDisabled();
    expect(screen.getByText("Export")).not.toBeDisabled();
    expect(screen.getByText("Move")).not.toBeDisabled();
    expect(screen.getByText("Delete")).not.toBeDisabled();
  });
});

describe("OverviewView - Open Page", () => {
  it("opens page in single view when thumbnail is clicked", async () => {
    const user = userEvent.setup();
    const setCurrentPageIndex = vi.fn();
    const setViewMode = vi.fn();
    const page = makePage({ pageNumber: 1 });
    useNotebookPagesStore.setState({
      pages: [page],
      setCurrentPageIndex,
    });
    useViewStore.setState({ setViewMode });

    render(<OverviewView />);

    const openButton = screen.getByRole("button", { name: "Open page 1" });
    await user.click(openButton);

    expect(setCurrentPageIndex).toHaveBeenCalledWith(0);
    expect(setViewMode).toHaveBeenCalledWith("single");
  });
});

describe("OverviewView - Tag Dialog", () => {
  it("opens Add Tags dialog when Add Tags is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Add Tags"));

    expect(screen.getByText("Add Tags", { selector: "h2" })).toBeInTheDocument();
    expect(
      screen.getByText("Enter tags separated by spaces or commas."),
    ).toBeInTheDocument();
  });

  it("opens Remove Tags dialog when Remove Tags is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Remove Tags"));

    expect(
      screen.getByText("Remove Tags", { selector: "h2" }),
    ).toBeInTheDocument();
  });

  it("closes tag dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Add Tags"));

    expect(screen.getByText("Add Tags", { selector: "h2" })).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));

    expect(
      screen.queryByText("Add Tags", { selector: "h2" }),
    ).not.toBeInTheDocument();
  });

  it("calls updatePageTags when Apply is clicked with tags", async () => {
    const user = userEvent.setup();
    const updatePageTags = vi.fn().mockResolvedValue(undefined);
    const page = makePage({ pageNumber: 1, tags: [] });
    useNotebookPagesStore.setState({ pages: [page], updatePageTags });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Add Tags"));

    const input = screen.getByPlaceholderText("meeting, project-x");
    await user.type(input, "newtag, anothertag");
    await user.click(screen.getByText("Apply"));

    expect(updatePageTags).toHaveBeenCalledWith(page.id, [
      "newtag",
      "anothertag",
    ]);
  });
});

describe("OverviewView - Export Dialog", () => {
  it("opens export dialog when Export is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Export"));

    expect(screen.getByText("Export 1 pages")).toBeInTheDocument();
    expect(
      screen.getByText("This will download one file per page."),
    ).toBeInTheDocument();
  });

  it("shows format selection buttons", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Export"));

    // The buttons have class "uppercase" so text content is lowercase "pdf", "png"
    expect(screen.getByText("pdf")).toBeInTheDocument();
    expect(screen.getByText("png")).toBeInTheDocument();
  });

  it("shows PDF options when PDF format is selected", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Export"));

    // PDF is default
    expect(screen.getByText("Page Size")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("A4")).toBeInTheDocument();
    expect(screen.getByText("Letter")).toBeInTheDocument();
    expect(screen.getByText("Include transcription")).toBeInTheDocument();
  });

  it("shows PNG options when PNG format is selected", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Export"));
    await user.click(screen.getByText("png"));

    expect(screen.getByText("Scale")).toBeInTheDocument();
    expect(screen.getByText("1\u00d7")).toBeInTheDocument();
    expect(screen.getByText("2\u00d7")).toBeInTheDocument();
    expect(screen.getByText("3\u00d7")).toBeInTheDocument();
    expect(screen.getByText("4\u00d7")).toBeInTheDocument();
  });

  it("calls export API when Export button is clicked", async () => {
    const user = userEvent.setup();
    const { exportPagePdf } = await import("../../api/export");
    const page = makePage({ pageNumber: 1 });
    useNotebookPagesStore.setState({ pages: [page] });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    // Click the first "Export" button in the toolbar
    const toolbarExportButton = screen.getByText("Export");
    await user.click(toolbarExportButton);

    // Find the Export button inside the dialog (the second one)
    const dialogExportButtons = screen.getAllByRole("button", { name: "Export" });
    // The last one is in the dialog
    const dialogExportButton = dialogExportButtons[dialogExportButtons.length - 1];
    await user.click(dialogExportButton);

    await waitFor(() => {
      expect(exportPagePdf).toHaveBeenCalledWith(page.id, {
        includeTranscription: false,
        pageSize: "original",
      });
    });
  });
});

describe("OverviewView - Delete", () => {
  it("shows confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Delete"));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete 1 page? This cannot be undone.",
    );

    confirmSpy.mockRestore();
  });

  it("calls removePages when confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const removePages = vi.fn().mockResolvedValue(undefined);
    const page = makePage({ pageNumber: 1 });
    useNotebookPagesStore.setState({ pages: [page], removePages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Delete"));

    expect(removePages).toHaveBeenCalledWith([page.id]);
  });

  it("does not call removePages when cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const removePages = vi.fn().mockResolvedValue(undefined);
    const page = makePage({ pageNumber: 1 });
    useNotebookPagesStore.setState({ pages: [page], removePages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Delete"));

    expect(removePages).not.toHaveBeenCalled();
  });
});

describe("OverviewView - Move Dialog", () => {
  it("opens move dialog when Move is clicked", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Move"));

    expect(screen.getByText("Move pages")).toBeInTheDocument();
    expect(screen.getByText("Target notebook")).toBeInTheDocument();
  });

  it("shows notebook options in select", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(screen.getByText("Other Notebook")).toBeInTheDocument();
    });
  });

  it("disables Move button when no notebook selected", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Move"));

    const moveButton = screen.getAllByText("Move").find(
      (el) => el.tagName === "BUTTON" && el.closest(".fixed"),
    );
    expect(moveButton).toBeDisabled();
  });

  it("calls movePages when Move is clicked with target selected", async () => {
    const user = userEvent.setup();
    const movePages = vi.fn().mockResolvedValue(undefined);
    const page = makePage({ pageNumber: 1 });
    useNotebookPagesStore.setState({ pages: [page], movePages });

    render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(screen.getByText("Other Notebook")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "nb_other");

    const moveButton = screen.getAllByText("Move").find(
      (el) => el.tagName === "BUTTON" && el.closest(".fixed"),
    ) as HTMLButtonElement;
    await user.click(moveButton);

    expect(movePages).toHaveBeenCalledWith([page.id], "nb_other");
  });
});

describe("OverviewView - Drag and Drop Reorder", () => {
  it("page cards are draggable", () => {
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages });

    render(<OverviewView />);

    const card = screen.getByText("Page 1").closest("[draggable]");
    expect(card).toHaveAttribute("draggable", "true");
  });
});

describe("OverviewView - Selection Cleanup", () => {
  it("removes invalid selections when pages change", async () => {
    const user = userEvent.setup();
    const page1 = makePage({ id: "pg_keep", pageNumber: 1 });
    const page2 = makePage({ id: "pg_remove", pageNumber: 2 });
    useNotebookPagesStore.setState({ pages: [page1, page2] });

    const { rerender } = render(<OverviewView />);

    // Select both pages
    await user.click(screen.getByText("Select All"));
    expect(screen.getByText("Selected: 2")).toBeInTheDocument();

    // Update pages to remove one
    useNotebookPagesStore.setState({ pages: [page1] });
    rerender(<OverviewView />);

    await waitFor(() => {
      expect(screen.getByText("Selected: 1")).toBeInTheDocument();
    });
  });

  it("clears selection when notebook changes", async () => {
    const user = userEvent.setup();
    const pages = [makePage({ pageNumber: 1 })];
    useNotebookPagesStore.setState({ pages, notebookId: "nb_first" });

    const { rerender } = render(<OverviewView />);

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Selected: 1")).toBeInTheDocument();

    useNotebookPagesStore.setState({ notebookId: "nb_second" });
    rerender(<OverviewView />);

    await waitFor(() => {
      expect(screen.getByText("Selected: 0")).toBeInTheDocument();
    });
  });
});
