import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateNotebookDialog } from "./CreateNotebookDialog";

describe("CreateNotebookDialog", () => {
  it("adds an existing tag suggestion when clicked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <CreateNotebookDialog
        open={true}
        onClose={() => {}}
        onCreate={onCreate}
        availableTags={["scratch", "work"]}
      />,
    );

    await user.type(screen.getByPlaceholderText("Notebook title"), "Quick notes");
    await user.click(screen.getByTestId("create-tag-suggestion-scratch"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith("Quick notes", ["scratch"]);
  });
});
