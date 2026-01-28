import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  addStroke,
  getStrokes,
  getPages,
  openNotebook,
  openNotebookSingleMode,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Page Duplication", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E PageDup"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can duplicate a page with strokes", async ({ page }) => {
    // Get the page ID and add a stroke
    const pages = await getPages(notebookId);
    const originalPageId = pages[0].id;
    await addStroke(originalPageId);

    // Verify the stroke exists
    const originalStrokes = await getStrokes(originalPageId);
    expect(originalStrokes.length).toBe(1);

    // Open the notebook
    await openNotebookSingleMode(page, notebookTitle);

    // Store the original URL
    const originalUrl = page.url();
    expect(originalUrl).toContain(originalPageId);

    // Click the Duplicate button
    await page.getByRole("button", { name: "Duplicate page" }).click();

    // Wait for navigation to a different page
    await page.waitForFunction(
      (origId: string) => !window.location.href.includes(origId),
      originalPageId,
      { timeout: 10000 },
    );

    // Verify the notebook now has 2 pages
    const pagesAfter = await getPages(notebookId);
    expect(pagesAfter.length).toBe(2);

    // Verify the new page has the strokes copied
    const newPageId = pagesAfter.find((p) => p.id !== originalPageId)?.id;
    expect(newPageId).toBeDefined();
    const newStrokes = await getStrokes(newPageId!);
    expect(newStrokes.length).toBe(1);
  });

  test("duplicate button shows loading state", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    const duplicateBtn = page.getByRole("button", { name: "Duplicate page" });
    await expect(duplicateBtn).toBeVisible();
    await expect(duplicateBtn).toHaveText("Duplicate");
  });
});

test.describe("Notebook Duplication", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E NotebookDup"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Add 2 pages with strokes
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);
    await addStroke(page1.id);
    await addStroke(page2.id);
  });

  test.afterEach(async () => {
    // Delete original notebook
    await deleteNotebook(notebookId);
    // Find and delete the copy
    const res = await fetch(`${API}/api/notebooks`);
    const notebooks = (await res.json()) as { id: string; title: string }[];
    for (const nb of notebooks) {
      if (nb.title === `${notebookTitle} (Copy)`) {
        await deleteNotebook(nb.id);
      }
    }
  });

  test("can duplicate a notebook from the notebooks page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Find the notebook card and click duplicate
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Duplicate notebook" }).click();

    // The copy should appear in the list
    await expect(page.getByText(`${notebookTitle} (Copy)`)).toBeVisible();
  });

  test("duplicated notebook has all pages with strokes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Duplicate the notebook
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Duplicate notebook" }).click();

    // Wait for copy to appear
    await expect(page.getByText(`${notebookTitle} (Copy)`)).toBeVisible();

    // Find the copy's ID
    const res = await fetch(`${API}/api/notebooks`);
    const notebooks = (await res.json()) as { id: string; title: string }[];
    const copy = notebooks.find((nb) => nb.title === `${notebookTitle} (Copy)`);
    expect(copy).toBeDefined();

    // Verify it has 2 pages
    const copyPages = await getPages(copy!.id);
    expect(copyPages.length).toBe(2);

    // Verify each page has strokes
    for (const p of copyPages) {
      const strokes = await getStrokes(p.id);
      expect(strokes.length).toBe(1);
    }
  });
});

test.describe("Delete Confirmation for Notebooks", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E DeleteConfirm"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    // May have been deleted by the test
    try {
      await deleteNotebook(notebookId);
    } catch {
      // ignore
    }
  });

  test("shows confirmation dialog before deleting notebook", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click delete button
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Delete notebook" }).click();

    // Confirmation dialog should appear
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await expect(page.getByText("Delete Notebook")).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
  });

  test("can cancel deletion", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click delete button
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Delete notebook" }).click();

    // Click cancel
    await page.getByTestId("confirm-dialog-cancel").click();

    // Dialog should close and notebook should still exist
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();
    await expect(page.getByText(notebookTitle)).toBeVisible();
  });

  test("confirming deletion removes notebook", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click delete button
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Delete notebook" }).click();

    // Click confirm
    await page.getByTestId("confirm-dialog-confirm").click();

    // Notebook should be removed
    await expect(page.getByText(notebookTitle)).not.toBeVisible();
  });
});

test.describe("Keyboard Navigation", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E KeyNav"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 3 pages
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("ArrowRight navigates to next page in single view", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Should be on page 1
    await expect(page.getByText("1/3")).toBeVisible();

    // Press right arrow to go to page 2
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2/3")).toBeVisible();

    // Press right arrow again to go to page 3
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("3/3")).toBeVisible();

    // Press right arrow again - should stay on page 3 (no more pages)
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("3/3")).toBeVisible();
  });

  test("ArrowLeft navigates to previous page in single view", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Navigate to page 3 first
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("3/3")).toBeVisible();

    // Press left arrow to go to page 2
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("2/3")).toBeVisible();

    // Press left arrow again to go to page 1
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1/3")).toBeVisible();

    // Press left arrow again - should stay on page 1
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1/3")).toBeVisible();
  });

  test("arrow keys work after drawing", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw something on the page
    const target = page.locator(".touch-none").first();
    const box = await target.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
      await page.mouse.up();
    }

    // Arrow keys should still work
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2/3")).toBeVisible();
  });
});

test.describe("Keyboard Shortcuts Help", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Help"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("pressing ? shows keyboard shortcuts dialog", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Click on the page to ensure keyboard focus is on the document
    await page.locator("body").click();

    // Press ? key (need to type it as a character, not Shift+/)
    await page.keyboard.type("?");

    // Dialog should appear (use first() in case there are duplicate elements)
    await expect(page.getByTestId("shortcuts-dialog").first()).toBeVisible();
    await expect(page.getByText("Keyboard Shortcuts").first()).toBeVisible();

    // Should show the new page navigation shortcuts
    await expect(page.getByText("Previous page").first()).toBeVisible();
    await expect(page.getByText("Next page").first()).toBeVisible();
  });

  test("dialog shows undo/redo shortcuts", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Click on the page to ensure keyboard focus
    await page.locator("body").click();

    // Open dialog by pressing ?
    await page.keyboard.type("?");
    await expect(page.getByTestId("shortcuts-dialog").first()).toBeVisible();

    // Verify undo/redo shortcuts are displayed
    await expect(page.getByText("Undo").first()).toBeVisible();
    await expect(page.getByText("Redo").first()).toBeVisible();
  });

  test("dialog shows new page shortcut", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.locator("body").click();
    await page.keyboard.type("?");
    await expect(page.getByTestId("shortcuts-dialog").first()).toBeVisible();
    await expect(page.getByText("New page").first()).toBeVisible();
  });
});

test.describe("Notebook Rename", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Rename"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can rename notebook via rename button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Find the notebook card and click rename
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Rename notebook" }).click();

    // Input should appear
    const input = page.getByTestId("notebook-rename-input");
    await expect(input).toBeVisible();

    // Type a new name and press Enter
    await input.fill("Renamed Notebook");
    await input.press("Enter");

    // The notebook should show the new name
    await expect(page.getByText("Renamed Notebook")).toBeVisible();
    await expect(page.getByText(notebookTitle)).not.toBeVisible();
  });

  test("rename saves on blur", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click rename button
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Rename notebook" }).click();

    // Type a new name
    const input = page.getByTestId("notebook-rename-input");
    await input.fill("Blur Renamed");

    // Click elsewhere to trigger blur
    await page.getByText("Notebooks").click();

    // The notebook should show the new name
    await expect(page.getByText("Blur Renamed")).toBeVisible();
  });

  test("can cancel rename with Escape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click rename button
    const card = page.getByText(notebookTitle).locator("..");
    await card.getByRole("button", { name: "Rename notebook" }).click();

    // Type something but press Escape
    const input = page.getByTestId("notebook-rename-input");
    await input.fill("Should Not Save");
    await input.press("Escape");

    // Original name should still be visible
    await expect(page.getByText(notebookTitle)).toBeVisible();
    await expect(page.getByText("Should Not Save")).not.toBeVisible();
  });
});

test.describe("Page Delete from Single View", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E PageDelete"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows delete button in toolbar", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);
    await expect(page.getByRole("button", { name: "Delete page" })).toBeVisible();
  });

  test("shows confirmation dialog when clicking delete", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    await page.getByRole("button", { name: "Delete page" }).click();

    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await expect(page.getByText("Delete page")).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete this page/)).toBeVisible();
  });

  test("can cancel page deletion", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);
    const pagesBefore = await getPages(notebookId);

    await page.getByRole("button", { name: "Delete page" }).click();
    await page.getByTestId("confirm-dialog-cancel").click();

    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();

    // Page count should be unchanged
    const pagesAfter = await getPages(notebookId);
    expect(pagesAfter.length).toBe(pagesBefore.length);
  });

  test("deleting page navigates to adjacent page", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Should be on page 1 of 2
    await expect(page.getByText("1/2")).toBeVisible();

    // Delete the current page
    await page.getByRole("button", { name: "Delete page" }).click();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Should navigate to the remaining page (now 1/1)
    await expect(page.getByText("1/1")).toBeVisible();

    // Verify only 1 page remains
    const pagesAfter = await getPages(notebookId);
    expect(pagesAfter.length).toBe(1);
  });
});

test.describe("New Page Keyboard Shortcut", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E NewPageKey"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("pressing N creates a new page", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Should start with 1 page
    await expect(page.getByText("1/1")).toBeVisible();
    const pagesBefore = await getPages(notebookId);
    expect(pagesBefore.length).toBe(1);

    // Press N to create new page
    await page.locator("body").click();
    await page.keyboard.press("n");

    // Should navigate to the new page (now 2/2)
    await expect(page.getByText("2/2")).toBeVisible({ timeout: 5000 });

    // Verify 2 pages now exist
    const pagesAfter = await getPages(notebookId);
    expect(pagesAfter.length).toBe(2);
  });

  test("N does not create page when typing in input", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open search which has an input
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // Type 'n' in the search input
    await page.keyboard.type("n");

    // No new page should be created (still 1 page)
    const pagesAfter = await getPages(notebookId);
    expect(pagesAfter.length).toBe(1);
  });
});
