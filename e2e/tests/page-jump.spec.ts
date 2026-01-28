import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Page Jump Dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E PageJump"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 5 pages
    for (let i = 0; i < 5; i++) {
      await addPage(notebookId);
    }
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can open page jump dialog by clicking page number", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Click the page number display (e.g., "1/5")
    await page.getByTestId("page-jump-button").click();

    // Dialog should appear
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();
    await expect(page.getByTestId("page-jump-input")).toBeVisible();
  });

  test("can open page jump dialog with G key", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Press G key
    await page.keyboard.press("g");

    // Dialog should appear
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();
  });

  test("can jump to a specific page", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open jump dialog
    await page.getByTestId("page-jump-button").click();
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();

    // Enter page number 3
    await page.getByTestId("page-jump-input").fill("3");
    await page.getByTestId("page-jump-go").click();

    // Dialog should close
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();

    // Page indicator should show "3/5"
    await expect(page.getByTestId("page-jump-button")).toContainText("3/5");
  });

  test("can jump to page using Enter key", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open jump dialog
    await page.keyboard.press("g");
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();

    // Enter page number 4 and press Enter
    await page.getByTestId("page-jump-input").fill("4");
    await page.getByTestId("page-jump-input").press("Enter");

    // Dialog should close and page should change
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();
    await expect(page.getByTestId("page-jump-button")).toContainText("4/5");
  });

  test("can close dialog with Escape key", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open jump dialog
    await page.keyboard.press("g");
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Dialog should close without changing page
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();
    await expect(page.getByTestId("page-jump-button")).toContainText("1/5");
  });

  test("can close dialog by clicking outside", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open jump dialog
    await page.getByTestId("page-jump-button").click();
    await expect(page.getByTestId("page-jump-dialog")).toBeVisible();

    // Click on the overlay (outside the dialog)
    await page.getByTestId("page-jump-dialog").click({ position: { x: 10, y: 10 } });

    // Dialog should close
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();
  });

  test("input is pre-filled with current page number", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Navigate to page 3 first
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByTestId("page-jump-button")).toContainText("3/5");

    // Open jump dialog
    await page.keyboard.press("g");

    // Input should be pre-filled with "3"
    await expect(page.getByTestId("page-jump-input")).toHaveValue("3");
  });

  test("handles invalid page numbers gracefully", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open jump dialog
    await page.keyboard.press("g");

    // Enter invalid page number (too high)
    await page.getByTestId("page-jump-input").fill("99");
    await page.getByTestId("page-jump-go").click();

    // Dialog should close and page should not change
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();
    await expect(page.getByTestId("page-jump-button")).toContainText("1/5");
  });

  test("G key does not open dialog in canvas or overview mode", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to canvas mode
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.getByTestId("canvas-view")).toBeVisible();

    // Press G key
    await page.keyboard.press("g");

    // Dialog should not appear
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();

    // Switch to overview mode
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Press G key
    await page.keyboard.press("g");

    // Dialog should still not appear
    await expect(page.getByTestId("page-jump-dialog")).not.toBeVisible();
  });
});

test.describe("Tool Keyboard Shortcuts", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E ToolShortcuts"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("P key switches to pen tool", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // First switch to eraser
    await page.getByRole("button", { name: "eraser", exact: true }).click();

    // Verify eraser is active
    const eraserBtn = page.getByRole("button", { name: "eraser", exact: true });
    await expect(eraserBtn).toHaveClass(/bg-black/);

    // Press P key
    await page.keyboard.press("p");

    // Pen should now be active
    const penBtn = page.getByRole("button", { name: "pen", exact: true });
    await expect(penBtn).toHaveClass(/bg-black/);
  });

  test("E key switches to eraser tool", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Pen should be active by default
    const penBtn = page.getByRole("button", { name: "pen", exact: true });
    await expect(penBtn).toHaveClass(/bg-black/);

    // Press E key
    await page.keyboard.press("e");

    // Eraser should now be active
    const eraserBtn = page.getByRole("button", { name: "eraser", exact: true });
    await expect(eraserBtn).toHaveClass(/bg-black/);
  });

  test("tool shortcuts work in all view modes", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Test in single page mode
    await page.getByRole("button", { name: "Single" }).click();
    await page.keyboard.press("e");
    await expect(page.getByRole("button", { name: "eraser", exact: true })).toHaveClass(/bg-black/);
    await page.keyboard.press("p");
    await expect(page.getByRole("button", { name: "pen", exact: true })).toHaveClass(/bg-black/);

    // Test in canvas mode
    await page.getByRole("button", { name: "Canvas" }).click();
    await page.keyboard.press("e");
    await expect(page.getByRole("button", { name: "eraser", exact: true })).toHaveClass(/bg-black/);
    await page.keyboard.press("p");
    await expect(page.getByRole("button", { name: "pen", exact: true })).toHaveClass(/bg-black/);

    // Test in overview mode
    await page.getByRole("button", { name: "Overview" }).click();
    await page.keyboard.press("e");
    await expect(page.getByRole("button", { name: "eraser", exact: true })).toHaveClass(/bg-black/);
    await page.keyboard.press("p");
    await expect(page.getByRole("button", { name: "pen", exact: true })).toHaveClass(/bg-black/);
  });

  test("tool shortcuts do not trigger when typing in input fields", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    // Open search dialog (has input field)
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Pen should be active initially
    await expect(page.getByRole("button", { name: "pen", exact: true })).toHaveClass(/bg-black/);

    // Type "e" in search input (should not switch to eraser)
    await page.getByTestId("search-input").fill("e");

    // Pen should still be active
    await expect(page.getByRole("button", { name: "pen", exact: true })).toHaveClass(/bg-black/);

    // Close search
    await page.keyboard.press("Escape");
  });
});

test.describe("Keyboard Shortcuts Dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E ShortcutsDialog"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows tool shortcuts (P and E) in dialog", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open shortcuts dialog
    await page.keyboard.press("?");
    const dialog = page.getByTestId("shortcuts-dialog").first();
    await expect(dialog).toBeVisible();

    // Should show tool shortcuts
    await expect(dialog).toContainText("Pen tool");
    await expect(dialog).toContainText("Eraser tool");
  });

  test("shows page jump shortcut (G) in dialog", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open shortcuts dialog
    await page.keyboard.press("?");
    const dialog = page.getByTestId("shortcuts-dialog").first();
    await expect(dialog).toBeVisible();

    // Should show page jump shortcut
    await expect(dialog).toContainText("Go to page");
  });
});
