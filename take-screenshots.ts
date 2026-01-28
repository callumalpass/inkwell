import { chromium } from "@playwright/test";

const BASE = "http://localhost:5175";
const API = "http://localhost:3001";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1404, height: 1872 }, // e-ink tablet size
  });
  const page = await context.newPage();

  // 1. Notebook list view
  await page.goto(BASE);
  await page.waitForSelector("text=Notebooks");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/01-notebook-list.png" });
  console.log("✓ Notebook list screenshot");

  // 2. Open a notebook with pages - use "Test" which has 7 pages
  const notebooks = await fetch(`${API}/api/notebooks`).then((r) => r.json());
  const testNotebook = notebooks.find((n: any) => n.title === "Test");

  if (!testNotebook) {
    console.log("No 'Test' notebook found, using first available");
  }

  const notebookId = testNotebook?.id || notebooks[0]?.id;
  if (!notebookId) {
    console.error("No notebooks available");
    await browser.close();
    return;
  }

  // Click on notebook to open it
  await page.click(`text=${testNotebook?.title || notebooks[0].title}`);
  await page.waitForURL(/\/notebook\/nb_.*\/page\//);
  await page.waitForTimeout(500);

  // 3. Single page view (default)
  await page.screenshot({ path: "screenshots/02-page-view.png" });
  console.log("✓ Page view screenshot");

  // 4. Canvas view
  await page.click('button:has-text("Canvas")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/03-canvas-view.png" });
  console.log("✓ Canvas view screenshot");

  // 5. Overview view
  await page.click('button:has-text("Overview")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/04-overview-view.png" });
  console.log("✓ Overview view screenshot");

  // 6. Search view - go back to home and use search
  await page.goto(BASE);
  await page.waitForSelector("text=Notebooks");
  await page.click('button[aria-label="Search"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: "screenshots/05-search.png" });
  console.log("✓ Search screenshot");

  await browser.close();
  console.log("\nAll screenshots saved to ./screenshots/");
}

main().catch(console.error);
