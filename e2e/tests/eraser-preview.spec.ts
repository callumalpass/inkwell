import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  addStroke,
  openNotebookSingleMode,
  uniqueTitle,
} from "../helpers";

test.describe("Eraser preview - stroke highlighting", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E EraserPreview"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("eraser cursor shows circle when tool is active", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Add a stroke via API
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pages = await pagesRes.json() as { id: string }[];
    await addStroke(pages[0].id);

    // Reload to see the stroke
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Single" }).click();

    // Switch to eraser tool
    await page.getByRole("button", { name: "eraser" }).click();

    // Move mouse over the page surface
    const surface = page.locator(".bg-white.shadow-sm").first();
    await expect(surface).toBeVisible({ timeout: 5000 });
    const box = await surface.boundingBox();
    if (!box) throw new Error("No bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Eraser cursor should be visible
    const eraserCursor = page.locator('[data-testid="eraser-cursor"]');
    await expect(eraserCursor).toBeVisible({ timeout: 3000 });
  });

  test("stroke under eraser highlights in red", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Add a stroke via API with known coordinates
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pages = await pagesRes.json() as { id: string }[];
    const pageId = pages[0].id;

    // Add stroke at center of page (page coordinates: ~700x936 center)
    await fetch(`http://localhost:3001/api/pages/${pageId}/strokes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strokes: [
          {
            id: `st_test_${Date.now()}`,
            timestamp: Date.now(),
            tool: "pen",
            color: "#000000",
            width: 2,
            points: [
              { x: 600, y: 800, pressure: 0.8 },
              { x: 700, y: 850, pressure: 0.85 },
              { x: 800, y: 900, pressure: 0.9 },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });

    // Reload to see the stroke
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Wait for stroke to be visible
    const strokePath = page.locator(".bg-white.shadow-sm svg path").first();
    await expect(strokePath).toBeVisible({ timeout: 5000 });

    // Verify stroke starts with black color
    const initialFill = await strokePath.getAttribute("fill");
    expect(initialFill).toBe("#000000");

    // Switch to eraser tool
    await page.getByRole("button", { name: "eraser" }).click();

    // Move mouse directly over the stroke area
    const surface = page.locator(".bg-white.shadow-sm").first();
    const box = await surface.boundingBox();
    if (!box) throw new Error("No bounding box");

    // Calculate position - stroke is at ~700x850 in page coords (1404x1872)
    // Need to translate to screen coords
    const strokeScreenX = box.x + (700 / 1404) * box.width;
    const strokeScreenY = box.y + (850 / 1872) * box.height;

    await page.mouse.move(strokeScreenX, strokeScreenY);

    // Wait for highlight - stroke should turn red (#ef4444)
    await expect(strokePath).toHaveAttribute("fill", "#ef4444", { timeout: 3000 });
  });

  test("stroke returns to original color when eraser moves away", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Add a stroke via API
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pages = await pagesRes.json() as { id: string }[];
    const pageId = pages[0].id;

    await fetch(`http://localhost:3001/api/pages/${pageId}/strokes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strokes: [
          {
            id: `st_test_${Date.now()}`,
            timestamp: Date.now(),
            tool: "pen",
            color: "#000000",
            width: 2,
            points: [
              { x: 600, y: 800, pressure: 0.8 },
              { x: 700, y: 850, pressure: 0.85 },
              { x: 800, y: 900, pressure: 0.9 },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });

    // Reload and switch to single mode
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Single" }).click();

    const strokePath = page.locator(".bg-white.shadow-sm svg path").first();
    await expect(strokePath).toBeVisible({ timeout: 5000 });

    // Switch to eraser
    await page.getByRole("button", { name: "eraser" }).click();

    const surface = page.locator(".bg-white.shadow-sm").first();
    const box = await surface.boundingBox();
    if (!box) throw new Error("No bounding box");

    // Move over the stroke
    const strokeScreenX = box.x + (700 / 1404) * box.width;
    const strokeScreenY = box.y + (850 / 1872) * box.height;
    await page.mouse.move(strokeScreenX, strokeScreenY);

    // Verify it's highlighted
    await expect(strokePath).toHaveAttribute("fill", "#ef4444", { timeout: 3000 });

    // Move away from the stroke (to corner)
    await page.mouse.move(box.x + 10, box.y + 10);

    // Stroke should return to black
    await expect(strokePath).toHaveAttribute("fill", "#000000", { timeout: 3000 });
  });

  test("eraser cursor disappears when switching tools", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Switch to eraser
    await page.getByRole("button", { name: "eraser" }).click();

    // Move mouse over page
    const surface = page.locator(".bg-white.shadow-sm").first();
    const box = await surface.boundingBox();
    if (!box) throw new Error("No bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Eraser cursor visible
    const eraserCursor = page.locator('[data-testid="eraser-cursor"]');
    await expect(eraserCursor).toBeVisible({ timeout: 3000 });

    // Switch to pen
    await page.getByRole("button", { name: "pen", exact: true }).click();

    // Eraser cursor should disappear
    await expect(eraserCursor).not.toBeVisible({ timeout: 2000 });
  });
});
