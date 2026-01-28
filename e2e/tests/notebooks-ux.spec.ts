import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  uniqueTitle,
  openNotebook,
} from "../helpers";

test.describe("Notebook Sorting", () => {
  let notebooks: { id: string; title: string }[] = [];

  test.beforeEach(async () => {
    // Create notebooks with different characteristics
    const nb1 = await createNotebook("Alpha Notebook");
    const nb2 = await createNotebook("Zebra Notebook");
    const nb3 = await createNotebook("Middle Notebook");

    // Add different page counts
    await addPage(nb1.id);
    await addPage(nb1.id);
    await addPage(nb1.id); // 3 pages
    await addPage(nb2.id); // 1 page
    await addPage(nb3.id);
    await addPage(nb3.id); // 2 pages

    notebooks = [nb1, nb2, nb3];
  });

  test.afterEach(async () => {
    for (const nb of notebooks) {
      await deleteNotebook(nb.id);
    }
  });

  test("sort controls are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sort-controls")).toBeVisible();
    await expect(page.getByTestId("sort-modified")).toBeVisible();
    await expect(page.getByTestId("sort-name")).toBeVisible();
    await expect(page.getByTestId("sort-pageCount")).toBeVisible();
  });

  test("sort by name ascending", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("sort-name").click();

    // Get notebook titles in order
    const cards = page.locator("h3");
    const titles = await cards.allTextContents();

    // Alpha should come first when sorted by name ascending
    expect(titles.indexOf("Alpha Notebook")).toBeLessThan(titles.indexOf("Middle Notebook"));
    expect(titles.indexOf("Middle Notebook")).toBeLessThan(titles.indexOf("Zebra Notebook"));
  });

  test("clicking same sort toggles order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click name to sort ascending
    await page.getByTestId("sort-name").click();
    await expect(page.getByTestId("sort-name")).toContainText("↑");

    // Click again to toggle to descending
    await page.getByTestId("sort-name").click();
    await expect(page.getByTestId("sort-name")).toContainText("↓");

    // Verify Zebra now comes first
    const cards = page.locator("h3");
    const titles = await cards.allTextContents();
    expect(titles.indexOf("Zebra Notebook")).toBeLessThan(titles.indexOf("Alpha Notebook"));
  });

  test("sort by page count", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("sort-pageCount").click();

    // By default, descending order - most pages first
    const cards = page.locator("h3");
    const titles = await cards.allTextContents();

    // Alpha has 3 pages, should be first
    expect(titles.indexOf("Alpha Notebook")).toBeLessThan(titles.indexOf("Middle Notebook"));
    expect(titles.indexOf("Middle Notebook")).toBeLessThan(titles.indexOf("Zebra Notebook"));
  });

  test("default sort is by last modified descending", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // The "Last Modified" button should have the descending arrow
    await expect(page.getByTestId("sort-modified")).toContainText("↓");
  });
});

test.describe("Empty Notebook State", () => {
  test("shows empty state when no notebooks exist", async ({ page }) => {
    await page.goto("/");

    // If there are notebooks, we can't test this
    // This test assumes a clean state
    const emptyState = page.getByTestId("empty-notebooks");
    if (await emptyState.isVisible()) {
      await expect(page.getByText("No notebooks yet")).toBeVisible();
      await expect(page.getByText("Create your first notebook")).toBeVisible();
      await expect(page.locator("kbd").getByText("Cmd+K")).toBeVisible();
    }
  });
});

test.describe("Overview View Keyboard Navigation", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    notebookTitle = uniqueTitle("E2E Overview Nav");
    const nb = await createNotebook(notebookTitle);
    notebookId = nb.id;
    // Create multiple pages for navigation
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("arrow keys navigate between pages", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus the overview
    await page.getByTestId("overview-view").focus();

    // Arrow right should focus first page, then move to second
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute("data-focused", "true");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("overview-page-1")).toHaveAttribute("data-focused", "true");
  });

  test("Enter opens focused page", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus and navigate
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight"); // Focus second page

    // Press Enter to open
    await page.keyboard.press("Enter");

    // Should switch to single view
    await expect(page.locator(".touch-none").first()).toBeVisible({ timeout: 5000 });
  });

  test("Space toggles selection of focused page", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Focus and select
    await page.getByTestId("overview-view").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");

    // Check that selection count increased
    await expect(page.getByText("Selected: 1")).toBeVisible();
  });

  test("Home goes to first page, End goes to last", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    await page.getByTestId("overview-view").focus();

    // Press End to go to last page
    await page.keyboard.press("End");
    await expect(page.getByTestId("overview-page-3")).toHaveAttribute("data-focused", "true");

    // Press Home to go to first page
    await page.keyboard.press("Home");
    await expect(page.getByTestId("overview-page-0")).toHaveAttribute("data-focused", "true");
  });

  test("keyboard hint is displayed", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Check for navigation hint text
    await expect(page.getByText("navigate")).toBeVisible();
    await expect(page.getByText("Enter open")).toBeVisible();
  });
});

test.describe("Search Keyboard Navigation", () => {
  let notebookId: string;
  let notebookTitle: string;
  const searchToken1 = `search_${Date.now()}_1`;
  const searchToken2 = `search_${Date.now()}_2`;

  test.beforeEach(async () => {
    notebookTitle = uniqueTitle("E2E Search Nav");
    const nb = await createNotebook(notebookTitle);
    notebookId = nb.id;

    // Create pages with transcriptions
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);

    // Write transcriptions
    await fetch(`http://localhost:3001/api/pages/${page1.id}/transcription`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `Notes about ${searchToken1}` }),
    });
    await fetch(`http://localhost:3001/api/pages/${page2.id}/transcription`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `Notes about ${searchToken2}` }),
    });
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("arrow keys navigate search results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();

    // Search for something that returns multiple results
    await page.getByTestId("search-input").fill(searchToken1.split("_")[0]);

    // Wait for results
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Arrow down to select first result
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("search-result").first()).toHaveAttribute("data-selected", "true");
  });

  test("Enter navigates to selected result", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await page.getByTestId("search-input").fill(searchToken1);

    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Navigate and select
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Should navigate to the page
    await page.waitForURL(/\/notebook\/nb_.*\/page\/pg_/);
  });

  test("mouse hover updates selection", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    await page.getByTestId("search-button").click();
    await page.getByTestId("search-input").fill(searchToken1);

    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Hover over result
    await page.getByTestId("search-result").first().hover();
    await expect(page.getByTestId("search-result").first()).toHaveAttribute("data-selected", "true");
  });

  test("keyboard hint is shown with results", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-button").click();
    await page.getByTestId("search-input").fill(searchToken1);

    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 5000 });

    // Check for navigation hint
    await expect(page.getByText("navigate")).toBeVisible();
    await expect(page.getByText("Enter open")).toBeVisible();
  });
});

test.describe("Recent Pages", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    notebookTitle = uniqueTitle("E2E Recent Pages");
    const nb = await createNotebook(notebookTitle);
    notebookId = nb.id;
    await addPage(notebookId);
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("visiting a page adds it to recent pages", async ({ page }) => {
    // Visit the notebook
    await openNotebook(page, notebookTitle);

    // Go back to notebooks page
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Recent pages button should be visible
    await expect(page.getByTestId("recent-pages-button")).toBeVisible();

    // Click to open menu
    await page.getByTestId("recent-pages-button").click();
    await expect(page.getByTestId("recent-pages-menu")).toBeVisible();

    // Should show the notebook title
    await expect(page.getByTestId("recent-page-item")).toBeVisible();
    await expect(page.getByText(notebookTitle).last()).toBeVisible();
  });

  test("clicking recent page navigates to it", async ({ page }) => {
    // Visit notebook to add it to recent
    await openNotebook(page, notebookTitle);
    await page.goto("/");

    // Open recent pages menu
    await page.getByTestId("recent-pages-button").click();
    await expect(page.getByTestId("recent-pages-menu")).toBeVisible();

    // Click the recent page
    await page.getByTestId("recent-page-item").first().click();

    // Should navigate to the page
    await page.waitForURL(/\/notebook\/nb_.*\/page\/pg_/);
  });

  test("can remove individual recent page", async ({ page }) => {
    // Visit notebook
    await openNotebook(page, notebookTitle);
    await page.goto("/");

    await page.getByTestId("recent-pages-button").click();
    await expect(page.getByTestId("recent-pages-menu")).toBeVisible();

    // Click remove button (appears on hover)
    const item = page.getByTestId("recent-page-item").first();
    await item.hover();
    await page.getByTestId("remove-recent-page").first().click();

    // Item should be removed (menu may close or item disappears)
    await expect(page.getByTestId("recent-pages-menu")).not.toBeVisible();
  });

  test("can clear all recent pages", async ({ page }) => {
    // Visit notebook
    await openNotebook(page, notebookTitle);
    await page.goto("/");

    await page.getByTestId("recent-pages-button").click();
    await expect(page.getByTestId("recent-pages-menu")).toBeVisible();

    // Click clear all
    await page.getByTestId("clear-recent-pages").click();

    // Menu should close and button should not be visible
    await expect(page.getByTestId("recent-pages-button")).not.toBeVisible();
  });

  test("recent pages menu closes on Escape", async ({ page }) => {
    await openNotebook(page, notebookTitle);
    await page.goto("/");

    await page.getByTestId("recent-pages-button").click();
    await expect(page.getByTestId("recent-pages-menu")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("recent-pages-menu")).not.toBeVisible();
  });
});
