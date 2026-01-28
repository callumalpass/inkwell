import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Page Tags Panel", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Tags"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("open tags panel from toolbar and see empty state", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Click the Tags toolbar button
    await page.getByTestId("toolbar-tags").click();

    // Tags panel should open
    const panel = page.getByTestId("tags-panel");
    await expect(panel).toBeVisible();

    // Should show empty state
    await expect(page.getByTestId("tags-empty")).toBeVisible();
    await expect(page.getByTestId("tags-empty")).toContainText("No tags yet");

    // Tag input should be present and focused
    const input = page.getByTestId("tag-input");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("add a tag by typing and pressing Enter", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Type a tag and press Enter
    const input = page.getByTestId("tag-input");
    await input.fill("meeting");
    await input.press("Enter");

    // Tag should appear in the list
    await expect(page.getByTestId("tag-meeting")).toBeVisible();
    await expect(page.getByTestId("tag-meeting")).toContainText("meeting");

    // Input should be cleared
    await expect(input).toHaveValue("");

    // Empty state should be gone
    await expect(page.getByTestId("tags-empty")).not.toBeVisible();
  });

  test("add multiple tags", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    const input = page.getByTestId("tag-input");

    // Add three tags
    await input.fill("important");
    await input.press("Enter");
    await expect(page.getByTestId("tag-important")).toBeVisible();

    await input.fill("project-x");
    await input.press("Enter");
    await expect(page.getByTestId("tag-project-x")).toBeVisible();

    await input.fill("draft");
    await input.press("Enter");
    await expect(page.getByTestId("tag-draft")).toBeVisible();

    // All three should be visible
    const tagsList = page.getByTestId("tags-list");
    await expect(tagsList).toBeVisible();
  });

  test("remove a tag", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Add a tag first
    const input = page.getByTestId("tag-input");
    await input.fill("to-remove");
    await input.press("Enter");
    await expect(page.getByTestId("tag-to-remove")).toBeVisible();

    // Click the remove button
    await page.getByTestId("remove-tag-to-remove").click();

    // Tag should disappear
    await expect(page.getByTestId("tag-to-remove")).not.toBeVisible();

    // Empty state should return
    await expect(page.getByTestId("tags-empty")).toBeVisible();
  });

  test("tags persist after closing and reopening the panel", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open tags panel and add a tag
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    const input = page.getByTestId("tag-input");
    await input.fill("persistent");
    await input.press("Enter");
    await expect(page.getByTestId("tag-persistent")).toBeVisible();

    // Close the panel
    await page.getByTestId("tags-panel-close").click();
    await expect(page.getByTestId("tags-panel")).not.toBeVisible();

    // Reopen the panel
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Tag should still be there
    await expect(page.getByTestId("tag-persistent")).toBeVisible();
  });

  test("tags persist after page reload", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Add a tag
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    const input = page.getByTestId("tag-input");
    await input.fill("survives-reload");
    await input.press("Enter");
    await expect(page.getByTestId("tag-survives-reload")).toBeVisible();

    // Close panel before reload
    await page.getByTestId("tags-panel-close").click();

    // Reload the page
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Wait for the toolbar to load
    await expect(page.getByRole("button", { name: "pen", exact: true })).toBeVisible();

    // Reopen tags panel
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Tag should still exist
    await expect(page.getByTestId("tag-survives-reload")).toBeVisible();
  });

  test("close button closes the panel", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Click close
    await page.getByTestId("tags-panel-close").click();

    // Panel should be gone
    await expect(page.getByTestId("tags-panel")).not.toBeVisible();
  });

  test("toggling Tags button opens and closes the panel", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // First click opens
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Second click closes
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).not.toBeVisible();
  });
});
