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

async function getStrokes(pageId: string) {
  const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
  return (await res.json()) as unknown[];
}

async function getPages(notebookId: string) {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`);
  return (await res.json()) as { id: string }[];
}

test.describe("Offline support", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(`E2E Offline ${Date.now()}`);
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows syncing indicator when strokes are queued offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Should NOT show offline indicator when online
    await expect(page.getByTestId("offline-indicator")).not.toBeVisible();

    // Block the strokes API endpoint to simulate server unavailability
    // (this is more reliable than context.setOffline which may not trigger browser events)
    await page.route("**/api/pages/*/strokes", (route) => route.abort("connectionfailed"));

    // Draw a stroke — the batch save will fail and queue to IndexedDB
    await drawStroke(page, ".touch-none");
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for the batch save interval (2s) to trigger and fail
    await page.waitForTimeout(3500);

    // The syncing indicator should appear (yellow dot with "Syncing N batch(es)...")
    await expect(page.getByTestId("offline-indicator")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Syncing \d+ batch/)).toBeVisible();

    // Unblock the API endpoint
    await page.unroute("**/api/pages/*/strokes");

    // Wait for the offline sync to drain the queue (5s interval + buffer)
    await page.waitForTimeout(8000);

    // Offline indicator should disappear after successful sync
    await expect(page.getByTestId("offline-indicator")).not.toBeVisible({ timeout: 10000 });
  });

  test("strokes drawn offline are queued and synced when back online", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Wait for initial load to finish
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toBeVisible({ timeout: 5000 });

    // Draw a stroke while offline
    await drawStroke(page, ".touch-none");

    // SVG path should appear locally (rendered immediately)
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for the batch save interval to trigger (2s) + a buffer
    await page.waitForTimeout(3500);

    // Get page ID from URL
    const url = page.url();
    const pageIdMatch = url.match(/page\/(pg_[^/]+)/);
    const pageId = pageIdMatch?.[1];
    expect(pageId).toBeTruthy();

    // Go back online — strokes should sync
    await context.setOffline(false);

    // Wait for the sync interval (5s) + buffer
    await page.waitForTimeout(7000);

    // Verify strokes were synced to the server
    const strokes = await getStrokes(pageId!);
    expect(strokes.length).toBeGreaterThan(0);
  });

  test("strokes persist across reload after offline sync", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    await page.waitForTimeout(1000);

    // Go offline and draw
    await context.setOffline(true);
    await drawStroke(page, ".touch-none");
    await expect(page.locator("svg path")).toBeVisible({ timeout: 5000 });

    // Wait for batch save to queue the strokes
    await page.waitForTimeout(3500);

    // Go back online and wait for sync
    await context.setOffline(false);
    await page.waitForTimeout(7000);

    // Reload the page — strokes should still be there (they were synced to server)
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await expect(page.locator("svg path")).toBeVisible({ timeout: 10000 });
  });

  test("drawing works continuously while offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Draw multiple strokes while offline
    const target = page.locator(".touch-none").first();
    const box = await target.boundingBox();
    if (!box) throw new Error("No bounding box");

    // Draw 3 separate strokes
    for (let i = 0; i < 3; i++) {
      const startX = box.x + box.width * (0.2 + i * 0.2);
      const startY = box.y + box.height * 0.3;
      const endX = startX + 40;
      const endY = startY + 60;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 5 });
      await page.mouse.up();

      // Small delay between strokes
      await page.waitForTimeout(200);
    }

    // All strokes should be rendered locally
    const pathCount = await page.locator("svg path").count();
    expect(pathCount).toBeGreaterThanOrEqual(3);

    // Go back online and wait for sync
    await context.setOffline(false);
    await page.waitForTimeout(7000);

    // Verify all strokes synced to server
    const url = page.url();
    const pageIdMatch = url.match(/page\/(pg_[^/]+)/);
    const pageId = pageIdMatch?.[1];
    const strokes = await getStrokes(pageId!);
    expect(strokes.length).toBeGreaterThanOrEqual(3);
  });
});
