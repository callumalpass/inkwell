import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  drawStroke,
  openNotebook,
  openNotebookSingleMode,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Toolbar - Eraser tool", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Eraser"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("selecting eraser changes active tool and hides pen-only options", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    const penBtn = page.getByRole("button", { name: "pen", exact: true });
    const eraserBtn = page.getByRole("button", { name: "eraser" });

    // Pen should be active by default
    await expect(penBtn).toBeVisible();
    await expect(eraserBtn).toBeVisible();

    // Color and pen style pickers should be visible when pen is active
    await expect(page.getByRole("button", { name: "Black", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pressure" })).toBeVisible();

    // Switch to eraser
    await eraserBtn.click();

    // Color and pen style options should be hidden when eraser is active
    await expect(page.getByRole("button", { name: "Black", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Pressure" })).not.toBeVisible();

    // Switch back to pen — options should reappear
    await penBtn.click();
    await expect(page.getByRole("button", { name: "Black", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pressure" })).toBeVisible();
  });

  test("eraser changes cursor to crosshair on drawing layer", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Switch to eraser
    await page.getByRole("button", { name: "eraser" }).click();

    // The drawing layer should have cursor: crosshair
    const cursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(cursor).toBe("crosshair");

    // Switch back to pen — cursor should be default
    await page.getByRole("button", { name: "pen", exact: true }).click();
    const penCursor = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).cursor,
    );
    expect(penCursor).toBe("default");
  });

  test("eraser removes a drawn stroke", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Draw a stroke with pen
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save so the stroke is persisted
    await page.waitForTimeout(3000);

    // Switch to eraser
    await page.getByRole("button", { name: "eraser" }).click();

    // Drag the eraser along the same diagonal path as the drawn stroke.
    // The stroke was drawn from (30%, 30%) to (70%, 70%) of the drawing layer.
    // The eraser hit-tests against individual stroke points, so we need to
    // follow the same path to pass close enough to an actual stored point.
    const drawingLayer = page.locator(".touch-none").first();
    const box = await drawingLayer.boundingBox();
    if (!box) throw new Error("No bounding box");

    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.3;
    const endX = box.x + box.width * 0.7;
    const endY = box.y + box.height * 0.7;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.mouse.up();

    // The stroke should be removed
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe("Toolbar - Pen styles", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E PenStyle"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can switch between pen styles", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Pen style buttons should be visible
    await expect(page.getByRole("button", { name: "Pressure" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Uniform" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ballpoint" })).toBeVisible();

    // Select Uniform
    await page.getByRole("button", { name: "Uniform" }).click();

    // Draw a stroke
    await drawStroke(page, ".touch-none");

    // The stroke should render with a stroke attribute (stroked path, not filled)
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });
    const path = page.locator(".bg-white.shadow-sm svg path").first();
    const fill = await path.getAttribute("fill");
    expect(fill).toBe("none"); // Uniform uses stroke, not fill
  });

  test("pen style persists in saved stroke data", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Select Ballpoint style
    await page.getByRole("button", { name: "Ballpoint" }).click();

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Verify the stroke was saved with the correct pen style via API
    const url = page.url();
    const pageIdMatch = url.match(/page\/(pg_[^/]+)/);
    const pageId = pageIdMatch?.[1];
    expect(pageId).toBeTruthy();

    const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
    const strokes = (await res.json()) as { penStyle?: string }[];
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[0].penStyle).toBe("ballpoint");
  });
});

test.describe("Toolbar - Multi-page navigation", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E PageNav"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 3 pages for navigation tests
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("page counter shows current position and total pages", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to single mode to see page navigation
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Page counter should show "1/3"
    await expect(page.getByText("1/3")).toBeVisible();
  });

  test("Prev and Next buttons navigate between pages", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to single mode
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Prev should be disabled on first page
    const prevBtn = page.getByRole("button", { name: "Prev" });
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(prevBtn).toBeDisabled();

    // Navigate to page 2
    await nextBtn.click();
    await expect(page.getByText("2/3")).toBeVisible();

    // URL should change to the second page
    await page.waitForURL(/\/page\/pg_/);

    // Prev should now be enabled
    await expect(prevBtn).toBeEnabled();

    // Navigate to page 3
    await nextBtn.click();
    await expect(page.getByText("3/3")).toBeVisible();

    // Next should be disabled on last page
    await expect(nextBtn).toBeDisabled();

    // Go back to page 2
    await prevBtn.click();
    await expect(page.getByText("2/3")).toBeVisible();
  });

  test("Add Page creates a new page and navigates to it", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to single mode
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // Should start with 3 pages
    await expect(page.getByText("1/3")).toBeVisible();

    // Click "+ Page" to add a new page
    await page.getByRole("button", { name: "+ Page" }).click();

    // Should now show 4 pages, and navigate to the new page (page 4)
    await expect(page.getByText(/4\/4/)).toBeVisible({ timeout: 5000 });
  });

  test("page nav buttons are hidden in scroll and canvas views", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to scroll mode
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });

    // Prev/Next buttons should not be visible
    await expect(page.getByRole("button", { name: "Prev" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();

    // Switch to canvas mode
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.locator(".relative.flex-1.overflow-hidden.bg-gray-200")).toBeVisible({ timeout: 5000 });

    // Still no Prev/Next
    await expect(page.getByRole("button", { name: "Prev" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();
  });
});

test.describe("Toolbar - Compact mode", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Compact"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("toolbar switches to compact mode on narrow viewport", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // In full width, color buttons should be directly visible
    await expect(page.getByRole("button", { name: "Black", exact: true })).toBeVisible();

    // Resize to narrow viewport (below 768px breakpoint)
    await page.setViewportSize({ width: 600, height: 800 });

    // Color buttons should be hidden (compact mode)
    await expect(page.getByRole("button", { name: "Black", exact: true })).not.toBeVisible();

    // Pen settings button should appear
    await expect(page.getByRole("button", { name: "Pen settings" })).toBeVisible();

    // Expand button should be visible
    const expandBtn = page.getByRole("button", { name: "Expand toolbar" });
    await expect(expandBtn).toBeVisible();

    // Click expand to show hidden options
    await expandBtn.click();

    // Now the color and style options should be visible in the expanded panel
    await expect(page.getByRole("button", { name: "Collapse toolbar" })).toBeVisible();
  });

  test("compact mode expansion shows color and style options", async ({ page }) => {
    // Open notebook at default width, then switch to single mode before resizing.
    // The "Single" button may be hidden in the compact expanded panel at 600px.
    await openNotebookSingleMode(page, notebookTitle);

    // Resize to narrow viewport to trigger compact mode
    await page.setViewportSize({ width: 600, height: 800 });

    // Click expand
    const expandBtn = page.getByRole("button", { name: "Expand toolbar" });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // Width, Color, Style pickers should now be visible
    await expect(page.getByText("Width")).toBeVisible();
    await expect(page.getByText("Color")).toBeVisible();
    await expect(page.getByText("Style")).toBeVisible();

    // Collapse again
    await page.getByRole("button", { name: "Collapse toolbar" }).click();

    // Options should hide
    await expect(page.getByText("Width")).not.toBeVisible();
  });
});

test.describe("Toolbar - Stroke width", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Width"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("stroke width affects saved stroke data", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Click the widest width preset (8)
    const wideBtn = page.getByRole("button", { name: "Width 8" });
    await wideBtn.click();

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Verify the stroke width via API
    const url = page.url();
    const pageIdMatch = url.match(/page\/(pg_[^/]+)/);
    const pageId = pageIdMatch?.[1];
    expect(pageId).toBeTruthy();

    const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
    const strokes = (await res.json()) as { width: number }[];
    expect(strokes.length).toBeGreaterThan(0);
    // Width should be 8 (the largest preset)
    expect(strokes[0].width).toBe(8);
  });
});
