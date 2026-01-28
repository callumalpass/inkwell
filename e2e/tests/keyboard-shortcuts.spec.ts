import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  drawStroke,
  openNotebook,
  openNotebookSingleMode,
  uniqueTitle,
  writeTranscription,
} from "../helpers";

test.describe("Keyboard Shortcuts - Global", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Keyboard"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("Ctrl+K opens search dialog from notebooks page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Press Ctrl+K
    await page.keyboard.press("Control+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Input should be focused
    await expect(page.getByTestId("search-input")).toBeFocused();
  });

  test("Cmd+K opens search dialog on macOS", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Press Cmd+K (Meta+K)
    await page.keyboard.press("Meta+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("Escape closes search dialog", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open search
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Dialog should close
    await expect(page.getByTestId("search-dialog")).not.toBeVisible();
  });

  test("Ctrl+K works from within a notebook", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Press Ctrl+K from writing view
    await page.keyboard.press("Control+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });
});

test.describe("Keyboard Shortcuts - Undo/Redo", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E UndoRedo KB"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("Ctrl+Z undoes a drawn stroke", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Press Ctrl+Z to undo
    await page.keyboard.press("Control+z");

    // Stroke should be removed
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });

  test("Ctrl+Shift+Z redoes an undone stroke", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Undo
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });

    // Redo with Ctrl+Shift+Z
    await page.keyboard.press("Control+Shift+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });
  });

  test("multiple undos work sequentially", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw two strokes
    const target = page.locator(".touch-none").first();
    const box = await target.boundingBox();
    if (!box) throw new Error("No bounding box");

    // First stroke
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Second stroke
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Should have 2 strokes
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(2, { timeout: 5000 });

    // Undo first stroke
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(1, { timeout: 5000 });

    // Undo second stroke
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });

  test("Cmd+Z works for undo on macOS", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Press Cmd+Z (Meta+Z)
    await page.keyboard.press("Meta+z");

    // Stroke should be removed
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe("Keyboard Shortcuts - Navigation", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E NavKeys"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 3 pages for navigation
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("search from within notebook navigates to result", async ({ page }) => {
    const searchToken = `navtest_${Date.now()}`;

    // Get the page ID and write a transcription
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pages = (await pagesRes.json()) as { id: string }[];
    const targetPageId = pages[1].id; // Second page
    await writeTranscription(targetPageId, `Notes about ${searchToken}`);

    await openNotebookSingleMode(page, notebookTitle);

    // Verify we're on page 1
    await expect(page.getByText("1/3")).toBeVisible();

    // Open search with Ctrl+K
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Search for the token
    await page.getByTestId("search-input").fill(searchToken);

    // Wait for results
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Click the result
    await page.getByTestId("search-result").first().click();

    // Should navigate to the page with the transcription
    await page.waitForURL(/\/page\/pg_/);
  });
});

test.describe("Keyboard Shortcuts - Focus Management", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Focus"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("keyboard shortcuts work after closing search dialog", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Open and close search
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-dialog")).not.toBeVisible();

    // Undo should still work after closing search
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });

  test("typing in search does not trigger undo shortcuts", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Open search
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Type something that includes 'z'
    await page.getByTestId("search-input").fill("pizza");

    // Close search
    await page.keyboard.press("Escape");

    // Stroke should still be there (typing 'z' in search should not undo)
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible();
  });
});
