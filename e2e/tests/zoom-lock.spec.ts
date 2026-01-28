import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test.describe("Zoom lock functionality", () => {
  let notebookId: string;
  let notebookTitle: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E ZoomLock"));
    notebookId = nb.id;
    notebookTitle = nb.title;
    await addPage(notebookId);
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("zoom lock button is visible in toolbar", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Zoom lock button should be visible
    const zoomLockButton = page.getByRole("button", { name: /lock pinch zoom/i });
    await expect(zoomLockButton).toBeVisible();
  });

  test("zoom lock button toggles state when clicked", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    const zoomLockButton = page.getByRole("button", { name: /lock pinch zoom/i });

    // Initially unlocked
    await expect(zoomLockButton).toHaveAttribute("aria-label", "Lock pinch zoom");

    // Click to lock
    await zoomLockButton.click();
    await expect(zoomLockButton).toHaveAttribute("aria-label", "Unlock pinch zoom");

    // Click to unlock
    await zoomLockButton.click();
    await expect(zoomLockButton).toHaveAttribute("aria-label", "Lock pinch zoom");
  });

  test("zoom lock button shows locked icon when locked", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    const zoomLockButton = page.getByRole("button", { name: /lock pinch zoom/i });

    // Click to lock
    await zoomLockButton.click();

    // Button should show the locked state (has active styling)
    // The button has active={isZoomLocked} which adds different styling
    await expect(zoomLockButton).toHaveAttribute("aria-label", "Unlock pinch zoom");
  });

  test("zoom lock controls are hidden in overview view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    // Switch to overview view
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByTestId("overview-view")).toBeVisible();

    // Zoom lock button should not be visible in overview
    await expect(
      page.getByRole("button", { name: /lock pinch zoom/i }),
    ).not.toBeVisible();
  });

  test("zoom lock state persists when switching to canvas view", async ({ page }) => {
    await openNotebook(page, notebookTitle);

    const zoomLockButton = page.getByRole("button", { name: /lock pinch zoom/i });

    // Lock zoom
    await zoomLockButton.click();
    await expect(zoomLockButton).toHaveAttribute("aria-label", "Unlock pinch zoom");

    // Switch to canvas view
    await page.getByRole("button", { name: "Canvas" }).click();
    await expect(page.locator(".relative.flex-1.overflow-hidden.bg-gray-200")).toBeVisible();

    // Zoom should still be locked
    const zoomLockButtonAfterSwitch = page.getByRole("button", { name: /unlock pinch zoom/i });
    await expect(zoomLockButtonAfterSwitch).toBeVisible();
  });
});
