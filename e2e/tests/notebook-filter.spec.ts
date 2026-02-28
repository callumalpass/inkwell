import { test, expect } from "@playwright/test";
import { createNotebook, deleteNotebook, uniqueTitle, updateNotebook } from "../helpers";

test.describe("Notebook filter functionality", () => {
  test("filter input is visible on notebooks page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("notebook-filter")).toBeVisible();
  });

  test("filtering by name shows matching notebooks", async ({ page }) => {
    // Create notebooks for this test
    const projectNb = await createNotebook(uniqueTitle("FilterTest_Project"));
    const notesNb = await createNotebook(uniqueTitle("FilterTest_Notes"));

    try {
      await page.goto("/");
      await expect(page.getByText("Notebooks")).toBeVisible();

      // Initially both should be visible
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(notesNb.title)).toBeVisible();

      // Filter by "Project"
      await page.getByTestId("notebook-filter").fill("Project");

      // Only Project notebook should be visible
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(notesNb.title)).not.toBeVisible();
    } finally {
      await deleteNotebook(projectNb.id);
      await deleteNotebook(notesNb.id);
    }
  });

  test("filtering is case-insensitive", async ({ page }) => {
    const projectNb = await createNotebook(uniqueTitle("CaseTest_Project"));

    try {
      await page.goto("/");
      await expect(page.getByText("Notebooks")).toBeVisible();

      // Filter with different case
      await page.getByTestId("notebook-filter").fill("project");

      // Should still show (case-insensitive)
      await expect(page.getByText(projectNb.title)).toBeVisible();
    } finally {
      await deleteNotebook(projectNb.id);
    }
  });

  test("clearing filter shows all notebooks again", async ({ page }) => {
    const projectNb = await createNotebook(uniqueTitle("ClearTest_Project"));
    const notesNb = await createNotebook(uniqueTitle("ClearTest_Notes"));

    try {
      await page.goto("/");
      await expect(page.getByText("Notebooks")).toBeVisible();

      // Filter first
      await page.getByTestId("notebook-filter").fill("Project");
      await expect(page.getByText(notesNb.title)).not.toBeVisible();

      // Clear the filter using clear button
      await page.getByLabel("Clear filter").click();

      // All should be visible again
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(notesNb.title)).toBeVisible();
    } finally {
      await deleteNotebook(projectNb.id);
      await deleteNotebook(notesNb.id);
    }
  });

  test("shows message when no notebooks match filter", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Filter with non-matching text
    await page.getByTestId("notebook-filter").fill("NonExistentNotebook12345");

    // Should show "no results" message
    await expect(page.getByTestId("no-filter-results")).toBeVisible();
    await expect(page.getByText('No notebooks match "NonExistentNotebook12345"')).toBeVisible();
  });

  test("filter persists during navigation", async ({ page }) => {
    const notesNb = await createNotebook(uniqueTitle("PersistTest_Notes"));
    const projectNb = await createNotebook(uniqueTitle("PersistTest_Project"));

    try {
      await page.goto("/");
      await expect(page.getByText("Notebooks")).toBeVisible();

      // Filter
      await page.getByTestId("notebook-filter").fill("Notes");

      // Verify filter applied
      await expect(page.getByText(notesNb.title)).toBeVisible();
      await expect(page.getByText(projectNb.title)).not.toBeVisible();

      // Open settings and close
      await page.getByRole("button", { name: "Settings" }).click();
      // Wait for settings panel to appear and then close it
      await expect(page.getByText("Global defaults")).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      // Filter should still be applied
      await expect(page.getByTestId("notebook-filter")).toHaveValue("Notes");
      await expect(page.getByText(projectNb.title)).not.toBeVisible();
    } finally {
      await deleteNotebook(notesNb.id);
      await deleteNotebook(projectNb.id);
    }
  });

  test("filter works together with sorting", async ({ page }) => {
    const projectNb = await createNotebook(uniqueTitle("SortTest_Project"));
    const notesNb = await createNotebook(uniqueTitle("SortTest_Notes"));

    try {
      await page.goto("/");
      await expect(page.getByText("Notebooks")).toBeVisible();

      // Filter first
      await page.getByTestId("notebook-filter").fill("Project");

      // Only Project notebook visible
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(notesNb.title)).not.toBeVisible();

      // Change sort to name
      await page.getByTestId("sort-name").click();

      // Filter should still be applied
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(notesNb.title)).not.toBeVisible();
    } finally {
      await deleteNotebook(projectNb.id);
      await deleteNotebook(notesNb.id);
    }
  });

  test("tag filter supports include and exclude states", async ({ page }) => {
    const projectNb = await createNotebook(uniqueTitle("TagFilter_Project"));
    const personalNb = await createNotebook(uniqueTitle("TagFilter_Personal"));
    const sharedNb = await createNotebook(uniqueTitle("TagFilter_Shared"));

    try {
      await updateNotebook(projectNb.id, { tags: ["project", "shared"] });
      await updateNotebook(personalNb.id, { tags: ["personal"] });
      await updateNotebook(sharedNb.id, { tags: ["shared"] });

      await page.goto("/");
      await expect(page.getByTestId("tag-filter-controls")).toBeVisible();

      // Include "project"
      await page.getByTestId("tag-filter-chip-project").click();
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(personalNb.title)).not.toBeVisible();
      await expect(page.getByText(sharedNb.title)).not.toBeVisible();

      // Exclude "project"
      await page.getByTestId("tag-filter-chip-project").click();
      await expect(page.getByText(projectNb.title)).not.toBeVisible();
      await expect(page.getByText(personalNb.title)).toBeVisible();
      await expect(page.getByText(sharedNb.title)).toBeVisible();

      // Clear back to off
      await page.getByTestId("tag-filter-chip-project").click();
      await expect(page.getByText(projectNb.title)).toBeVisible();
      await expect(page.getByText(personalNb.title)).toBeVisible();
      await expect(page.getByText(sharedNb.title)).toBeVisible();
    } finally {
      await deleteNotebook(projectNb.id);
      await deleteNotebook(personalNb.id);
      await deleteNotebook(sharedNb.id);
    }
  });

  test("tag filter supports match-all mode", async ({ page }) => {
    const bothNb = await createNotebook(uniqueTitle("TagAll_Both"));
    const onlyProjectNb = await createNotebook(uniqueTitle("TagAll_Project"));
    const onlySharedNb = await createNotebook(uniqueTitle("TagAll_Shared"));

    try {
      await updateNotebook(bothNb.id, { tags: ["project", "shared"] });
      await updateNotebook(onlyProjectNb.id, { tags: ["project"] });
      await updateNotebook(onlySharedNb.id, { tags: ["shared"] });

      await page.goto("/");
      await expect(page.getByTestId("tag-filter-controls")).toBeVisible();

      await page.getByTestId("tag-filter-chip-project").click();
      await page.getByTestId("tag-filter-chip-shared").click();

      // Match-any should show notebooks with either tag.
      await expect(page.getByText(bothNb.title)).toBeVisible();
      await expect(page.getByText(onlyProjectNb.title)).toBeVisible();
      await expect(page.getByText(onlySharedNb.title)).toBeVisible();

      // Match-all should only show notebook containing both tags.
      await page.getByTestId("tag-match-all").click();
      await expect(page.getByText(bothNb.title)).toBeVisible();
      await expect(page.getByText(onlyProjectNb.title)).not.toBeVisible();
      await expect(page.getByText(onlySharedNb.title)).not.toBeVisible();
    } finally {
      await deleteNotebook(bothNb.id);
      await deleteNotebook(onlyProjectNb.id);
      await deleteNotebook(onlySharedNb.id);
    }
  });
});
