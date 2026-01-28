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

async function addStroke(pageId: string) {
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
            [100, 200, 0.8, Date.now()],
            [150, 250, 0.85, Date.now() + 5],
            [200, 300, 0.9, Date.now() + 10],
          ],
        },
      ],
    }),
  });
}

async function deleteNotebook(id: string) {
  await fetch(`${API}/api/notebooks/${id}`, { method: "DELETE" });
}

test.describe("Export - Page export from toolbar", () => {
  let notebookId: string;
  let notebookTitle: string;
  let pageId: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(
      `E2E Export ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );
    notebookId = nb.id;
    notebookTitle = nb.title;
    const pg = await addPage(notebookId);
    pageId = pg.id;
    await addStroke(pageId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("opens export dialog from toolbar and exports page as PDF", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Navigate to the notebook's writing page
    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Click the Export button in toolbar
    const exportBtn = page.getByTestId("toolbar-export");
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // The export dialog should appear
    const dialog = page.getByTestId("export-dialog");
    await expect(dialog).toBeVisible();

    // Title should say "Export Page"
    await expect(dialog.getByText("Export Page")).toBeVisible();

    // Format selector should be visible (PDF selected by default)
    await expect(page.getByTestId("format-pdf")).toBeVisible();
    await expect(page.getByTestId("format-png")).toBeVisible();

    // PDF options should be visible
    await expect(page.getByTestId("pagesize-original")).toBeVisible();
    await expect(page.getByTestId("pagesize-a4")).toBeVisible();
    await expect(page.getByTestId("include-transcription")).toBeVisible();

    // Set up download listener and click Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-submit").click();

    // Verify a download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/pg_.*\.pdf$/);

    // Dialog should close after successful export
    await expect(dialog).not.toBeVisible();
  });

  test("exports page as PNG with selected scale", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Open export dialog
    await page.getByTestId("toolbar-export").click();
    await expect(page.getByTestId("export-dialog")).toBeVisible();

    // Switch to PNG format
    await page.getByTestId("format-png").click();

    // PNG options should appear
    await expect(page.getByTestId("scale-1")).toBeVisible();
    await expect(page.getByTestId("scale-2")).toBeVisible();

    // PDF options should be hidden
    await expect(page.getByTestId("pagesize-original")).not.toBeVisible();

    // Select 3x scale
    await page.getByTestId("scale-3").click();

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-submit").click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/pg_.*\.png$/);
  });

  test("cancel button closes the export dialog", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByText(notebookTitle).click();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    await page.getByTestId("toolbar-export").click();
    await expect(page.getByTestId("export-dialog")).toBeVisible();

    await page.getByTestId("export-cancel").click();
    await expect(page.getByTestId("export-dialog")).not.toBeVisible();
  });
});

test.describe("Export - Notebook export from notebook list", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(
      `E2E NB Export ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create a page with strokes so the PDF is non-empty
    const pg = await addPage(notebookId);
    await addStroke(pg.id);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("opens export dialog for notebook from notebook card", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Find the notebook card and click its export button
    const heading = page.getByRole("heading", { name: notebookTitle });
    await expect(heading).toBeVisible();
    const card = heading.locator("../..");
    await card.getByRole("button", { name: "Export notebook" }).click();

    // The export dialog should open
    const dialog = page.getByTestId("export-dialog");
    await expect(dialog).toBeVisible();

    // Title should say "Export Notebook"
    await expect(dialog.getByText("Export Notebook")).toBeVisible();

    // No format selector (notebook export is PDF only)
    await expect(page.getByTestId("format-pdf")).not.toBeVisible();

    // PDF options should be visible
    await expect(page.getByTestId("pagesize-original")).toBeVisible();
    await expect(page.getByTestId("include-transcription")).toBeVisible();

    // Export as PDF
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-submit").click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test("notebook export with A4 page size", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    const heading = page.getByRole("heading", { name: notebookTitle });
    await expect(heading).toBeVisible();
    const card = heading.locator("../..");
    await card.getByRole("button", { name: "Export notebook" }).click();

    await expect(page.getByTestId("export-dialog")).toBeVisible();

    // Select A4 page size
    await page.getByTestId("pagesize-a4").click();

    // Check include transcription
    await page.getByTestId("include-transcription").check();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-submit").click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
