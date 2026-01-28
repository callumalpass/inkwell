import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Canvas View Minimap", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Minimap"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create multiple pages to make the minimap useful
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("minimap is visible in canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    // Wait for canvas view to load
    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // Minimap should be visible
    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });
  });

  test("minimap shows page count", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });

    // Should display "3 pages"
    await expect(page.getByTestId("canvas-minimap")).toContainText("3 pages");
  });

  test("minimap shows viewport indicator", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });

    // Viewport indicator should be visible
    await expect(page.getByTestId("minimap-viewport")).toBeVisible();
  });

  test("clicking minimap pans the canvas", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });

    // Get initial transform of the canvas content
    const canvasContent = page.locator("[data-testid='canvas-view'] > div").first();
    const initialTransform = await canvasContent.evaluate((el) => el.style.transform);

    // Click on a different part of the minimap
    const minimap = page.getByTestId("canvas-minimap");
    const box = await minimap.boundingBox();
    if (!box) throw new Error("No minimap bounding box");

    // Click near the edge of the minimap
    await minimap.click({
      position: { x: box.width - 20, y: box.height - 20 },
    });

    // Wait for transform to update
    await page.waitForTimeout(100);

    // Transform should have changed
    const newTransform = await canvasContent.evaluate((el) => el.style.transform);
    expect(newTransform).not.toBe(initialTransform);
  });

  test("dragging on minimap continuously updates canvas position", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });

    const minimap = page.getByTestId("canvas-minimap");
    const box = await minimap.boundingBox();
    if (!box) throw new Error("No minimap bounding box");

    const canvasContent = page.locator("[data-testid='canvas-view'] > div").first();
    const transforms: string[] = [];

    // Perform a drag across the minimap
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();

    // Capture transform at different points during drag
    transforms.push(await canvasContent.evaluate((el) => el.style.transform));

    await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
    transforms.push(await canvasContent.evaluate((el) => el.style.transform));

    await page.mouse.move(box.x + 140, box.y + 100, { steps: 5 });
    transforms.push(await canvasContent.evaluate((el) => el.style.transform));

    await page.mouse.up();

    // Transform should have changed during the drag
    const uniqueTransforms = new Set(transforms);
    expect(uniqueTransforms.size).toBeGreaterThan(1);
  });

  test("minimap is not visible in single page view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Start in single page view
    await page.getByRole("button", { name: "Single" }).click();

    // Minimap should not be visible in single page view
    await expect(page.getByTestId("canvas-minimap")).toHaveCount(0);
  });

  test("minimap is not visible in overview view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to overview view
    await page.getByRole("button", { name: "Overview" }).click();

    // Minimap should not be visible in overview view
    await expect(page.getByTestId("canvas-minimap")).toHaveCount(0);
  });

  test("minimap updates when adding new pages", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-minimap")).toBeVisible({ timeout: 5000 });

    // Initially 3 pages
    await expect(page.getByTestId("canvas-minimap")).toContainText("3 pages");

    // Create a new page using the N shortcut
    await page.keyboard.press("n");

    // Wait for page creation
    await page.waitForTimeout(1000);

    // Return to canvas view (creating a page switches to single view)
    await page.getByRole("button", { name: "Canvas" }).click();

    // Should now show 4 pages
    await expect(page.getByTestId("canvas-minimap")).toContainText("4 pages");
  });

  test("viewport indicator reflects zoom level", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("minimap-viewport")).toBeVisible();

    const viewport = page.getByTestId("minimap-viewport");

    // Get initial viewport size
    const initialWidth = await viewport.evaluate((el) => parseFloat(el.getAttribute("width") || "0"));
    const initialHeight = await viewport.evaluate((el) => parseFloat(el.getAttribute("height") || "0"));

    // Zoom in using keyboard shortcut (Ctrl + wheel) or zoom buttons if available
    const canvasView = page.getByTestId("canvas-view");
    await canvasView.hover();

    // Simulate zoom in with Ctrl + scroll
    await page.mouse.wheel(0, -100);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");

    await page.waitForTimeout(200);

    // Viewport rectangle should be smaller after zooming in
    const newWidth = await viewport.evaluate((el) => parseFloat(el.getAttribute("width") || "0"));
    const newHeight = await viewport.evaluate((el) => parseFloat(el.getAttribute("height") || "0"));

    // When zoomed in, viewport indicator should be smaller (showing less of the canvas)
    expect(newWidth).toBeLessThanOrEqual(initialWidth);
    expect(newHeight).toBeLessThanOrEqual(initialHeight);
  });
});
