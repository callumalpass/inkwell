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
    const nb = await createNotebook(`E2E Single ${Date.now()}`);
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
});

test.describe("Writing - Scroll view", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Scroll ${Date.now()}`);
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
});

test.describe("Writing - Canvas view", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Canvas ${Date.now()}`);
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
});
