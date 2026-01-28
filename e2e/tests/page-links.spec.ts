import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  getPageIds,
  uniqueTitle,
} from "../helpers";

test.describe("Page Links Panel", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Links"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    // Create 3 pages so we have pages to link between
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("open links panel from toolbar", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Click the Links toolbar button
    await page.getByTestId("toolbar-links").click();

    // Links panel should open
    const panel = page.getByTestId("links-panel");
    await expect(panel).toBeVisible();

    // Should show the "Page Info" header
    await expect(panel.getByText("Page Info")).toBeVisible();

    // Should show Tags, Links, and Backlinks sections
    await expect(panel.getByText("Tags (0)")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Links (0)", exact: true })).toBeVisible();
    await expect(panel.getByText("Backlinks (0)")).toBeVisible();

    // Should show empty states
    await expect(panel.getByText("No links yet")).toBeVisible();
    await expect(panel.getByText("No other pages link to this page")).toBeVisible();
  });

  test("add a link to another page", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    const pageIds = await getPageIds(notebookId);

    // Open links panel
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    // Click the "+ Add" button to open the link menu
    await page.getByTestId("add-link-button").click();
    const linkMenu = page.getByTestId("add-link-menu");
    await expect(linkMenu).toBeVisible();

    // Should show other pages to link to (not the current page)
    // Click the first available link option
    const firstOption = linkMenu.locator("button").first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    // Link menu should close
    await expect(linkMenu).not.toBeVisible();

    // Links list should now show the linked page
    const linksList = page.getByTestId("links-list");
    await expect(linksList).toBeVisible();
    await expect(page.getByText("Links (1)")).toBeVisible();
  });

  test("remove a link", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    const pageIds = await getPageIds(notebookId);

    // Open links panel
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    // Add a link first
    await page.getByTestId("add-link-button").click();
    const linkMenu = page.getByTestId("add-link-menu");
    await expect(linkMenu).toBeVisible();
    await linkMenu.locator("button").first().click();

    // Should now show 1 link
    await expect(page.getByText("Links (1)")).toBeVisible();

    // Find the remove button for the linked page and click it
    const linksList = page.getByTestId("links-list");
    const removeBtn = linksList.locator("[data-testid^='remove-link-']").first();
    await removeBtn.click();

    // Link should be removed
    await expect(page.getByText("Links (0)")).toBeVisible();
    await expect(page.getByText("No links yet")).toBeVisible();
  });

  test("navigate to a linked page", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to single mode so we can track page navigation
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // We should be on page 1
    await expect(page.getByText("1/3")).toBeVisible();

    // Open links panel and add a link
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    await page.getByTestId("add-link-button").click();
    await expect(page.getByTestId("add-link-menu")).toBeVisible();
    await page.getByTestId("add-link-menu").locator("button").first().click();

    // Click the linked page to navigate to it
    const linksList = page.getByTestId("links-list");
    const navBtn = linksList.locator("[data-testid^='link-navigate-']").first();
    await navBtn.click();

    // URL should change to a different page
    await page.waitForURL(/\/page\/pg_/);

    // Should now be on a different page (page 2 or 3)
    await expect(page.getByText("1/3")).not.toBeVisible();
  });

  test("backlinks appear when a page is linked from another page", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    const pageIds = await getPageIds(notebookId);

    // Switch to single mode
    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });

    // From page 1, open links panel and link to page 2
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    await page.getByTestId("add-link-button").click();
    await expect(page.getByTestId("add-link-menu")).toBeVisible();

    // Link to the second page
    const page2Option = page.getByTestId(`add-link-option-${pageIds[1]}`);
    await page2Option.click();
    await expect(page.getByText("Links (1)")).toBeVisible();

    // Close the links panel
    await page.getByTestId("links-panel-close").click();

    // Navigate to page 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("2/3")).toBeVisible();

    // Open links panel on page 2
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    // Page 2 should show a backlink from page 1
    await expect(page.getByText("Backlinks (1)")).toBeVisible();
    const backlinksList = page.getByTestId("backlinks-list");
    await expect(backlinksList).toBeVisible();
    await expect(backlinksList.getByText("Page 1")).toBeVisible();
  });

  test("close button closes the panel", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    await page.getByTestId("links-panel-close").click();
    await expect(page.getByTestId("links-panel")).not.toBeVisible();
  });

  test("opening tags panel closes links panel", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open links panel
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    // Open tags panel
    await page.getByTestId("toolbar-tags").click();
    await expect(page.getByTestId("tags-panel")).toBeVisible();

    // Links panel should be closed
    await expect(page.getByTestId("links-panel")).not.toBeVisible();
  });

  test("add tags via the links panel tag input", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Open links panel
    await page.getByTestId("toolbar-links").click();
    await expect(page.getByTestId("links-panel")).toBeVisible();

    // The links panel has its own tag input
    const tagInput = page.getByTestId("tag-input");
    await tagInput.fill("my-tag");

    // Click the "Add" button
    await page.getByTestId("add-tag-button").click();

    // Tag should appear
    await expect(page.getByTestId("tag-my-tag")).toBeVisible();
    await expect(page.getByText("Tags (1)")).toBeVisible();

    // Input should be cleared
    await expect(tagInput).toHaveValue("");
  });
});
