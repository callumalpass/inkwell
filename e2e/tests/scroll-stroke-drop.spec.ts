import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  getPageIds,
  getStrokeCount,
  drawStroke,
  drawQuickStroke,
  visibleBox,
  openNotebook,
  uniqueTitle,
  clearStrokes,
  API,
} from "../helpers";

// ─── Scroll/unload persistence tests ───────────────────────────────────────

test.describe("Scroll view – stroke persistence across scroll", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E ScrollDrop"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    for (let i = 0; i < 5; i++) await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("stroke survives scrolling away and back", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();

    const scrollContainer = page.locator(".overflow-y-auto.bg-gray-100");
    await expect(scrollContainer).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    await drawStroke(page, ".touch-pan-y");
    const firstPage = page.locator(".bg-white.shadow-sm").first();
    await expect(firstPage.locator("svg path")).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(3000);
    await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(1000);
    await scrollContainer.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    await expect(firstPage.locator("svg path")).toBeVisible({ timeout: 10000 });
    const pageIds = await getPageIds(notebookId);
    expect(await getStrokeCount(pageIds[0])).toBeGreaterThanOrEqual(1);
  });

  test("stroke drawn just before scrolling away is not lost", async ({
    page,
  }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();

    const scrollContainer = page.locator(".overflow-y-auto.bg-gray-100");
    await expect(scrollContainer).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    await drawStroke(page, ".touch-pan-y");
    await expect(
      page.locator(".bg-white.shadow-sm").first().locator("svg path"),
    ).toBeVisible({ timeout: 5000 });

    // Scroll away immediately — before batch save
    await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(4000);

    const pageIds = await getPageIds(notebookId);
    expect(await getStrokeCount(pageIds[0])).toBeGreaterThanOrEqual(1);

    await scrollContainer.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(2000);
    await expect(
      page.locator(".bg-white.shadow-sm").first().locator("svg path"),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Stroke capture reliability tests ──────────────────────────────────────

test.describe("Scroll view – stroke capture reliability", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E StrokeCapture"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("N strokes drawn in scroll mode all appear (compare to single mode)", async ({
    page,
  }) => {
    const N = 5;

    // --- Single page mode baseline ---
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({
      timeout: 5000,
    });

    const singleBox = await page.locator(".touch-none").first().boundingBox();
    if (!singleBox) throw new Error("No bounding box");

    for (let i = 0; i < N; i++) {
      await drawQuickStroke(page, singleBox, 0.1 + i * 0.15);
      // Allow pointer events and RAF to fully settle between strokes
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(4000);
    const pageIds = await getPageIds(notebookId);
    const singleCount = await getStrokeCount(pageIds[0]);

    // Clear strokes before scroll test
    await clearStrokes(pageIds[0]);

    // --- Scroll mode ---
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    const scrollBox = await visibleBox(page, ".touch-pan-y", 0);

    for (let i = 0; i < N; i++) {
      await drawQuickStroke(page, scrollBox, 0.1 + i * 0.15);
      // Same timing as single mode for fair comparison
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(4000);
    const scrollCount = await getStrokeCount(pageIds[0]);

    // Both modes should capture the same number of strokes
    expect(singleCount).toBe(N);
    expect(scrollCount).toBe(N);
  });

  test("rapid strokes in scroll mode are all captured", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    const box = await visibleBox(page, ".touch-pan-y", 0);

    // Draw 8 quick strokes with enough delay for pointer events and RAF to settle
    const TOTAL = 8;
    for (let i = 0; i < TOTAL; i++) {
      await drawQuickStroke(page, box, 0.05 + i * 0.1);
      await page.waitForTimeout(300);
    }

    // Wait for batch save to persist all strokes
    await page.waitForTimeout(5000);

    // Count strokes via API — authoritative check
    const pageIds = await getPageIds(notebookId);
    const apiCount = await getStrokeCount(pageIds[0]);
    expect(apiCount).toBe(TOTAL);

    // Verify SVG paths rendered in the first page match (no duplicates)
    const firstPage = page.locator(".bg-white.shadow-sm").first();
    const pathCount = await firstPage.locator("svg path").count();
    expect(pathCount).toBe(TOTAL);
  });

  test("no stroke duplication after batch save", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    const box = await page.locator(".touch-pan-y").first().boundingBox();
    if (!box) throw new Error("No bounding box");

    // Draw 3 strokes
    for (let i = 0; i < 3; i++) {
      await drawQuickStroke(page, box, 0.15 + i * 0.2);
      await page.waitForTimeout(150);
    }

    // Wait for batch save and WebSocket echo
    await page.waitForTimeout(5000);

    const firstPage = page.locator(".bg-white.shadow-sm").first();
    const pathCount = await firstPage.locator("svg path").count();
    const pageIds = await getPageIds(notebookId);
    const apiCount = await getStrokeCount(pageIds[0]);

    // SVG path count should match API count (no duplicates)
    expect(apiCount).toBe(3);
    expect(pathCount).toBe(apiCount);
  });

  test("stroke drawn during wheel scroll is not lost", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });

    const box = await page.locator(".touch-pan-y").first().boundingBox();
    if (!box) throw new Error("No bounding box");

    // Start drawing
    const x1 = box.x + box.width * 0.2;
    const x2 = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.4;
    await page.mouse.move(x1, y);
    await page.mouse.down();
    await page.mouse.move((x1 + x2) / 2, y, { steps: 3 });

    // Scroll mid-stroke
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(100);

    // Finish drawing
    await page.mouse.move(x2, y, { steps: 3 });
    await page.mouse.up();

    await page.waitForTimeout(4000);

    const pageIds = await getPageIds(notebookId);
    const count = await getStrokeCount(pageIds[0]);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("drawing on second page in scroll view works", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();

    const scrollContainer = page.locator(".overflow-y-auto.bg-gray-100");
    await expect(scrollContainer).toBeVisible({ timeout: 5000 });

    // Scroll to expose page 2
    const pageHeight = await page
      .locator(".bg-white.shadow-sm")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    await scrollContainer.evaluate(
      (el, h) => el.scrollTo(0, h + 48),
      pageHeight,
    );
    await page.waitForTimeout(500);

    // Draw on whatever is the first visible drawing layer now
    await expect(page.locator(".touch-pan-y").first()).toBeVisible({
      timeout: 5000,
    });
    await drawStroke(page, ".touch-pan-y");

    await page.waitForTimeout(4000);

    // Check that page 2 has the stroke
    const pageIds = await getPageIds(notebookId);
    const count2 = await getStrokeCount(pageIds[1]);
    expect(count2).toBeGreaterThanOrEqual(1);
  });
});
