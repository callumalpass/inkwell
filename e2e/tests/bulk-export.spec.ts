import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
  addStroke,
} from "../helpers";

test.describe("Bulk Export - Progress Bar", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Bulk Export"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows progress bar during multi-page export", async ({ page }) => {
    // Create 3 pages with some content
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);
    const page3 = await addPage(notebookId);

    // Add strokes to make export take a bit longer
    await addStroke(page1.id);
    await addStroke(page2.id);
    await addStroke(page3.id);

    await openNotebook(page, notebookTitle);

    // Switch to Overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();
    await expect(page.getByText("Selected: 3")).toBeVisible();

    // Click Export
    await page.getByTestId("overview-view").getByRole("button", { name: "Export" }).click();

    // Export dialog should appear
    await expect(page.getByRole("heading", { name: "Export 3 pages" })).toBeVisible();

    // Click Export button to start
    await page.getByTestId("export-submit").click();

    // Progress text should show (indicates progress UI is visible)
    await expect(page.getByText(/of 3/)).toBeVisible();

    // Progress bar container should be visible
    await expect(page.getByTestId("export-progress-bar")).toBeAttached();

    // Wait for export to complete (dialog closes)
    await expect(page.getByRole("heading", { name: "Export 3 pages" })).not.toBeVisible({ timeout: 30000 });
  });

  test("progress bar shows correct count during export", async ({ page }) => {
    // Create 2 pages
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);
    await addStroke(page1.id);
    await addStroke(page2.id);

    await openNotebook(page, notebookTitle);

    // Switch to Overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();

    // Click Export
    await page.getByTestId("overview-view").getByRole("button", { name: "Export" }).click();

    // Dialog should show 2 pages
    await expect(page.getByRole("heading", { name: "Export 2 pages" })).toBeVisible();

    // Start export
    await page.getByTestId("export-submit").click();

    // Progress should show "of 2"
    await expect(page.getByText(/of 2/)).toBeVisible();

    // Wait for completion
    await expect(page.getByRole("heading", { name: /Export/ })).not.toBeVisible({ timeout: 30000 });
  });

  test("export button shows Exporting... during export", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Switch to Overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select the page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByTestId("overview-view").getByRole("button", { name: "Export" }).click();

    // Start export
    const exportButton = page.getByTestId("export-submit");
    await expect(exportButton).toHaveText("Export");

    await exportButton.click();

    // Button should show "Exporting..."
    await expect(exportButton).toHaveText("Exporting...");

    // Wait for completion
    await expect(page.getByRole("heading", { name: /Export/ })).not.toBeVisible({ timeout: 30000 });
  });

  test("cancel button is disabled during export", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Switch to Overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select the page
    await page.locator('input[type="checkbox"]').first().click();

    // Click Export
    await page.getByTestId("overview-view").getByRole("button", { name: "Export" }).click();

    // Start export
    await page.getByTestId("export-submit").click();

    // Cancel button should be disabled during export
    const cancelButton = page.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeDisabled();
  });
});
