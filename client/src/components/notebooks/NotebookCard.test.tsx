import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { NotebookCard } from "./NotebookCard";

const notebook = {
  id: "nb_test1",
  title: "Test Notebook",
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-20T15:30:00.000Z",
};

const noop = () => {};

function renderCard(overrides: Partial<ComponentProps<typeof NotebookCard>> = {}) {
  const props: ComponentProps<typeof NotebookCard> = {
    notebook,
    onClick: noop,
    onDelete: noop,
    onDuplicate: noop,
    onRename: noop,
    onUpdateTags: noop,
    onExport: noop,
    ...overrides,
  };
  return render(<NotebookCard {...props} />);
}

describe("NotebookCard", () => {
  it("renders the notebook title", () => {
    renderCard();
    expect(screen.getByText("Test Notebook")).toBeInTheDocument();
  });

  it("renders the page count and formatted date", () => {
    renderCard();
    const dateStr = new Date(notebook.updatedAt).toLocaleDateString();
    expect(
      screen.getByText((content, element) => {
        return element?.tagName === "P" && !!element.textContent?.includes(dateStr);
      }),
    ).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard({ onClick });

    await user.click(screen.getByText("Test Notebook"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClick = vi.fn();
    renderCard({ onClick, onDelete });

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDelete = vi.fn();
    renderCard({ onClick, onDelete });

    await user.click(screen.getByRole("button", { name: /delete notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onExport when the export button is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onClick = vi.fn();
    renderCard({ onClick, onExport });

    await user.click(screen.getByRole("button", { name: /export notebook/i }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when export button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onExport = vi.fn();
    renderCard({ onClick, onExport });

    await user.click(screen.getByRole("button", { name: /export notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onDuplicate when the duplicate button is clicked", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onClick = vi.fn();
    renderCard({ onClick, onDuplicate });

    await user.click(screen.getByRole("button", { name: /duplicate notebook/i }));
    expect(onDuplicate).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick when duplicate button is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDuplicate = vi.fn();
    renderCard({ onClick, onDuplicate });

    await user.click(screen.getByRole("button", { name: /duplicate notebook/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("enters edit mode when rename button is clicked", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /rename notebook/i }));
    expect(screen.getByTestId("notebook-rename-input")).toBeInTheDocument();
  });

  it("enters edit mode when title is double-clicked", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.dblClick(screen.getByText("Test Notebook"));
    expect(screen.getByTestId("notebook-rename-input")).toBeInTheDocument();
  });

  it("calls onRename when Enter is pressed with new title", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderCard({ onRename });

    await user.click(screen.getByRole("button", { name: /rename notebook/i }));
    const input = screen.getByTestId("notebook-rename-input");
    await user.clear(input);
    await user.type(input, "New Title{Enter}");

    expect(onRename).toHaveBeenCalledWith("New Title");
  });

  it("cancels rename when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderCard({ onRename });

    await user.click(screen.getByRole("button", { name: /rename notebook/i }));
    const input = screen.getByTestId("notebook-rename-input");
    await user.clear(input);
    await user.type(input, "New Title{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId("notebook-rename-input")).not.toBeInTheDocument();
  });

  it("does not call onRename if title is unchanged", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderCard({ onRename });

    await user.click(screen.getByRole("button", { name: /rename notebook/i }));
    const input = screen.getByTestId("notebook-rename-input");
    await user.type(input, "{Enter}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("renders notebook tags when present", () => {
    renderCard({ notebook: { ...notebook, tags: ["work", "planning"] } });
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("planning")).toBeInTheDocument();
  });

  it("updates tags from the tag editor", async () => {
    const user = userEvent.setup();
    const onUpdateTags = vi.fn();
    renderCard({ onUpdateTags, notebook: { ...notebook, tags: ["old"] } });

    await user.click(screen.getByRole("button", { name: /edit notebook tags/i }));
    const input = screen.getByTestId("notebook-tags-input");
    await user.clear(input);
    await user.type(input, "work, project-x{Enter}");

    expect(onUpdateTags).toHaveBeenCalledWith(["work", "project-x"]);
  });

  it("adds an existing tag suggestion to the tag editor", async () => {
    const user = userEvent.setup();
    const onUpdateTags = vi.fn();
    renderCard({
      onUpdateTags,
      notebook: { ...notebook, tags: ["old"] },
      availableTags: ["old", "scratch", "project-x"],
    });

    await user.click(screen.getByRole("button", { name: /edit notebook tags/i }));
    await user.click(screen.getByTestId("notebook-tag-suggestion-scratch"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateTags).toHaveBeenCalledWith(["old", "scratch"]);
  });
});
