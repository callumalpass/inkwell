import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageLinksPanel } from "./PageLinksPanel";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import type { PageMeta } from "../../api/pages";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ notebookId: "nb_test" }),
}));

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
  makePage("pg_1", 1, { links: ["pg_2"], tags: ["meeting", "project-x"] }),
  makePage("pg_2", 2),
  makePage("pg_3", 3, { links: ["pg_1"] }),
];

beforeEach(() => {
  useLinksPanelStore.setState({
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
  mockNavigate.mockClear();
});

describe("PageLinksPanel", () => {
  it("does not render when panel is closed", () => {
    render(<PageLinksPanel />);
    expect(screen.queryByTestId("links-panel")).not.toBeInTheDocument();
  });

  it("renders when panel is open", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByTestId("links-panel")).toBeInTheDocument();
  });

  it("does not render when panelPageId is null", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: null });
    render(<PageLinksPanel />);
    expect(screen.queryByTestId("links-panel")).not.toBeInTheDocument();
  });

  it("displays outgoing links with count", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Links (1)")).toBeInTheDocument();
    expect(screen.getByTestId("links-list")).toBeInTheDocument();
  });

  it("displays linked page labels", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByTestId("link-navigate-pg_2")).toHaveTextContent(
      "Page 2",
    );
  });

  it("displays backlinks section with count", () => {
    // pg_3 links to pg_1, so pg_1 should show pg_3 as a backlink
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Backlinks (1)")).toBeInTheDocument();
    expect(screen.getByTestId("backlinks-list")).toBeInTheDocument();
    expect(screen.getByTestId("backlink-navigate-pg_3")).toHaveTextContent(
      "Page 3",
    );
  });

  it("shows empty state when no links exist", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Links (0)")).toBeInTheDocument();
    expect(
      screen.getByText(/No links yet/),
    ).toBeInTheDocument();
  });

  it("shows empty state when no backlinks exist", () => {
    // pg_3 links to pg_1 but nobody links to pg_3, so pg_3 has 0 backlinks
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_3" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Backlinks (0)")).toBeInTheDocument();
    expect(
      screen.getByText(/No other pages link to this page/),
    ).toBeInTheDocument();
  });

  it("closes panel when close button is clicked", async () => {
    const user = userEvent.setup();
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("links-panel-close"));
    expect(useLinksPanelStore.getState().panelOpen).toBe(false);
  });

  it("opens add link menu when Add button is clicked", async () => {
    const user = userEvent.setup();
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("add-link-button"));
    expect(screen.getByTestId("add-link-menu")).toBeInTheDocument();
  });

  it("shows only available pages in add menu (excludes self and already linked)", async () => {
    const user = userEvent.setup();
    // pg_1 has link to pg_2, so only pg_3 should be available
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("add-link-button"));
    expect(screen.getByTestId("add-link-option-pg_3")).toBeInTheDocument();
    expect(
      screen.queryByTestId("add-link-option-pg_1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("add-link-option-pg_2"),
    ).not.toBeInTheDocument();
  });

  it("disables Add button when no pages available to link", () => {
    // pg_1 links to pg_2, pg_3 links to pg_1
    // If we give pg_1 links to both pg_2 and pg_3, no pages are available
    const pagesAllLinked = [
      makePage("pg_1", 1, { links: ["pg_2", "pg_3"] }),
      makePage("pg_2", 2),
      makePage("pg_3", 3),
    ];
    useNotebookPagesStore.setState({ pages: pagesAllLinked });
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    expect(screen.getByTestId("add-link-button")).toBeDisabled();
  });

  it("adds a link when a page option is clicked", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, { links: ["pg_2", "pg_3"] });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("add-link-button"));
    await user.click(screen.getByTestId("add-link-option-pg_3"));

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      links: ["pg_2", "pg_3"],
    });
  });

  it("removes a link when remove button is clicked", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, { links: [] });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("remove-link-pg_2"));

    expect(updatePage).toHaveBeenCalledWith("pg_1", { links: [] });
  });

  it("navigates to linked page when clicked", async () => {
    const user = userEvent.setup();
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("link-navigate-pg_2"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/notebook/nb_test/page/pg_2",
      { replace: true },
    );
  });

  it("navigates to backlinked page when clicked", async () => {
    const user = userEvent.setup();
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("backlink-navigate-pg_3"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/notebook/nb_test/page/pg_3",
      { replace: true },
    );
  });

  it("updates current page index when navigating", async () => {
    const user = userEvent.setup();
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("link-navigate-pg_2"));

    // pg_2 is at index 1
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(1);
  });

  it("closes add menu after selecting a page", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, { links: ["pg_2", "pg_3"] });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("add-link-button"));
    expect(screen.getByTestId("add-link-menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("add-link-option-pg_3"));
    expect(screen.queryByTestId("add-link-menu")).not.toBeInTheDocument();
  });
});

describe("PageLinksPanel - Tags", () => {
  it("displays tags section with count", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Tags (2)")).toBeInTheDocument();
    expect(screen.getByTestId("tags-list")).toBeInTheDocument();
  });

  it("renders tag chips for each tag", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByTestId("tag-meeting")).toHaveTextContent("meeting");
    expect(screen.getByTestId("tag-project-x")).toHaveTextContent("project-x");
  });

  it("shows zero count when no tags exist", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_2" });
    render(<PageLinksPanel />);
    expect(screen.getByText("Tags (0)")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-list")).not.toBeInTheDocument();
  });

  it("has a tag input field", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add tag...")).toBeInTheDocument();
  });

  it("adds a tag when Add button is clicked", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, {
      links: ["pg_2"],
      tags: ["meeting", "project-x", "important"],
    });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.type(screen.getByTestId("tag-input"), "important");
    await user.click(screen.getByTestId("add-tag-button"));

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["meeting", "project-x", "important"],
    });
  });

  it("adds a tag when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, {
      links: ["pg_2"],
      tags: ["meeting", "project-x", "urgent"],
    });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.type(screen.getByTestId("tag-input"), "urgent{Enter}");

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["meeting", "project-x", "urgent"],
    });
  });

  it("clears tag input after adding", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, {
      links: ["pg_2"],
      tags: ["meeting", "project-x", "newtag"],
    });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    const input = screen.getByTestId("tag-input");
    await user.type(input, "newtag{Enter}");

    expect(input).toHaveValue("");
  });

  it("normalizes tags to lowercase", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, {
      links: ["pg_2"],
      tags: ["meeting", "project-x", "important"],
    });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.type(screen.getByTestId("tag-input"), "IMPORTANT{Enter}");

    // Should be lowercased
    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["meeting", "project-x", "important"],
    });
  });

  it("does not add duplicate tags", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockClear();

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.type(screen.getByTestId("tag-input"), "meeting{Enter}");

    // Should not call updatePage because "meeting" already exists
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("does not add empty tags", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    vi.mocked(updatePage).mockClear();

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.type(screen.getByTestId("tag-input"), "   {Enter}");

    expect(updatePage).not.toHaveBeenCalled();
  });

  it("disables Add button when input is empty", () => {
    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);
    expect(screen.getByTestId("add-tag-button")).toBeDisabled();
  });

  it("removes a tag when remove button is clicked", async () => {
    const user = userEvent.setup();
    const { updatePage } = await import("../../api/pages");
    const updatedPage = makePage("pg_1", 1, {
      links: ["pg_2"],
      tags: ["project-x"],
    });
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useLinksPanelStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<PageLinksPanel />);

    await user.click(screen.getByTestId("remove-tag-meeting"));

    expect(updatePage).toHaveBeenCalledWith("pg_1", {
      tags: ["project-x"],
    });
  });
});
