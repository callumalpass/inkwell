import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  addStroke,
  getStrokeCount,
  uniqueTitle,
  API,
} from "../helpers";

test.describe("Page Actions - Duplicate", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Duplicate"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can duplicate a page from toolbar", async ({ page }) => {
    const pg = await addPage(notebookId);
    // Add some strokes to the page
    await addStroke(pg.id);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Store original URL
    const originalUrl = page.url();

    // Click Duplicate button in toolbar (use testid for precision)
    await page.getByTestId("toolbar-duplicate").click();

    // Wait for navigation to the new page (different page ID)
    await page.waitForFunction(
      (origUrl) => window.location.href !== origUrl,
      originalUrl,
      { timeout: 5000 }
    );

    // Verify we're on a different page (new page ID)
    expect(page.url()).not.toBe(originalUrl);
    expect(page.url()).not.toContain(pg.id);

    // Go to overview and verify there are now 2 pages
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(2);
  });

  test("can duplicate multiple pages from overview", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have 2 pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(2);

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();

    // Click Duplicate in overview view
    await page.getByTestId("overview-view").getByRole("button", { name: "Duplicate" }).click();

    // Wait for toast
    await expect(page.getByText(/Duplicated \d+ page/)).toBeVisible();

    // Should now have 4 pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(4);
  });

  test("duplicate button is disabled when no pages selected in overview", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    const duplicateButton = page.getByTestId("overview-view").getByRole("button", { name: "Duplicate" });
    await expect(duplicateButton).toBeDisabled();
  });
});

test.describe("Page Actions - Clear Page", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Clear"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows confirmation dialog when clearing page", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Click Clear button in toolbar
    await page.getByRole("button", { name: "Clear" }).first().click();

    // Confirmation dialog should appear
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await expect(page.getByText("Clear page")).toBeVisible();
    await expect(page.getByText("Are you sure you want to clear all strokes")).toBeVisible();
  });

  test("can cancel clear page action", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Click Clear button
    await page.getByRole("button", { name: "Clear" }).first().click();

    // Confirmation dialog should appear
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();

    // Click Cancel
    await page.getByTestId("confirm-dialog-cancel").click();

    // Dialog should close
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();

    // Stroke should still exist
    const strokeCount = await getStrokeCount(pg.id);
    expect(strokeCount).toBe(1);
  });

  test("can clear all strokes from a page", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);
    await addStroke(pg.id);
    await addStroke(pg.id);

    // Verify strokes exist
    const initialCount = await getStrokeCount(pg.id);
    expect(initialCount).toBe(3);

    await openNotebook(page, notebookTitle);

    // Click Clear button
    await page.getByRole("button", { name: "Clear" }).first().click();

    // Confirm in dialog
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Wait for success toast
    await expect(page.getByText("Page cleared")).toBeVisible();

    // Verify strokes are gone
    const finalCount = await getStrokeCount(pg.id);
    expect(finalCount).toBe(0);
  });
});

test.describe("Page Actions - Batch Transcription", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Transcribe"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can see Transcribe button in overview when pages are selected", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Transcribe button should be enabled (use exact: true to avoid matching "Transcribe All")
    const transcribeButton = page.getByTestId("overview-view").getByRole("button", { name: "Transcribe", exact: true });
    await expect(transcribeButton).toBeEnabled();
  });

  test("Transcribe button is disabled when no pages selected", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    const transcribeButton = page.getByTestId("overview-view").getByRole("button", { name: "Transcribe", exact: true });
    await expect(transcribeButton).toBeDisabled();
  });

  test("Transcribe All button is always enabled", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    const transcribeAllButton = page.getByRole("button", { name: "Transcribe All" });
    await expect(transcribeAllButton).toBeEnabled();
  });

  test("clicking Transcribe shows queuing toast", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select all pages
    await page.getByRole("button", { name: "Select All" }).click();

    // Click Transcribe (use exact: true to avoid matching "Transcribe All")
    await page.getByTestId("overview-view").getByRole("button", { name: "Transcribe", exact: true }).click();

    // Should show info toast about queuing
    await expect(page.getByText(/Queuing \d+ page/)).toBeVisible();
  });

  test("clicking Transcribe All shows queuing toast", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Click Transcribe All
    await page.getByRole("button", { name: "Transcribe All" }).click();

    // Should show info toast
    await expect(page.getByText("Queuing all pages")).toBeVisible();
  });
});

test.describe("Error Boundary", () => {
  test("app has error boundary wrapper", async ({ page }) => {
    // Just verify the app loads without an error boundary being triggered
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // The error boundary should not be visible during normal operation
    await expect(page.getByTestId("error-boundary")).not.toBeVisible();
  });
});

test.describe("Toast Notifications", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Toast"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("shows success toast when page is cleared", async ({ page }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    await openNotebook(page, notebookTitle);

    // Clear page
    await page.getByRole("button", { name: "Clear" }).first().click();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Success toast should appear
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByText("Page cleared")).toBeVisible();
  });

  test("shows success toast when pages are duplicated", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Duplicate
    await page.getByTestId("overview-view").getByRole("button", { name: "Duplicate" }).click();

    // Success toast should appear
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByText(/Duplicated \d+ page/)).toBeVisible();
  });
});
