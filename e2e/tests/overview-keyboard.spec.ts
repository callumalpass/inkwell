import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Overview View - Keyboard Navigation", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview Keyboard"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("arrow keys navigate between pages", async ({ page }) => {
    // Create a 2x2 grid of pages
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview container
    await page.getByTestId("overview-view").focus();

    // First page should be focused initially
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Arrow right moves to next page
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-1")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Arrow left moves back
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );
  });

  test("arrow down/up navigates between rows", async ({ page }) => {
    // Create enough pages to have multiple rows (at least 4 for 2 columns on smaller screens)
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview container
    await page.getByTestId("overview-view").focus();

    // First page should be focused
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Arrow down moves to the next row (skips 2-4 items depending on columns)
    await page.keyboard.press("ArrowDown");
    // The focused index will depend on the number of columns (2-4 based on viewport)
    // At minimum, it should not be page 0 anymore
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "false",
    );
  });

  test("Home key moves to first page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus and navigate to middle
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-2")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Home goes back to first
    await page.keyboard.press("Home");
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );
  });

  test("End key moves to last page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview
    await page.getByTestId("overview-view").focus();
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // End goes to last
    await page.keyboard.press("End");
    await expect(page.getByTestId("overview-page-2")).toHaveAttribute(
      "data-focused",
      "true",
    );
  });

  test("Space toggles selection of focused page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview
    await page.getByTestId("overview-view").focus();
    await expect(page.getByText("Selected: 0")).toBeVisible();

    // Space selects the focused page
    await page.keyboard.press("Space");
    await expect(page.getByText("Selected: 1")).toBeVisible();

    // Space again deselects
    await page.keyboard.press("Space");
    await expect(page.getByText("Selected: 0")).toBeVisible();
  });

  test("Enter opens the focused page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview and navigate to second page
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-1")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Enter opens the page
    await page.keyboard.press("Enter");

    // Should switch to single view
    await expect(page.getByTestId("overview-view")).not.toBeVisible();
    await expect(page.locator(".touch-none").first()).toBeVisible();
  });

  test("keyboard navigation wraps at edges correctly", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview
    await page.getByTestId("overview-view").focus();

    // At first page, left arrow should stay at first page (clamped)
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // Go to last page
    await page.keyboard.press("End");
    await expect(page.getByTestId("overview-page-2")).toHaveAttribute(
      "data-focused",
      "true",
    );

    // At last page, right arrow should stay at last page (clamped)
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-2")).toHaveAttribute(
      "data-focused",
      "true",
    );
  });

  test("clicking a page card area sets focus to that page", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Wait for pages to be rendered
    await expect(page.getByTestId("overview-page-0")).toBeVisible();
    await expect(page.getByTestId("overview-page-1")).toBeVisible();

    // Click on the "Page 2" label area of the second page card to set focus
    await page.getByText("Page 2").click();
    await expect(page.getByTestId("overview-page-1")).toHaveAttribute(
      "data-focused",
      "true",
    );
  });

  test("keyboard navigation is disabled when dialog is open", async ({
    page,
  }) => {
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus and select the page
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Selected: 1")).toBeVisible();

    // Open the tag dialog
    await page
      .getByTestId("overview-view")
      .getByRole("button", { name: "Add Tags" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Add Tags" }),
    ).toBeVisible();

    // Try to navigate with arrow keys - should not change focus (dialog is open)
    // The input should receive the key instead
    const initialFocused = await page
      .getByTestId("overview-page-0")
      .getAttribute("data-focused");
    await page.keyboard.press("ArrowRight");

    // Focus should remain unchanged since dialog is open
    // (Actually the arrow key will be captured by the input, but focus shouldn't change)
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute(
      "data-focused",
      initialFocused || "true",
    );
  });
});

test.describe("Overview View - Selection State", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Overview Selection"));
    notebookId = nb.id;
    notebookTitle = nb.title;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("selection is cleared when switching away and back to overview", async ({
    page,
  }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select a page
    await page.locator('input[type="checkbox"]').first().click();
    await expect(page.getByText("Selected: 1")).toBeVisible();

    // Switch to single view
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible();

    // Switch back to overview
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Selection state is reset when the component re-mounts
    await expect(page.getByText("Selected: 0")).toBeVisible();
  });

  test("selection is cleared when page is deleted", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Select first page
    await page.locator('input[type="checkbox"]').first().click();
    await expect(page.getByText("Selected: 1")).toBeVisible();

    // Delete it - use the overview-scoped delete button to avoid toolbar ambiguity
    await page
      .getByTestId("overview-view")
      .getByRole("button", { name: "Delete" })
      .click();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Selection should be cleared
    await expect(page.getByText("Selected: 0")).toBeVisible();
  });

  test("can select multiple pages with space key", async ({ page }) => {
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await openNotebook(page, notebookTitle);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus and select with space
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("Space"); // Select first
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space"); // Select second
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space"); // Select third

    await expect(page.getByText("Selected: 3")).toBeVisible();
  });
});
