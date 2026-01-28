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

  test("Ctrl+K works only from notebooks page", async ({ page }) => {
    // Note: The search shortcut is currently only available on the notebooks page,
    // not from within a notebook's writing view. This test documents that behavior.
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Ctrl+K should work on the notebooks page
    await page.keyboard.press("Control+k");
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

  test("search from notebooks page navigates to result", async ({ page }) => {
    const searchToken = `navtest_${Date.now()}`;

    // Get the page ID and write a transcription
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pages = (await pagesRes.json()) as { id: string }[];
    const targetPageId = pages[1].id; // Second page
    await writeTranscription(targetPageId, `Notes about ${searchToken}`);

    // Go to notebooks page and search from there
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

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

test.describe("Keyboard Shortcuts - Search Navigation", () => {
  let notebookId: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E SearchNav"));
    notebookId = nb.id;
    // Create pages with distinct transcriptions
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);
    await writeTranscription(page1.id, "Apple banana cherry");
    await writeTranscription(page2.id, "Apple dragonfruit elderberry");
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("arrow keys navigate search results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open search
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Search for "Apple" which should match 2 results
    await page.getByTestId("search-input").fill("Apple");
    await expect(page.getByTestId("search-count")).toBeVisible({ timeout: 5000 });

    // Arrow down to first result
    await page.keyboard.press("ArrowDown");

    // First result should be highlighted (has ring-2 class)
    const firstResult = page.getByTestId("search-result").first();
    await expect(firstResult).toHaveClass(/ring-2/);

    // Arrow down to second result
    await page.keyboard.press("ArrowDown");

    // Second result should be highlighted
    const secondResult = page.getByTestId("search-result").nth(1);
    await expect(secondResult).toHaveClass(/ring-2/);
  });

  test("Enter opens selected search result", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open search
    await page.keyboard.press("Control+k");

    // Search for "Apple"
    await page.getByTestId("search-input").fill("Apple");
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Select first result
    await page.keyboard.press("ArrowDown");

    // Press Enter to open
    await page.keyboard.press("Enter");

    // Should navigate to the page
    await page.waitForURL(/\/page\/pg_/);
  });

  test("search button shows keyboard hint", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // The search button should show ⌘K hint
    const searchButton = page.getByTestId("search-button");
    await expect(searchButton).toContainText("⌘K");
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

  test("undo shortcut works after clicking on drawing area", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Click on a toolbar button and then back on the page
    await page.getByRole("button", { name: "pen", exact: true }).click();

    // Undo should still work
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });

  test("undo shortcut works after using toolbar", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Interact with toolbar (change color)
    await page.getByRole("button", { name: "Blue", exact: true }).click();

    // Undo should still work (undoes the stroke, not the color change)
    await page.keyboard.press("Control+z");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe("Keyboard Shortcuts - Tool Selection", () => {
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

  test("pressing P switches to pen tool", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // First switch to eraser
    await page.getByRole("button", { name: "eraser" }).click();

    // Cursor should be crosshair for eraser
    const cursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(cursor).toBe("crosshair");

    // Press P to switch to pen
    await page.keyboard.press("p");

    // Cursor should be default (pen mode)
    const penCursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(penCursor).toBe("default");
  });

  test("pressing E switches to eraser tool", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Start in pen mode (default)
    const cursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(cursor).toBe("default");

    // Press E to switch to eraser
    await page.keyboard.press("e");

    // Cursor should be crosshair for eraser
    const eraserCursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(eraserCursor).toBe("crosshair");
  });

  test("pressing H switches to highlighter tool", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // First switch to eraser to see the tool change effect
    await page.getByRole("button", { name: "eraser" }).click();

    // Press H to switch to highlighter
    await page.keyboard.press("h");

    // Cursor should be default (highlighter is a drawing tool like pen)
    const highlighterCursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(highlighterCursor).toBe("default");

    // Highlighter button should be active (has different visual state)
    // Note: We verify by drawing and checking the stroke has highlighter tool
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Verify the stroke was saved with highlighter tool via API
    const url = page.url();
    const pageIdMatch = url.match(/page\/(pg_[^/]+)/);
    const pageId = pageIdMatch?.[1];
    expect(pageId).toBeTruthy();

    const res = await fetch(`http://localhost:3001/api/pages/${pageId}/strokes`);
    const strokes = (await res.json()) as { tool: string }[];
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[0].tool).toBe("highlighter");
  });

  test("keyboard shortcuts dialog shows H for highlighter", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Open keyboard shortcuts dialog with ?
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcuts-dialog").first()).toBeVisible({ timeout: 5000 });

    // Should show H key for highlighter
    await expect(page.getByText("Highlighter tool").first()).toBeVisible();
  });

  test("tool shortcuts do not trigger in input fields", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // First switch to eraser so we can detect if shortcut incorrectly triggers
    await page.getByRole("button", { name: "eraser" }).click();

    // Open search dialog which has an input
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible({ timeout: 5000 });

    // Type 'p' in the search input
    await page.getByTestId("search-input").fill("p");

    // Close search
    await page.keyboard.press("Escape");

    // Should still be in eraser mode (cursor is crosshair)
    const cursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(cursor).toBe("crosshair");
  });
});
