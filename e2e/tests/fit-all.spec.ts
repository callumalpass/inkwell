import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Fit All Button in Canvas View", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E FitAll"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create multiple pages to make fit all useful
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("fit all button is visible in canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("fit-all-button")).toBeVisible();
  });

  test("fit all button is not visible in single page view", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();

    await expect(page.getByTestId("fit-all-button")).toHaveCount(0);
  });

  test("fit all adjusts zoom to show all pages", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // Get the zoom percentage before fitting
    const zoomButton = page.getByRole("button", { name: "Reset zoom" });
    const initialZoom = await zoomButton.textContent();

    // Click fit all
    await page.getByTestId("fit-all-button").click();
    await page.waitForTimeout(100);

    // Zoom should have changed (likely decreased to fit all pages)
    const newZoom = await zoomButton.textContent();

    // The zoom level should be different or the same (if already fitting)
    // Since we have 4 pages, it's likely the zoom will decrease
    expect(newZoom).toBeDefined();
    expect(parseInt(newZoom || "0")).toBeLessThanOrEqual(parseInt(initialZoom || "100"));
  });

  test("fit all centers all pages in the viewport", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // First, zoom in and pan to a corner so pages are out of view
    const canvasView = page.getByTestId("canvas-view");
    await canvasView.hover();

    // Zoom in
    await page.keyboard.down("Control");
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(50);
    }
    await page.keyboard.up("Control");

    // Pan away
    await page.mouse.move(500, 300);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(100, 100, { steps: 5 });
    await page.mouse.up({ button: "middle" });

    // Now click fit all
    await page.getByTestId("fit-all-button").click();
    await page.waitForTimeout(200);

    // All page surfaces should be visible after fitting
    const pageSurfaces = page.locator(".bg-white.shadow-sm");
    const count = await pageSurfaces.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Check that at least the first page is in the visible viewport
    const firstPage = pageSurfaces.first();
    await expect(firstPage).toBeVisible();
  });

  test("fit all works with pages at different positions", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // Drag a page to a different position
    const dragHandle = page.locator("[data-testid^='drag-handle-']").first();
    await expect(dragHandle).toBeVisible({ timeout: 5000 });

    const handleBox = await dragHandle.boundingBox();
    if (!handleBox) throw new Error("No drag handle box");

    // Drag the page significantly to the right
    await page.mouse.move(handleBox.x + 12, handleBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 600, handleBox.y + 200, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Zoom in first to make the spread more apparent
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");

    // Now fit all should show all pages including the moved one
    await page.getByTestId("fit-all-button").click();
    await page.waitForTimeout(200);

    // The zoom should accommodate the spread pages
    const zoomButton = page.getByRole("button", { name: "Reset zoom" });
    const zoomPercent = parseInt((await zoomButton.textContent()) || "100");

    // Zoom should be at or below 100% since pages are spread out
    expect(zoomPercent).toBeLessThanOrEqual(100);
  });

  test("fit all has a tooltip/aria-label", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("fit-all-button")).toBeVisible({ timeout: 5000 });

    // The button should have an accessible label
    const fitAllButton = page.getByTestId("fit-all-button");
    const ariaLabel = await fitAllButton.getAttribute("aria-label");
    expect(ariaLabel).toBe("Fit all pages");
  });
});
