import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotebookCard } from "./NotebookCard";

const notebook = {
  id: "nb_test1",
  title: "Test Notebook",
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-20T15:30:00.000Z",
};

describe("NotebookCard", () => {
  it("renders the notebook title", () => {
    render(<NotebookCard notebook={notebook} onClick={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Test Notebook")).toBeInTheDocument();
  });

  it("renders the formatted date", () => {
    render(<NotebookCard notebook={notebook} onClick={() => {}} onDelete={() => {}} />);
    // The component renders updatedAt as toLocaleDateString()
    const dateStr = new Date(notebook.updatedAt).toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={() => {}} />);

    await user.click(screen.getByText("Test Notebook"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClick = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDelete = vi.fn();
    render(<NotebookCard notebook={notebook} onClick={onClick} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
