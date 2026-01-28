import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  getPageIds,
  getStrokeCount,
  drawStroke,
  drawQuickStroke,
  openNotebook,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Canvas view – drawing and persistence", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E CanvasDraw"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("draw a stroke in canvas mode and verify it persists", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    // Wait for canvas container and a page surface
    await expect(
      page.locator(".relative.flex-1.overflow-hidden.bg-gray-200"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    // Draw a stroke on the first drawing layer
    await drawStroke(page, ".touch-none");

    // SVG path should appear
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Verify via API
    const pageIds = await getPageIds(notebookId);
    expect(await getStrokeCount(pageIds[0])).toBeGreaterThanOrEqual(1);

    // Reload and verify persistence
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("multiple strokes in canvas mode are all captured", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    const box = await page.locator(".touch-none").first().boundingBox();
    if (!box) throw new Error("No bounding box");

    const TOTAL = 4;
    for (let i = 0; i < TOTAL; i++) {
      await drawQuickStroke(page, box, 0.1 + i * 0.2);
      await page.waitForTimeout(300);
    }

    // Wait for batch save
    await page.waitForTimeout(4000);

    const pageIds = await getPageIds(notebookId);
    const apiCount = await getStrokeCount(pageIds[0]);
    expect(apiCount).toBe(TOTAL);

    // Verify SVG rendering matches (no duplicates)
    const firstPage = page.locator(".bg-white.shadow-sm").first();
    const pathCount = await firstPage.locator("svg path").count();
    expect(pathCount).toBe(TOTAL);
  });

  test("strokes on different pages are isolated", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(
      page.locator(".relative.flex-1.overflow-hidden.bg-gray-200"),
    ).toBeVisible({ timeout: 5000 });

    // Draw on the first page's drawing layer
    const drawingLayers = page.locator(".touch-none");
    await expect(drawingLayers.first()).toBeVisible({ timeout: 5000 });

    await drawStroke(page, ".touch-none");
    await expect(
      page.locator(".bg-white.shadow-sm").first().locator("svg path"),
    ).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(4000);

    // Verify strokes are on the correct page
    const pageIds = await getPageIds(notebookId);
    const page1Count = await getStrokeCount(pageIds[0]);
    const page2Count = await getStrokeCount(pageIds[1]);

    expect(page1Count).toBeGreaterThanOrEqual(1);
    expect(page2Count).toBe(0);
  });
});

test.describe("Canvas view – view mode transitions", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E CanvasTransition"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("stroke drawn in canvas mode is visible after switching to single mode", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    await drawStroke(page, ".touch-none");
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Switch to single page mode
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    // Stroke should still be visible
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("stroke drawn in single mode is visible after switching to canvas mode", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    await drawStroke(page, ".touch-none");
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Switch to canvas mode
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(
      page.locator(".relative.flex-1.overflow-hidden.bg-gray-200"),
    ).toBeVisible({ timeout: 5000 });

    // Stroke should still be visible
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("stroke drawn in scroll mode persists into canvas mode", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    await drawStroke(page, ".touch-pan-y");
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Switch to canvas mode
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(
      page.locator(".relative.flex-1.overflow-hidden.bg-gray-200"),
    ).toBeVisible({ timeout: 5000 });

    // Stroke should still be visible
    await expect(
      page.locator(".bg-white.shadow-sm svg path").first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
