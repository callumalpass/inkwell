import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotebookSettingsDialog } from "./NotebookSettingsDialog";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";

vi.mock("../../api/pages", () => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
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

beforeEach(() => {
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [],
    currentPageIndex: 0,
    loading: false,
    error: null,
    settings: {},
  });
  vi.clearAllMocks();
});

describe("NotebookSettingsDialog", () => {
  it("does not render when closed", () => {
    render(<NotebookSettingsDialog open={false} onClose={() => {}} />);
    expect(
      screen.queryByTestId("notebook-settings-dialog"),
    ).not.toBeInTheDocument();
  });

  it("renders when open", () => {
    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    expect(
      screen.getByTestId("notebook-settings-dialog"),
    ).toBeInTheDocument();
    expect(screen.getByText("Notebook Settings")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NotebookSettingsDialog open={true} onClose={onClose} />);

    await user.click(screen.getByTestId("notebook-settings-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows default tool buttons", () => {
    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    expect(screen.getByTestId("nb-setting-tool-pen")).toBeInTheDocument();
    expect(
      screen.getByTestId("nb-setting-tool-highlighter"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-tool-eraser")).toBeInTheDocument();
  });

  it("updates defaultTool when tool button is clicked", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-tool-highlighter"));

    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { defaultTool: "highlighter" },
    });
  });

  it("shows color buttons", () => {
    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    expect(screen.getByTestId("nb-setting-color-black")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-color-blue")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-color-red")).toBeInTheDocument();
  });

  it("updates defaultColor when color button is clicked", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-color-blue"));

    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { defaultColor: "#1e40af" },
    });
  });

  it("shows width buttons", () => {
    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    expect(screen.getByTestId("nb-setting-width-2")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-width-3")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-width-5")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-width-8")).toBeInTheDocument();
  });

  it("updates defaultStrokeWidth when width button is clicked", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-width-5"));

    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { defaultStrokeWidth: 5 },
    });
  });

  it("shows grid type buttons", () => {
    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    expect(screen.getByTestId("nb-setting-grid-none")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-grid-lined")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-grid-grid")).toBeInTheDocument();
    expect(screen.getByTestId("nb-setting-grid-dotgrid")).toBeInTheDocument();
  });

  it("updates gridType when grid button is clicked", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-grid-lined"));

    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { gridType: "lined" },
    });
  });

  it("updates backgroundLineSpacing when spacing button is clicked", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-line-spacing-56"));

    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { backgroundLineSpacing: 56 },
    });
  });

  it("highlights active settings", () => {
    useNotebookPagesStore.setState({
      notebookId: "nb_test",
      settings: {
        defaultTool: "highlighter",
        defaultColor: "#1e40af",
        defaultStrokeWidth: 5,
        gridType: "grid",
      },
    });

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);

    // Active buttons should have the active style class
    expect(screen.getByTestId("nb-setting-tool-highlighter")).toHaveClass(
      "bg-black",
    );
    expect(screen.getByTestId("nb-setting-width-5")).toHaveClass("bg-gray-100");
    expect(screen.getByTestId("nb-setting-grid-grid")).toHaveClass("bg-black");
  });

  it("merges with existing settings when updating", async () => {
    const user = userEvent.setup();
    const { updateNotebook } = await import("../../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    useNotebookPagesStore.setState({
      notebookId: "nb_test",
      settings: { defaultTool: "pen", gridType: "lined" },
    });

    render(<NotebookSettingsDialog open={true} onClose={() => {}} />);
    await user.click(screen.getByTestId("nb-setting-tool-highlighter"));

    // Should merge: existing gridType + new defaultTool
    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { defaultTool: "highlighter", gridType: "lined" },
    });
  });
});
