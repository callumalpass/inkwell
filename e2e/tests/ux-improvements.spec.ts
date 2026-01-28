import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  openNotebookSingleMode,
  uniqueTitle,
} from "../helpers";

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

  test("shows success toast after bulk tagging", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Add tags
    await page.getByTestId("overview-view").getByRole("button", { name: "Add Tags" }).click();
    const tagInput = page.locator('input[placeholder="meeting, project-x"]');
    await tagInput.fill("test-tag");
    await page.getByRole("button", { name: "Apply" }).click();

    // Should show success toast
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByText(/Added tags to 1 page/)).toBeVisible();
  });

  test("shows success toast after page deletion", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Confirm in dialog
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Should show success toast
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByText(/Deleted 1 page/)).toBeVisible();
  });

  test("toast can be dismissed by clicking X", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select and add tags to trigger a toast
    await page.locator('input[type="checkbox"]').first().click();
    await page.getByTestId("overview-view").getByRole("button", { name: "Add Tags" }).click();
    const tagInput = page.locator('input[placeholder="meeting, project-x"]');
    await tagInput.fill("dismiss-test");
    await page.getByRole("button", { name: "Apply" }).click();

    // Toast should appear
    await expect(page.getByTestId("toast-success")).toBeVisible();

    // Click dismiss button
    await page.getByLabel("Dismiss").click();

    // Toast should disappear
    await expect(page.getByTestId("toast-success")).not.toBeVisible();
  });
});

test.describe("Confirm Dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Confirm"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("delete shows confirm dialog instead of native confirm", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have two pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(2);

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Should show custom confirm dialog, not native
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await expect(page.getByText("Delete pages")).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete 1 page/)).toBeVisible();
  });

  test("confirm dialog - cancel does not delete", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Cancel in dialog
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-cancel").click();

    // Dialog should close
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();

    // Page should still exist
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });

  test("confirm dialog - confirm deletes the page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Verify we have two pages
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(2);

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Confirm in dialog
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Dialog should close
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();

    // Should only have one page now
    await expect(page.locator('img[alt^="Page"]')).toHaveCount(1);
  });

  test("confirm dialog can be closed by clicking overlay", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Click on overlay background to dismiss
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-overlay").click({ position: { x: 10, y: 10 } });

    // Dialog should close
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();
  });

  test("confirm dialog can be closed by pressing Escape", async ({ page }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select page
    await page.locator('input[type="checkbox"]').first().click();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // Press Escape
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Dialog should close
    await expect(page.getByTestId("confirm-dialog")).not.toBeVisible();
  });
});

test.describe("Keyboard Shortcuts Help Dialog", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Shortcuts Help"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("? key opens shortcuts dialog from notebooks page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Press ? key
    await page.keyboard.press("Shift+?");

    // Shortcuts dialog should open
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
  });

  test("? key opens shortcuts dialog from writing view", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Press ? key
    await page.keyboard.press("Shift+?");

    // Shortcuts dialog should open
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
  });

  test("shortcuts dialog shows all shortcut groups", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open dialog
    await page.keyboard.press("Shift+?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();

    // Check for shortcut groups
    await expect(page.getByText("Global")).toBeVisible();
    await expect(page.getByText("Drawing")).toBeVisible();
    await expect(page.getByText("Canvas View")).toBeVisible();
    await expect(page.getByText("Page View")).toBeVisible();
  });

  test("shortcuts dialog shows Cmd+K for search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open dialog
    await page.keyboard.press("Shift+?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();

    // Check for Cmd+K shortcut
    await expect(page.getByText("Open search")).toBeVisible();
    await expect(page.locator("kbd", { hasText: "Cmd" })).toBeVisible();
    await expect(page.locator("kbd", { hasText: "K" })).toBeVisible();
  });

  test("shortcuts dialog can be closed with X button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open dialog
    await page.keyboard.press("Shift+?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();

    // Click close button
    await page.getByTestId("shortcuts-dialog-close").click();

    // Dialog should close
    await expect(page.getByTestId("shortcuts-dialog")).not.toBeVisible();
  });

  test("shortcuts dialog can be closed with Escape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open dialog
    await page.keyboard.press("Shift+?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Dialog should close
    await expect(page.getByTestId("shortcuts-dialog")).not.toBeVisible();
  });

  test("shortcuts dialog can be closed by clicking overlay", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Open dialog
    await page.keyboard.press("Shift+?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();

    // Click overlay
    await page.getByTestId("shortcuts-dialog-overlay").click({ position: { x: 10, y: 10 } });

    // Dialog should close
    await expect(page.getByTestId("shortcuts-dialog")).not.toBeVisible();
  });
});

test.describe("Cmd+K Search in Writing View", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E WritingSearch"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("Ctrl+K opens search from single page view", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Press Ctrl+K
    await page.keyboard.press("Control+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeFocused();
  });

  test("Cmd+K opens search from single page view on macOS", async ({ page }) => {
    await openNotebookSingleMode(page, notebookTitle);

    // Press Cmd+K
    await page.keyboard.press("Meta+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("Ctrl+K opens search from canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.getByTestId("canvas-view")).toBeVisible();

    // Press Ctrl+K
    await page.keyboard.press("Control+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("Ctrl+K opens search from overview view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Press Ctrl+K
    await page.keyboard.press("Control+k");

    // Search dialog should open
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("search from writing view navigates to result", async ({ page }) => {
    // Create a second notebook with known content
    const targetNb = await createNotebook(uniqueTitle("E2E SearchTarget"));
    const targetPage = await addPage(targetNb.id);

    // Write transcription to target page
    const searchToken = `searchme_${Date.now()}`;
    await fetch(`http://localhost:3001/api/pages/${targetPage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcription: { status: "complete", lastAttempt: new Date().toISOString(), error: null },
      }),
    });
    await fetch(`http://localhost:3001/api/pages/${targetPage.id}/transcription`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `Notes about ${searchToken}` }),
    });

    // Start in first notebook
    await openNotebookSingleMode(page, notebookTitle);

    // Open search
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Search for token
    await page.getByTestId("search-input").fill(searchToken);

    // Wait for and click result
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });
    await page.getByTestId("search-result").first().click();

    // Should navigate to target page
    await page.waitForURL(new RegExp(`/page/${targetPage.id}`));

    // Cleanup
    await deleteNotebook(targetNb.id);
  });
});
