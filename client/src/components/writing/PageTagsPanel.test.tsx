import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageTagsPanel } from "./PageTagsPanel";
import { useTagsPanelStore } from "../../stores/tags-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import type { PageMeta } from "../../api/pages";

vi.mock("../../api/pages", () => ({
  updatePage: vi.fn(),
}));

vi.mock("../../api/notebooks", () => ({
  getNotebook: vi.fn().mockResolvedValue({
    id: "nb_test",
    title: "Test Notebook",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateNotebook: vi.fn().mockResolvedValue({}),
}));

const makePage = (
  id: string,
  pageNumber: number,
  opts?: { links?: string[]; tags?: string[] },
): PageMeta => ({
  id,
  notebookId: "nb_test",
  pageNumber,
  canvasX: 0,
  canvasY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  links: opts?.links,
  tags: opts?.tags,
});

const threePages = [
  makePage("pg_1", 1, { tags: ["meeting", "project-x"] }),
  makePage("pg_2", 2),
  makePage("pg_3", 3, { tags: ["meeting", "important"] }),
];

beforeEach(() => {
  useTagsPanelStore.setState({
    panelOpen: false,
    panelPageId: null,
  });
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: threePages,
    currentPageIndex: 0,
    loading: false,
    error: null,
    settings: {},
  });
  vi.clearAllMocks();
});

describe("PageTagsPanel", () => {
  it("does not render when panel is closed", () => {
    render(<PageTagsPanel />);
    expect(screen.queryByTestId("tags-panel")).not.toBeInTheDocument();
  });

  it("renders when panel is open", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);
    expect(screen.getByTestId("tags-panel")).toBeInTheDocument();
    expect(screen.getByText("Page Tags")).toBeInTheDocument();
  });

  it("does not render when panelPageId is null", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: null });
    render(<PageTagsPanel />);
    expect(screen.queryByTestId("tags-panel")).not.toBeInTheDocument();
  });

  it("displays current tags with count", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);
    expect(screen.getByText("Tags (2)")).toBeInTheDocument();
    expect(screen.getByTestId("tag-meeting")).toBeInTheDocument();
    expect(screen.getByTestId("tag-project-x")).toBeInTheDocument();
  });

  it("shows tag labels", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);
    expect(screen.getByText("meeting")).toBeInTheDocument();
    expect(screen.getByText("project-x")).toBeInTheDocument();
  });

  it("shows empty state when no tags exist", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageTagsPanel />);
    expect(screen.getByText("Tags (0)")).toBeInTheDocument();
    expect(screen.getByTestId("tags-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/No tags yet/),
    ).toBeInTheDocument();
  });

  it("closes panel when close button is clicked", async () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);
    await userEvent.click(screen.getByTestId("tags-panel-close"));
    expect(useTagsPanelStore.getState().panelOpen).toBe(false);
    expect(useTagsPanelStore.getState().panelPageId).toBeNull();
  });

  it("has a text input for adding tags", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a tag and press Enter")).toBeInTheDocument();
  });

  it("adds a tag when Enter is pressed", async () => {
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockResolvedValue({
      ...threePages[0],
      tags: ["meeting", "project-x", "new-tag"],
    });

    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "new-tag{enter}");

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["meeting", "project-x", "new-tag"],
    });
  });

  it("clears input after adding a tag", async () => {
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockResolvedValue({
      ...threePages[0],
      tags: ["meeting", "project-x", "new-tag"],
    });

    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input") as HTMLInputElement;
    await userEvent.type(input, "new-tag{enter}");

    expect(input.value).toBe("");
  });

  it("removes a tag when remove button is clicked", async () => {
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockResolvedValue({
      ...threePages[0],
      tags: ["project-x"],
    });

    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    await userEvent.click(screen.getByTestId("remove-tag-meeting"));

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["project-x"],
    });
  });

  it("shows autocomplete suggestions from other pages", async () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "imp");

    expect(screen.getByTestId("tag-suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("tag-suggestion-important")).toBeInTheDocument();
  });

  it("excludes already-applied tags from suggestions", async () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "meet");

    // "meeting" is already on pg_1 so should not appear as a suggestion
    expect(screen.queryByTestId("tag-suggestion-meeting")).not.toBeInTheDocument();
  });

  it("adds tag from suggestion click", async () => {
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockResolvedValue({
      ...threePages[1],
      tags: ["important"],
    });

    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "imp");
    await userEvent.click(screen.getByTestId("tag-suggestion-important"));

    expect(updatePage).toHaveBeenCalledWith("pg_2", {
      tags: ["important"],
    });
  });

  it("does not add duplicate tags", async () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "meeting{enter}");

    // updatePage should not be called since "meeting" already exists
    const { updatePage } = await import("../../api/pages");
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("does not add empty tags", async () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageTagsPanel />);

    const input = screen.getByTestId("tag-input");
    await userEvent.type(input, "   {enter}");

    const { updatePage } = await import("../../api/pages");
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("does not show suggestions when input is empty", () => {
    useTagsPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageTagsPanel />);
    expect(screen.queryByTestId("tag-suggestions")).not.toBeInTheDocument();
  });
});
