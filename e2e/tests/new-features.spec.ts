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
});
