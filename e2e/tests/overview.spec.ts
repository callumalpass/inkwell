import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Overview View", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test.describe("View switching", () => {
    test("can switch to overview view", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();
      await expect(page.getByText("Overview (read-only)")).toBeVisible();
    });

    test("shows page thumbnails in overview", async ({ page }) => {
      await addPage(notebookId);
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Should show two page thumbnails
      const thumbnails = page.locator('img[alt^="Page"]');
      await expect(thumbnails).toHaveCount(2);
    });
  });

  test.describe("Page selection", () => {
    test("can select a single page", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Click the checkbox for the first page
      const checkbox = page.locator('input[type="checkbox"]').first();
      await checkbox.click();

      // Selection count should update
      await expect(page.getByText("Selected: 1")).toBeVisible();
    });

    test("can select multiple pages", async ({ page }) => {
      await addPage(notebookId);
      await addPage(notebookId);
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Select all three pages
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await checkboxes.nth(2).click();

      await expect(page.getByText("Selected: 3")).toBeVisible();
    });

    test("Select All button selects all pages", async ({ page }) => {
      await addPage(notebookId);
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      await page.getByRole("button", { name: "Select All" }).click();
      await expect(page.getByText("Selected: 2")).toBeVisible();
    });

    test("Clear button deselects all pages", async ({ page }) => {
      await addPage(notebookId);
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Select all first
      await page.getByRole("button", { name: "Select All" }).click();
      await expect(page.getByText("Selected: 2")).toBeVisible();

      // Clear selection
      await page.getByRole("button", { name: "Clear" }).click();
      await expect(page.getByText("Selected: 0")).toBeVisible();
    });

    test("can toggle page selection", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const checkbox = page.locator('input[type="checkbox"]').first();

      // Select
      await checkbox.click();
      await expect(page.getByText("Selected: 1")).toBeVisible();

      // Deselect
      await checkbox.click();
      await expect(page.getByText("Selected: 0")).toBeVisible();
    });
  });

  test.describe("Page navigation", () => {
    test("clicking a page thumbnail opens it in single view", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Click the page thumbnail button
      await page.getByRole("button", { name: /Open page 1/i }).click();

      // Should switch to single view - overview should not be visible
      await expect(page.getByTestId("overview-view")).not.toBeVisible();
      // The single page drawing layer should be visible
      await expect(page.locator(".touch-none").first()).toBeVisible();
    });
  });

  test.describe("Bulk operations - disabled when no selection", () => {
    test("Add Tags button is disabled when no pages selected", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const addTagsButton = page.getByRole("button", { name: "Add Tags" });
      await expect(addTagsButton).toBeDisabled();
    });

    test("Remove Tags button is disabled when no pages selected", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const removeTagsButton = page.getByRole("button", { name: "Remove Tags" });
      await expect(removeTagsButton).toBeDisabled();
    });

    test("Export button is disabled when no pages selected", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const exportButton = page.getByRole("button", { name: "Export" });
      await expect(exportButton).toBeDisabled();
    });

    test("Move button is disabled when no pages selected", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const moveButton = page.getByRole("button", { name: "Move" });
      await expect(moveButton).toBeDisabled();
    });

    test("Delete button is disabled when no pages selected", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      const deleteButton = page.getByRole("button", { name: "Delete" });
      await expect(deleteButton).toBeDisabled();
    });
  });

  test.describe("Bulk tagging", () => {
    test("can add tags to selected pages", async ({ page }) => {
      await addPage(notebookId);
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Select all pages
      await page.getByRole("button", { name: "Select All" }).click();

      // Click Add Tags
      await page.getByRole("button", { name: "Add Tags" }).click();

      // Dialog should appear
      await expect(page.getByText("Add Tags", { exact: false })).toBeVisible();

      // Enter tags
      const tagInput = page.locator('input[placeholder="meeting, project-x"]');
      await tagInput.fill("test-tag, bulk-added");
      await page.getByRole("button", { name: "Apply" }).click();

      // Tags should appear on the page cards
      await expect(page.getByText("test-tag")).toBeVisible();
      await expect(page.getByText("bulk-added")).toBeVisible();
    });

    test("can remove tags from selected pages", async ({ page }) => {
      // First add tags via API
      const pg = await addPage(notebookId);
      await fetch(`${API}/api/pages/${pg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["to-remove", "keep-this"] }),
      });

      await openNotebook(page, notebookTitle);
      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Verify tags are shown
      await expect(page.getByText("to-remove")).toBeVisible();
      await expect(page.getByText("keep-this")).toBeVisible();

      // Select the page
      await page.locator('input[type="checkbox"]').first().click();

      // Click Remove Tags
      await page.getByRole("button", { name: "Remove Tags" }).click();

      // Dialog should appear
      await expect(page.getByText("Remove Tags")).toBeVisible();

      // Enter tag to remove
      const tagInput = page.locator('input[placeholder="meeting, project-x"]');
      await tagInput.fill("to-remove");
      await page.getByRole("button", { name: "Apply" }).click();

      // Only "keep-this" should remain visible
      await expect(page.getByText("to-remove")).not.toBeVisible();
      await expect(page.getByText("keep-this")).toBeVisible();
    });

    test("tag dialog can be cancelled", async ({ page }) => {
      await addPage(notebookId);
      await openNotebook(page, notebookTitle);

      await page.getByRole("button", { name: "Overview" }).click();
      await expect(page.getByTestId("overview-view")).toBeVisible();

      // Select page
      await page.locator('input[type="checkbox"]').first().click();

      // Open tag dialog
      await page.getByRole("button", { name: "Add Tags" }).click();
      await expect(page.getByText("Add Tags", { exact: false })).toBeVisible();

      // Cancel
      await page.getByRole("button", { name: "Cancel" }).click();

      // Dialog should close
      await expect(page.locator('input[placeholder="meeting, project-x"]')).not.toBeVisible();
    });
  });
});

test.describe("Overview View - Move pages", () => {
  let sourceNotebookId: string;
  let sourceNotebookTitle: string;
  let targetNotebookId: string;
  let targetNotebookTitle: string;

  test.beforeEach(async () => {
    const srcNb = await createNotebook(uniqueTitle("E2E Overview Source"));
    sourceNotebookId = srcNb.id;
    sourceNotebookTitle = srcNb.title;

    const tgtNb = await createNotebook(uniqueTitle("E2E Overview Target"));
    targetNotebookId = tgtNb.id;
    targetNotebookTitle = tgtNb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(sourceNotebookId);
    await deleteNotebook(targetNotebookId);
  });

  test("can open move dialog with selected pages", async ({ page }) => {
    await addPage(sourceNotebookId);
    await openNotebook(page, sourceNotebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Move button
    await page.getByRole("button", { name: "Move" }).click();

    // Dialog should open
    await expect(page.getByText("Move pages")).toBeVisible();
    await expect(page.getByText("Target notebook")).toBeVisible();
  });

  test("move dialog shows other notebooks as options", async ({ page }) => {
    await addPage(sourceNotebookId);
    await openNotebook(page, sourceNotebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Move button
    await page.getByRole("button", { name: "Move" }).click();

    // Target notebook dropdown should have the target notebook
    const select = page.locator("select");
    await select.click();
    await expect(page.locator(`option:has-text("${targetNotebookTitle}")`)).toBeVisible();
  });

  test("can move page to another notebook", async ({ page }) => {
    await addPage(sourceNotebookId);
    await openNotebook(page, sourceNotebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have one page
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Move button
    await page.getByRole("button", { name: "Move" }).click();

    // Select target notebook
    const select = page.locator("select");
    await select.selectOption({ label: targetNotebookTitle });

    // Click Move button in dialog
    await page.getByRole("button", { name: "Move", exact: true }).last().click();

    // Page should be removed from source notebook
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(0);

    // Navigate to target notebook and verify page exists
    await page.goto("/");
    await page.getByText(targetNotebookTitle).first().click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await expect(page.getByRole("button", { name: "pen", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });

  test("move button in dialog is disabled without selection", async ({ page }) => {
    await addPage(sourceNotebookId);
    await openNotebook(page, sourceNotebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Move button
    await page.getByRole("button", { name: "Move" }).click();

    // Move button in dialog should be disabled (no notebook selected)
    const moveDialogButton = page.locator(".fixed").getByRole("button", { name: "Move" });
    await expect(moveDialogButton).toBeDisabled();
  });

  test("move dialog can be cancelled", async ({ page }) => {
    await addPage(sourceNotebookId);
    await openNotebook(page, sourceNotebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Move button
    await page.getByRole("button", { name: "Move" }).click();
    await expect(page.getByText("Move pages")).toBeVisible();

    // Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close
    await expect(page.getByText("Move pages")).not.toBeVisible();

    // Page should still be there
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });
});

test.describe("Overview View - Page deletion", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview Delete"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can delete a single page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have two pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(2);

    // Select one page
    await page.locator('input[type="checkbox"]').first().click();

    // Set up dialog handler
    page.on("dialog", (dialog) => dialog.accept());

    // Click Delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Should only have one page now
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });

  test("can delete multiple pages", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have three pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(3);

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();

    // Set up dialog handler
    page.on("dialog", (dialog) => dialog.accept());

    // Click Delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Should have no pages now
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(0);
  });

  test("delete can be cancelled", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Set up dialog handler to cancel
    page.on("dialog", (dialog) => dialog.dismiss());

    // Click Delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Page should still exist
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });

  test("selection is cleared after deletion", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select first page
    await page.locator('input[type="checkbox"]').first().click();
    await expect(page.getByText("Selected: 1")).toBeVisible();

    // Set up dialog handler
    page.on("dialog", (dialog) => dialog.accept());

    // Delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Selection should be cleared
    await expect(page.getByText("Selected: 0")).toBeVisible();
  });
});

test.describe("Overview View - Page tags display", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview Tags"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("displays page tags on cards", async ({ page }) => {
    const pg = await addPage(notebookId);
    await fetch(`${API}/api/pages/${pg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["tag1", "tag2"] }),
    });

    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    await expect(page.getByText("tag1")).toBeVisible();
    await expect(page.getByText("tag2")).toBeVisible();
  });

  test("shows +N for more than 3 tags", async ({ page }) => {
    const pg = await addPage(notebookId);
    await fetch(`${API}/api/pages/${pg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["tag1", "tag2", "tag3", "tag4", "tag5"] }),
    });

    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Should show first 3 tags and +2
    await expect(page.getByText("tag1")).toBeVisible();
    await expect(page.getByText("tag2")).toBeVisible();
    await expect(page.getByText("tag3")).toBeVisible();
    await expect(page.getByText("+2")).toBeVisible();
  });
});

test.describe("Overview View - Export dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview Export"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can open export dialog", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByRole("button", { name: "Export" }).click();

    // Dialog should appear
    await expect(page.getByText("Export 1 pages")).toBeVisible();
    await expect(page.getByText("Format")).toBeVisible();
  });

  test("export dialog shows PDF options", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByRole("button", { name: "Export" }).click();

    // Should show PDF/PNG format buttons
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "PNG" })).toBeVisible();

    // PDF is default, should show page size options
    await expect(page.getByText("Page Size")).toBeVisible();
    await expect(page.getByRole("button", { name: "Original" })).toBeVisible();
    await expect(page.getByRole("button", { name: "A4" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Letter" })).toBeVisible();
  });

  test("export dialog shows PNG options when PNG is selected", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByRole("button", { name: "Export" }).click();

    // Click PNG
    await page.getByRole("button", { name: "PNG" }).click();

    // Should show scale options instead of page size
    await expect(page.getByText("Scale")).toBeVisible();
    await expect(page.getByRole("button", { name: "1×" })).toBeVisible();
    await expect(page.getByRole("button", { name: "2×" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3×" })).toBeVisible();
    await expect(page.getByRole("button", { name: "4×" })).toBeVisible();
  });

  test("export dialog can be cancelled", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Export 1 pages")).toBeVisible();

    // Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close
    await expect(page.getByText("Export 1 pages")).not.toBeVisible();
  });

  test("export dialog updates count based on selection", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();

    // Click Export
    await page.getByRole("button", { name: "Export" }).click();

    // Should show 3 pages
    await expect(page.getByText("Export 3 pages")).toBeVisible();
  });
});
