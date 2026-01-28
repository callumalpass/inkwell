import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebookSingleMode,
  uniqueTitle,
  addStroke,
  getStrokeCount,
  clearStrokes,
  API,
} from "../helpers";

test.describe("WebSocket - Real-time updates", () => {
  let notebookId: string;
  let notebookTitle: string;
  let pageId: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E WebSocket"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    const pg = await addPage(notebookId);
    pageId = pg.id;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("receives stroke added via API in real-time", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Wait for WebSocket to connect
    await page.waitForTimeout(1000);

    // Verify no strokes initially
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0);

    // Add a stroke via the API (simulating another client)
    await addStroke(pageId);

    // The stroke should appear via WebSocket without refresh
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });
  });

  test("receives stroke deleted via API in real-time", async ({ page }) => {
    // Pre-add a stroke via API
    await addStroke(pageId);

    await openNotebookSingleMode(page, notebookTitle);

    // Wait for WebSocket to connect and stroke to load
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Get stroke ID from the API
    const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
    const strokes = (await res.json()) as { id: string }[];
    expect(strokes.length).toBeGreaterThan(0);
    const strokeId = strokes[0].id;

    // Delete the stroke via API
    await fetch(`${API}/api/pages/${pageId}/strokes/${strokeId}`, { method: "DELETE" });

    // The stroke should disappear via WebSocket without refresh
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });

  test("receives strokes cleared via API in real-time", async ({ page }) => {
    // Pre-add two strokes via API
    await addStroke(pageId);
    await addStroke(pageId);

    await openNotebookSingleMode(page, notebookTitle);

    // Wait for strokes to load
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(2, { timeout: 5000 });

    // Clear all strokes via API
    await clearStrokes(pageId);

    // All strokes should disappear via WebSocket without refresh
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe("WebSocket - Connection Handling", () => {
  let notebookId: string;
  let notebookTitle: string;
  let pageId: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E WS Connect"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    const pg = await addPage(notebookId);
    pageId = pg.id;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("WebSocket reconnects after network interruption", async ({ page, context }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Wait for initial WebSocket connection
    await page.waitForTimeout(1500);

    // Add a stroke via API to verify WebSocket is working
    await addStroke(pageId);
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Simulate network interruption - go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Come back online
    await context.setOffline(false);

    // Wait for WebSocket to reconnect (exponential backoff starts at 1s)
    await page.waitForTimeout(3000);

    // Add another stroke via API - should be received if WebSocket reconnected
    await addStroke(pageId);

    // Should now have 2 strokes rendered
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(2, { timeout: 5000 });
  });

  test("WebSocket handles blocked connection gracefully", async ({ page }) => {
    // Block WebSocket connections
    await page.route("**/ws/page/**", (route) => route.abort());

    await openNotebookSingleMode(page, notebookTitle);

    // Wait a moment to ensure connection attempts
    await page.waitForTimeout(2000);

    // The page should still function - can load strokes via API
    const strokeCount = await getStrokeCount(pageId);
    expect(strokeCount).toBe(0);

    // Should be able to add strokes via API without WebSocket
    await addStroke(pageId);
    const newCount = await getStrokeCount(pageId);
    expect(newCount).toBe(1);
  });
});

test.describe("WebSocket - Multi-page", () => {
  let notebookId: string;
  let notebookTitle: string;
  let pageId1: string;
  let pageId2: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E WS Multi"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    const pg1 = await addPage(notebookId);
    pageId1 = pg1.id;
    const pg2 = await addPage(notebookId);
    pageId2 = pg2.id;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("scroll view receives updates for all visible pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();
    await page.getByText(notebookTitle).first().click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to scroll view
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });

    // Wait for WebSocket connections to establish for both pages
    await page.waitForTimeout(1500);

    // Add strokes to both pages via API
    await addStroke(pageId1);
    await addStroke(pageId2);

    // Both strokes should appear via WebSocket
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(2, { timeout: 5000 });
  });

  test("canvas view receives updates for visible pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();
    await page.getByText(notebookTitle).first().click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Switch to canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.locator(".relative.flex-1.overflow-hidden.bg-gray-200")).toBeVisible({ timeout: 5000 });

    // Wait for WebSocket connections
    await page.waitForTimeout(1500);

    // Add a stroke to page 1 via API
    await addStroke(pageId1);

    // Stroke should appear on page 1's surface
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });
  });

  test("page navigation updates WebSocket subscription", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Wait for initial WebSocket to connect
    await page.waitForTimeout(1500);

    // Verify we're on page 1
    await expect(page.getByText("1/2")).toBeVisible();

    // Add a stroke to page 1 via API
    await addStroke(pageId1);
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });

    // Navigate to page 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("2/2")).toBeVisible();

    // Wait for WebSocket to reconnect for new page
    await page.waitForTimeout(1500);

    // Page 2 should have no strokes
    await expect(page.locator(".bg-white.shadow-sm svg path")).toHaveCount(0);

    // Add a stroke to page 2 via API
    await addStroke(pageId2);
    await expect(page.locator(".bg-white.shadow-sm svg path")).toBeVisible({ timeout: 5000 });
  });
});
