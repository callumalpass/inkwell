import { expect, type Page } from "@playwright/test";

export const API = "http://localhost:3001";

export async function createNotebook(title: string) {
  const res = await fetch(`${API}/api/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return (await res.json()) as { id: string; title: string };
}

export async function addPage(notebookId: string) {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`, {
    method: "POST",
  });
  return (await res.json()) as { id: string };
}

export async function deleteNotebook(id: string) {
  await fetch(`${API}/api/notebooks/${id}`, { method: "DELETE" });
}

export async function updateNotebook(id: string, updates: Record<string, unknown>) {
  await fetch(`${API}/api/notebooks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function getPageIds(notebookId: string): Promise<string[]> {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`);
  const pages = (await res.json()) as { id: string }[];
  return pages.map((p) => p.id);
}

export async function getStrokeCount(pageId: string): Promise<number> {
  const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
  const strokes = (await res.json()) as unknown[];
  return strokes.length;
}

export async function getStrokes(pageId: string) {
  const res = await fetch(`${API}/api/pages/${pageId}/strokes`);
  return (await res.json()) as unknown[];
}

export async function getPages(notebookId: string) {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`);
  return (await res.json()) as { id: string }[];
}

export async function writeTranscription(pageId: string, content: string) {
  await fetch(`${API}/api/pages/${pageId}/transcription`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function addStroke(pageId: string) {
  await fetch(`${API}/api/pages/${pageId}/strokes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      strokes: [
        {
          id: `st_e2e_${Date.now()}`,
          timestamp: Date.now(),
          tool: "pen",
          color: "#000000",
          width: 2,
          points: [
            { x: 100, y: 200, pressure: 0.8 },
            { x: 150, y: 250, pressure: 0.85 },
            { x: 200, y: 300, pressure: 0.9 },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  });
}

/** Clear all strokes for a page via the API. */
export async function clearStrokes(pageId: string) {
  await fetch(`${API}/api/pages/${pageId}/strokes`, { method: "DELETE" });
}

/** Find the drawing layer regardless of view mode (touch-none or touch-pan-y). */
export const DRAWING_LAYER = "[class*='touch-']";

export async function drawStroke(page: Page, selector: string) {
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

/** Navigate to a notebook's writing page and wait for toolbar + drawing surface. */
export async function openNotebook(page: Page, notebookTitle: string) {
  await page.goto("/");
  await expect(page.getByText("Notebooks")).toBeVisible();
  await page.getByText(notebookTitle).first().click();
  await page.waitForURL(/\/notebook\/nb_.*\/page\//);
  // Wait for toolbar
  await expect(page.getByRole("button", { name: "pen" })).toBeVisible();
}

/** Navigate to notebook and switch to single page mode for consistent drawing layer. */
export async function openNotebookSingleMode(page: Page, notebookTitle: string) {
  await openNotebook(page, notebookTitle);
  await page.getByRole("button", { name: "Single" }).click();
  await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
}

/**
 * Draw a short horizontal stroke within a bounding box.
 * Uses enough steps to guarantee multiple points in the stroke buffer,
 * preventing rejection by the < 2 point guard in endStroke.
 */
export async function drawQuickStroke(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  yOffset: number,
) {
  const x1 = box.x + box.width * 0.2;
  const x2 = box.x + box.width * 0.5;
  const y = box.y + box.height * yOffset;
  await page.mouse.move(x1, y);
  await page.mouse.down();
  await page.mouse.move(x2, y, { steps: 5 });
  await page.mouse.up();
}

/**
 * Return the portion of the element's bounding box that is visible within the
 * viewport. In scroll mode the page canvas can extend below the fold, so
 * Playwright pointer events targeted at those coordinates won't fire.
 */
export async function visibleBox(
  page: Page,
  selector: string,
  index = 0,
) {
  const el = page.locator(selector).nth(index);
  const box = await el.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector} [${index}]`);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size");
  const bottom = Math.min(box.y + box.height, viewport.height);
  return { x: box.x, y: box.y, width: box.width, height: bottom - box.y };
}

/** Generate a unique notebook title for E2E tests. */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
