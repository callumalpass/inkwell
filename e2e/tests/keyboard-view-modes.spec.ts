import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Keyboard shortcuts for view modes", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E ViewMode KB"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("pressing 1 switches to single page view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Start in canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // Press 1 to switch to single page view
    await page.keyboard.press("1");

    // Should now be in single page view
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
    // Canvas view should not be visible
    await expect(page.getByTestId("canvas-view")).toHaveCount(0);
  });

  test("pressing 2 switches to canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Start in single page view
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Press 2 to switch to canvas view
    await page.keyboard.press("2");

    // Should now be in canvas view
    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });
  });

  test("pressing 3 switches to overview", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Start in single page view
    await page.getByRole("button", { name: "Single" }).click();

    // Press 3 to switch to overview
    await page.keyboard.press("3");

    // Should now be in overview
    await expect(page.getByTestId("overview-view")).toBeVisible({ timeout: 5000 });
  });

  test("pressing F triggers fit all in canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.getByTestId("canvas-view")).toBeVisible({ timeout: 5000 });

    // Get initial transform
    const canvasContent = page.locator("[data-testid='canvas-view'] > div").first();
    const initialTransform = await canvasContent.evaluate((el) => el.style.transform);

    // Zoom in first to change the view
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    await page.waitForTimeout(100);

    // Now press F to fit all
    await page.keyboard.press("f");
    await page.waitForTimeout(100);

    // Transform should have changed
    const newTransform = await canvasContent.evaluate((el) => el.style.transform);
    expect(newTransform).not.toBe(initialTransform);
  });

  test("F key does nothing in single page view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Stay in single page view
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Press F - should not cause any errors
    await page.keyboard.press("f");

    // Still in single page view
    await expect(page.locator(".touch-none").first()).toBeVisible();
  });

  test("view mode shortcuts do not trigger in input fields", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open search dialog which has an input
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible({ timeout: 5000 });

    // Try typing '2' in the search input
    await page.getByTestId("search-input").fill("2");

    // Close search
    await page.keyboard.press("Escape");

    // Should still be in the same view mode (single page view by default)
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
    // Should NOT have switched to canvas view
    await expect(page.getByTestId("canvas-view")).toHaveCount(0);
  });

  test("keyboard shortcuts dialog shows new shortcuts", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open keyboard shortcuts dialog
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcuts-dialog").first()).toBeVisible({ timeout: 5000 });

    // Should show view mode shortcuts
    await expect(page.getByText("Single page view").first()).toBeVisible();
    await expect(page.getByText("Canvas view").first()).toBeVisible();
    // Use a more specific selector for "Overview" to avoid matching the button
    await expect(page.getByTestId("shortcuts-dialog").first().getByText("Overview")).toBeVisible();
    await expect(page.getByText("Fit all pages").first()).toBeVisible();
  });
});
