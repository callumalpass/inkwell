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

async function writeTranscription(pageId: string, content: string) {
  await fetch(`${API}/api/pages/${pageId}/transcription`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function deleteNotebook(id: string) {
  await fetch(`${API}/api/notebooks/${id}`, { method: "DELETE" });
}

test.describe("Search", () => {
  let notebookId: string;
  let notebookTitle: string;
  let pageId: string;
  const uniqueToken = `searchtoken_${Date.now()}`;

  test.beforeEach(async () => {
    notebookTitle = `E2E Search ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nb = await createNotebook(notebookTitle);
    notebookId = nb.id;
    const pg = await addPage(notebookId);
    pageId = pg.id;

    // Write a transcription via the API so search can find it
    await writeTranscription(
      pageId,
      `Meeting notes about ${uniqueToken}\n\nDiscussed project timeline and budget allocation.`,
    );
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("open search dialog, type query, and see results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click the Search button
    await page.getByTestId("search-button").click();

    // Search dialog should open
    const dialog = page.getByTestId("search-dialog");
    await expect(dialog).toBeVisible();

    // Input should be focused
    const input = page.getByTestId("search-input");
    await expect(input).toBeFocused();

    // Initially shows the hint
    await expect(page.getByTestId("search-hint")).toBeVisible();

    // Type the unique search token
    await input.fill(uniqueToken);

    // Wait for results to appear (debounced)
    await expect(page.getByTestId("search-count")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("search-count")).toHaveText("1 result");

    // Result card should show notebook name
    const result = page.getByTestId("search-result").first();
    await expect(result).toBeVisible();
    await expect(result).toContainText(notebookTitle);

    // Excerpt should contain the search token
    const excerpt = page.getByTestId("search-excerpt").first();
    await expect(excerpt).toContainText(uniqueToken);
  });

  test("clicking a search result navigates to the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    await page.getByTestId("search-input").fill(uniqueToken);
    await expect(page.getByTestId("search-result").first()).toBeVisible({
      timeout: 5000,
    });

    // Click the result
    await page.getByTestId("search-result").first().click();

    // Should navigate to the writing page
    await page.waitForURL(/\/notebook\/nb_.*\/page\/pg_/);
  });

  test("shows empty state for no results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Search for something that doesn't exist
    await page.getByTestId("search-input").fill("xyznonexistent9999");

    // Should show empty state
    await expect(page.getByTestId("search-empty")).toBeVisible({ timeout: 5000 });
  });

  test("Escape key closes search dialog", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-dialog")).not.toBeVisible();
  });

  test("Ctrl+K opens search dialog", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("clear button resets search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await page.getByTestId("search-input").fill(uniqueToken);

    // Wait for results
    await expect(page.getByTestId("search-count")).toBeVisible({ timeout: 5000 });

    // Click clear
    await page.getByTestId("search-clear").click();

    // Input should be empty
    await expect(page.getByTestId("search-input")).toHaveValue("");

    // Should show the hint again (not results)
    await expect(page.getByTestId("search-hint")).toBeVisible();
  });
});
