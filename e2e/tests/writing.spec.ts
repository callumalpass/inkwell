import { test, expect } from "@playwright/test";

const API = "http://localhost:3001";

async function createNotebook(title: string) {
  const res = await fetch(`${API}/api/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return (await res.json()) as { id: string; title: string };
}

async function addPage(notebookId: string) {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`, {
    method: "POST",
  });
  return (await res.json()) as { id: string };
}

async function deleteNotebook(id: string) {
  await fetch(`${API}/api/notebooks/${id}`, { method: "DELETE" });
}

async function drawStroke(page: import("@playwright/test").Page, selector: string) {
  const target = page.locator(selector).first();
  const box = await target.boundingBox();
  if (!box) throw new Error(`Could not find bounding box for ${selector}`);

  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.7;
  const endY = box.y + box.height * 0.7;
  const midX = (startX + endX) / 2;
  const midY = startY + (endY - startY) * 0.3;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(midX, midY, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();
}

test.describe("Writing - Single page view", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Single ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("draw a stroke and verify SVG path appears", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Verify toolbar is visible with pen button active
    await expect(page.getByRole("button", { name: "pen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Single" })).toBeVisible();

    // Draw a stroke on the drawing layer
    await drawStroke(page, ".touch-none");

    // Wait for SVG path element to appear (stroke rendered)
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save to persist
    await page.waitForTimeout(3000);

    // Reload and verify stroke persists
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await expect(page.locator("svg path")).toBeVisible({ timeout: 10000 });
  });

  test("drawing layer uses touch-none in single page view", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // In single page mode, the drawing layer should have touch-none (not touch-pan-y)
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
    const touchAction = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).touchAction,
    );
    expect(touchAction).toBe("none");
  });

  test("zoom container structure is present in single page view", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // The single page view should have overflow-hidden for zoom containment
    const zoomContainer = page.locator(".overflow-hidden.bg-gray-100");
    await expect(zoomContainer).toBeVisible({ timeout: 5000 });

    // The transform wrapper div should exist inside
    const transformDiv = zoomContainer.locator("> div").first();
    await expect(transformDiv).toBeVisible();
    const transformStyle = await transformDiv.evaluate(
      (el) => el.style.transform,
    );
    // Default transform should have scale(1) and translate(0,0)
    expect(transformStyle).toContain("scale(1)");
  });
});

test.describe("Writing - Undo/Redo", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Undo ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("undo removes stroke and redo restores it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Verify undo/redo buttons exist and are disabled initially
    const undoBtn = page.getByRole("button", { name: "Undo" });
    const redoBtn = page.getByRole("button", { name: "Redo" });
    await expect(undoBtn).toBeVisible();
    await expect(redoBtn).toBeVisible();
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    // Draw a stroke
    await drawStroke(page, ".touch-none");

    // Wait for SVG path to appear
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save (stroke must be persisted before undo is available)
    await page.waitForTimeout(3000);

    // Undo button should now be enabled
    await expect(undoBtn).toBeEnabled({ timeout: 5000 });

    // Click Undo — stroke should be removed
    await undoBtn.click();

    // SVG path should disappear
    await expect(page.locator("svg path")).toHaveCount(0, { timeout: 5000 });

    // Redo should now be enabled
    await expect(redoBtn).toBeEnabled({ timeout: 2000 });

    // Click Redo — stroke should reappear
    await redoBtn.click();

    // SVG path should reappear
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });
  });

  test("Ctrl+Z and Ctrl+Shift+Z keyboard shortcuts work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Draw a stroke
    await drawStroke(page, ".touch-none");
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save
    await page.waitForTimeout(3000);

    // Ctrl+Z to undo
    await page.keyboard.press("Control+z");
    await expect(page.locator("svg path")).toHaveCount(0, { timeout: 5000 });

    // Ctrl+Shift+Z to redo
    await page.keyboard.press("Control+Shift+z");
    await expect(page.locator("svg path").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Writing - Color presets", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Color ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can switch ink color and draw with it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Color buttons should be visible (Black, Blue, Red)
    await expect(page.getByRole("button", { name: "Black", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Blue", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Red", exact: true })).toBeVisible();

    // Select blue color
    await page.getByRole("button", { name: "Blue", exact: true }).click();

    // Draw a stroke
    await drawStroke(page, ".touch-none");

    // Wait for SVG path to appear
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // The stroke should use the blue color (#1e40af)
    const path = page.locator("svg path").first();
    const fill = await path.getAttribute("fill");
    const stroke = await path.getAttribute("stroke");
    // Depending on pen style, the color is in fill or stroke attribute
    const colorUsed = fill !== "none" ? fill : stroke;
    expect(colorUsed).toBe("#1e40af");
  });
});

test.describe("Writing - Background templates", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Grid ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can switch between grid types", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Grid type buttons should be visible
    await expect(page.getByRole("button", { name: "Plain" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lined" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Grid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dots" })).toBeVisible();

    // Default should be Plain (no background pattern elements)
    await expect(page.locator("svg pattern")).toHaveCount(0, { timeout: 2000 });

    // Switch to Lined — should render a lined pattern with a margin line
    await page.getByRole("button", { name: "Lined" }).click();
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(1, { timeout: 5000 });
    // Should have a margin line (red vertical line)
    await expect(page.locator("svg > line")).not.toHaveCount(0, { timeout: 2000 });

    // Switch to Grid — should render a grid pattern
    await page.getByRole("button", { name: "Grid" }).click();
    await expect(page.locator("svg pattern#grid-pattern")).toHaveCount(1, { timeout: 5000 });
    // Grid pattern should not have the lined pattern anymore
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(0);

    // Switch to Dots — circle pattern instead of lines
    await page.getByRole("button", { name: "Dots" }).click();
    await expect(page.locator("svg pattern#dotgrid-pattern")).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator("svg pattern#grid-pattern")).toHaveCount(0);

    // Switch back to Plain — no patterns at all
    await page.getByRole("button", { name: "Plain" }).click();
    await expect(page.locator("svg pattern")).toHaveCount(0, { timeout: 2000 });
  });

  test("grid type persists after page reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Lined
    await page.getByRole("button", { name: "Lined" }).click();
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(1, { timeout: 5000 });

    // Reload the page
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Lined pattern should still be present after reload (setting was persisted)
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(1, { timeout: 10000 });
  });
});

test.describe("Writing - Scroll view", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Scroll ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 2 pages so scroll view has content
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("switch to scroll mode and verify scroll container appears", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Scroll view
    await page.getByRole("button", { name: "Scroll" }).click();

    // Verify the scroll container is visible (overflow-y-auto bg-gray-100)
    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });

    // Verify page wrappers are rendered (each page has a w-full wrapper div)
    // ScrollPageListView renders a div for each page regardless of visibility
    const pageWrappers = page.locator(".overflow-y-auto.bg-gray-100 .w-full");
    await expect(pageWrappers.first()).toBeVisible({ timeout: 5000 });
    const count = await pageWrappers.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("draw a stroke in scroll mode and verify SVG path appears", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Scroll view
    await page.getByRole("button", { name: "Scroll" }).click();

    // Wait for the scroll container and a page surface to render
    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });
    // In scroll mode the drawing layer uses touch-pan-y instead of touch-none
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({ timeout: 5000 });

    // Draw a stroke on the first visible drawing layer
    await drawStroke(page, ".touch-pan-y");

    // SVG path element should appear (stroke rendered)
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save to persist
    await page.waitForTimeout(3000);

    // Reload and verify stroke persists in scroll mode
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator("svg path")).toBeVisible({ timeout: 10000 });
  });

  test("drawing layer allows touch scrolling via touch-pan-y", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Scroll view
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({ timeout: 5000 });

    // Verify the drawing layer has touch-action: pan-y (not none)
    const touchAction = await page.locator(".touch-pan-y").first().evaluate(
      (el) => getComputedStyle(el).touchAction,
    );
    expect(touchAction).toBe("pan-y");
  });
});

test.describe("Writing - Canvas view", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Canvas ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 2 pages for canvas
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("switch to canvas mode and verify pages visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Canvas view
    await page.getByRole("button", { name: "Canvas" }).click();

    // Verify canvas container is visible (use the specific class combination)
    await expect(page.locator(".relative.flex-1.overflow-hidden.bg-gray-200")).toBeVisible();

    // Verify page surfaces are rendered on the canvas
    const pageSurfaces = page.locator(".bg-white.shadow-sm");
    await expect(pageSurfaces.first()).toBeVisible({ timeout: 5000 });

    const count = await pageSurfaces.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("drawing layer uses touch-none in canvas mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.locator(".relative.flex-1.overflow-hidden.bg-gray-200")).toBeVisible();

    // Drawing layers in canvas view should use touch-none
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
    const touchAction = await page.locator(".touch-none").first().evaluate(
      (el) => getComputedStyle(el).touchAction,
    );
    expect(touchAction).toBe("none");
  });

  test("middle-click dragging a page in canvas mode does not create strokes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to Canvas view
    await page.getByRole("button", { name: "Canvas" }).click();

    // Wait for a page surface to appear
    const pageSurface = page.locator(".bg-white.shadow-sm").first();
    await expect(pageSurface).toBeVisible({ timeout: 5000 });

    const box = await pageSurface.boundingBox();
    if (!box) throw new Error("No bounding box for page surface");

    // Middle-click drag the page (drawing tools use left-click for strokes,
    // so page dragging requires middle-click when pen/eraser is active)
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(cx + 100, cy + 80, { steps: 10 });
    await page.mouse.up({ button: "middle" });

    // Move the mouse around over the page after drag to check for ghost strokes
    await page.mouse.move(cx + 120, cy + 100);
    await page.mouse.move(cx + 140, cy + 120);
    await page.mouse.move(cx + 110, cy + 90);

    // Wait a moment for any would-be strokes to render
    await page.waitForTimeout(500);

    // No SVG path elements should exist — middle-click dragging must not create strokes
    await expect(page.locator("svg path")).toHaveCount(0);

    // Also verify via API: fetch strokes for the first page
    const pagesRes = await fetch(`${API}/api/notebooks/${notebookId}/pages`);
    const pagesData = (await pagesRes.json()) as { id: string }[];
    const firstPageId = pagesData[0].id;
    const strokesRes = await fetch(`${API}/api/pages/${firstPageId}/strokes`);
    const strokes = (await strokesRes.json()) as unknown[];
    expect(strokes.length).toBe(0);
  });
});
