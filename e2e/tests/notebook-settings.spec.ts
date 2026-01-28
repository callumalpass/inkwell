import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  openNotebookSingleMode,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Notebook Settings Dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Settings"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("open and close notebook settings dialog", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Click the Settings toolbar button
    await page.getByTestId("toolbar-notebook-settings").click();

    // Dialog should open
    const dialog = page.getByTestId("notebook-settings-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Notebook Settings")).toBeVisible();
    await expect(dialog.getByText("Defaults for this notebook")).toBeVisible();

    // Close via the Close button
    await page.getByTestId("notebook-settings-close").click();
    await expect(dialog).not.toBeVisible();
  });

  test("settings dialog shows tool, color, width, and grid options", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-notebook-settings").click();
    const dialog = page.getByTestId("notebook-settings-dialog");
    await expect(dialog).toBeVisible();

    // Tool options
    await expect(page.getByTestId("nb-setting-tool-pen")).toBeVisible();
    await expect(page.getByTestId("nb-setting-tool-highlighter")).toBeVisible();
    await expect(page.getByTestId("nb-setting-tool-eraser")).toBeVisible();

    // Color options
    await expect(page.getByTestId("nb-setting-color-black")).toBeVisible();
    await expect(page.getByTestId("nb-setting-color-blue")).toBeVisible();
    await expect(page.getByTestId("nb-setting-color-red")).toBeVisible();

    // Width options
    await expect(page.getByTestId("nb-setting-width-2")).toBeVisible();
    await expect(page.getByTestId("nb-setting-width-3")).toBeVisible();
    await expect(page.getByTestId("nb-setting-width-5")).toBeVisible();
    await expect(page.getByTestId("nb-setting-width-8")).toBeVisible();

    // Grid options
    await expect(page.getByTestId("nb-setting-grid-none")).toBeVisible();
    await expect(page.getByTestId("nb-setting-grid-lined")).toBeVisible();
    await expect(page.getByTestId("nb-setting-grid-grid")).toBeVisible();
    await expect(page.getByTestId("nb-setting-grid-dotgrid")).toBeVisible();
  });

  test("change default tool setting", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();

    // Select highlighter as default tool
    await page.getByTestId("nb-setting-tool-highlighter").click();

    // Close dialog
    await page.getByTestId("notebook-settings-close").click();

    // Verify via API that the setting was saved
    const res = await fetch(`${API}/api/notebooks/${notebookId}`);
    const notebook = (await res.json()) as { settings?: { defaultTool?: string } };
    expect(notebook.settings?.defaultTool).toBe("highlighter");
  });

  test("change default color setting", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();

    // Select blue as default color
    await page.getByTestId("nb-setting-color-blue").click();

    // Close dialog
    await page.getByTestId("notebook-settings-close").click();

    // Verify via API
    const res = await fetch(`${API}/api/notebooks/${notebookId}`);
    const notebook = (await res.json()) as { settings?: { defaultColor?: string } };
    expect(notebook.settings?.defaultColor).toBe("#1e40af");
  });

  test("change default width setting", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();

    // Select width 8
    await page.getByTestId("nb-setting-width-8").click();

    // Close dialog
    await page.getByTestId("notebook-settings-close").click();

    // Verify via API
    const res = await fetch(`${API}/api/notebooks/${notebookId}`);
    const notebook = (await res.json()) as { settings?: { defaultStrokeWidth?: number } };
    expect(notebook.settings?.defaultStrokeWidth).toBe(8);
  });

  test("change grid type setting", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();

    // Select grid
    await page.getByTestId("nb-setting-grid-grid").click();

    // Close dialog
    await page.getByTestId("notebook-settings-close").click();

    // Verify via API
    const res = await fetch(`${API}/api/notebooks/${notebookId}`);
    const notebook = (await res.json()) as { settings?: { gridType?: string } };
    expect(notebook.settings?.gridType).toBe("grid");
  });

  test("settings persist after page reload", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Set a distinctive combination of settings, waiting for each to settle
    // since updateSettings is async and concurrent clicks can race
    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();

    await page.getByTestId("nb-setting-tool-eraser").click();
    await page.getByTestId("nb-setting-color-red").click();
    // Wait for the previous PATCH calls to settle before changing more
    await page.waitForTimeout(200);

    await page.getByTestId("nb-setting-width-5").click();
    await page.getByTestId("nb-setting-grid-dotgrid").click();
    // Allow the final PATCH to complete
    await page.waitForTimeout(200);

    await page.getByTestId("notebook-settings-close").click();

    // Reload the page
    await page.reload();
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await expect(page.getByRole("button", { name: "pen", exact: true })).toBeVisible();

    // Verify via API that all settings persisted
    const res = await fetch(`${API}/api/notebooks/${notebookId}`);
    const notebook = (await res.json()) as {
      settings?: {
        defaultTool?: string;
        defaultColor?: string;
        defaultStrokeWidth?: number;
        gridType?: string;
      };
    };
    expect(notebook.settings?.defaultTool).toBe("eraser");
    expect(notebook.settings?.defaultColor).toBe("#dc2626");
    expect(notebook.settings?.defaultStrokeWidth).toBe(5);
    expect(notebook.settings?.gridType).toBe("dotgrid");
  });

  test("grid setting affects the page background", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Open settings and set grid to lined
    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();
    await page.getByTestId("nb-setting-grid-lined").click();
    await page.getByTestId("notebook-settings-close").click();

    // The lined pattern should appear on the page background
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(1, { timeout: 5000 });

    // Switch to grid
    await page.getByTestId("toolbar-notebook-settings").click();
    await expect(page.getByTestId("notebook-settings-dialog")).toBeVisible();
    await page.getByTestId("nb-setting-grid-grid").click();
    await page.getByTestId("notebook-settings-close").click();

    // Grid pattern should now be present
    await expect(page.locator("svg pattern#grid-pattern")).toHaveCount(1, { timeout: 5000 });
    // Lined pattern should be gone
    await expect(page.locator("svg pattern#lined-pattern")).toHaveCount(0);
  });
});
