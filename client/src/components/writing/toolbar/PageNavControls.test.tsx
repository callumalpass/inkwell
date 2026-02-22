import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageNavControls } from "./PageNavControls";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { useViewStore } from "../../../stores/view-store";
import type { PageMeta } from "../../../api/pages";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ notebookId: "nb_test" }),
}));

const makePage = (id: string, pageNumber: number): PageMeta => ({
  id,
  notebookId: "nb_test",
  pageNumber,
  canvasX: 0,
  canvasY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [makePage("pg_1", 1)],
    currentPageIndex: 0,
    loading: false,
    error: null,
    settings: {},
  });
  useViewStore.setState({ viewMode: "single" });
  mockNavigate.mockReset();
});

describe("PageNavControls", () => {
  it("renders floating add-page menu above content", async () => {
    const user = userEvent.setup();
    render(<PageNavControls showNavigation={false} />);

    await user.click(screen.getByRole("button", { name: /add new page/i }));
    const menu = await screen.findByTestId("add-page-menu");

    expect(menu).toHaveClass("fixed");
    expect(menu).toHaveClass("z-50");
    expect(screen.getByTestId("add-page-below")).toBeInTheDocument();
    expect(screen.getByTestId("add-page-right")).toBeInTheDocument();
  });
});
