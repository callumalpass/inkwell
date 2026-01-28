import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotebookCard } from "./NotebookCard";

const notebook = {
  id: "nb_test1",
  title: "Test Notebook",
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-20T15:30:00.000Z",
};

const noop = () => {};

describe("NotebookCard", () => {
  it("renders the notebook title", () => {
    render(<NotebookCard notebook={notebook} onClick={noop} onDelete={noop} onExport={noop} />);
    expect(screen.getByText("Test Notebook")).toBeInTheDocument();
  });

  it("renders the page count and formatted date", () => {
    render(<NotebookCard notebook={notebook} onClick={noop} onDelete={noop} onExport={noop} />);
    const dateStr = new Date(notebook.updatedAt).toLocaleDateString();
    // Text is split across nodes, so use a function matcher
    expect(
      screen.getByText((content, element) => {
        return element?.tagName === "P" && !!element.textContent?.includes(dateStr);
      }),
    ).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={noop} onExport={noop} />);

    await user.click(screen.getByText("Test Notebook"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClick = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={onDelete} onExport={noop} />);

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDelete = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={onDelete} onExport={noop} />);

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onExport when the export button is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onClick = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={noop} onExport={onExport} />);

    await user.click(screen.getByRole("button", { name: /export notebook/i }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when export button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onExport = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={noop} onExport={onExport} />);

    await user.click(screen.getByRole("button", { name: /export notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
