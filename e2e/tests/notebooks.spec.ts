import { test, expect } from "@playwright/test";

test.describe("Notebook management", () => {
  test("create notebook, navigate to writing page, then delete it", async ({ page }) => {
    const title = `E2E Notebook ${Date.now()}`;

    // Navigate to home page
    await page.goto("/");
    await expect(page.getByText("Notebooks")).toBeVisible();

    // Click "New Notebook" button
    await page.getByRole("button", { name: "New Notebook" }).click();

    // Fill in the title and create
    await page.getByPlaceholder("Notebook title").fill(title);
    await page.getByRole("button", { name: "Create" }).click();

    // Verify the notebook appears in the list
    await expect(page.getByText(title)).toBeVisible();

    // Click the notebook to navigate to the writing page
    await page.getByText(title).click();

    // Should navigate to a writing page URL
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);

    // Go back to the notebooks list
    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();

    // Delete the notebook - find the heading, go up to the card, click its delete button
    const card = page.getByRole("heading", { name: title }).locator("..");
    await card.getByRole("button", { name: "Delete notebook" }).click();

    // Confirm deletion in the dialog
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Verify it's removed
    await expect(page.getByRole("heading", { name: title })).not.toBeVisible();
  });
});
