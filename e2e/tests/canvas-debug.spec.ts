import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  openNotebook,
  uniqueTitle,
} from "../helpers";

test("debug scroll view rendering", async ({ page }) => {
  const nb = await createNotebook(uniqueTitle("E2E ScrollDebug"));
  const notebookId = nb.id;
  const notebookTitle = nb.title;
  await addPage(notebookId);
  await addPage(notebookId);

  try {
    await openNotebook(page, notebookTitle);
    await page.getByRole("button", { name: "Scroll" }).click();

    await expect(page.locator(".overflow-y-auto.bg-gray-100")).toBeVisible({ timeout: 5000 });

    // Check how many page surfaces are rendered
    const surfaces = await page.locator(".bg-white.shadow-sm").count();
    console.log("Page surfaces in scroll view:", surfaces);

    // Check how many are PageSurface (have SVGs) vs placeholders
    const svgCount = await page.locator(".bg-white.shadow-sm svg").count();
    console.log("SVGs in scroll view:", svgCount);

    // Check visible pages (via touch-pan-y class)
    const touchPanCount = await page.locator(".touch-pan-y").count();
    console.log("touch-pan-y elements:", touchPanCount);

    // Get bounding boxes of all page surfaces
    const pageDivs = page.locator(".bg-white.shadow-sm");
    const count = await pageDivs.count();
    for (let i = 0; i < count; i++) {
      const div = pageDivs.nth(i);
      const box = await div.boundingBox();
      const hasSvg = await div.locator("svg").count() > 0;
      console.log(`Page ${i}: box=`, box, "hasSvg:", hasSvg);
    }

    // Check for placeholder divs (bg-gray-50)
    const placeholders = await page.locator(".bg-gray-50").count();
    console.log("Placeholder divs:", placeholders);

    // Get all elements in the scroll container
    const scrollContainerHTML = await page.evaluate(() => {
      const container = document.querySelector('.overflow-y-auto.bg-gray-100 > div');
      return container ? container.childElementCount : 0;
    });
    console.log("Children in scroll content div:", scrollContainerHTML);
  } finally {
    await deleteNotebook(notebookId);
  }
});

test.skip("debug canvas drawing", async ({ page }) => {
  const nb = await createNotebook(uniqueTitle("E2E DebugCanvas"));
  const notebookId = nb.id;
  const notebookTitle = nb.title;
  await addPage(notebookId);
  
  try {
    await openNotebook(page, notebookTitle);

    // Check pages data before switching to canvas
    const pagesRes = await fetch(`http://localhost:3001/api/notebooks/${notebookId}/pages`);
    const pagesData = await pagesRes.json();
    console.log("Pages data:", JSON.stringify(pagesData, null, 2));

    // Check scroll state BEFORE switching to canvas
    const scrollBefore = await page.evaluate(() => ({
      scrollX: window.scrollX,
      docWidth: document.documentElement.scrollWidth,
    }));
    console.log("Scroll state BEFORE canvas:", scrollBefore);

    // Check toolbar width
    const toolbarWidth = await page.evaluate(() => {
      const toolbar = document.querySelector('.border-b-2.border-gray-400');
      if (!toolbar) return { exists: false };
      return {
        exists: true,
        scrollWidth: toolbar.scrollWidth,
        clientWidth: toolbar.clientWidth,
        offsetWidth: (toolbar as HTMLElement).offsetWidth,
      };
    });
    console.log("Toolbar dimensions:", toolbarWidth);

    await page.getByRole("button", { name: "Canvas" }).click();

    // Check scroll state AFTER switching to canvas
    const scrollAfter = await page.evaluate(() => ({
      scrollX: window.scrollX,
      docWidth: document.documentElement.scrollWidth,
    }));
    console.log("Scroll state AFTER canvas:", scrollAfter);

    // Wait for canvas container
    const canvasContainer = page.locator(".relative.flex-1.overflow-hidden.bg-gray-200");
    await expect(canvasContainer).toBeVisible({ timeout: 5000 });

    // Get viewport and container dimensions
    const viewport = page.viewportSize();
    console.log("Viewport size:", viewport);

    const containerBox = await canvasContainer.boundingBox();
    console.log("Canvas container box:", containerBox);

    // Debug: Get position via getBoundingClientRect in browser
    const rectInfo = await page.evaluate(() => {
      const canvasEl = document.querySelector('.relative.flex-1.overflow-hidden.bg-gray-200');
      const flexEl = document.querySelector('.flex.h-screen.flex-col');
      const toolbar = document.querySelector('.border-b-2.border-gray-400');

      // Get all direct children of flexEl
      const children: { className: string; rect: DOMRect | null }[] = [];
      if (flexEl) {
        for (const child of flexEl.children) {
          children.push({
            className: child.className || '[no class]',
            rect: child.getBoundingClientRect(),
          });
        }
      }

      return {
        canvas: canvasEl?.getBoundingClientRect(),
        flex: flexEl?.getBoundingClientRect(),
        toolbar: toolbar?.getBoundingClientRect(),
        flexChildren: children,
      };
    });
    console.log("Rect info from browser:", JSON.stringify(rectInfo, null, 2));

    // Check parent elements
    const flexContainer = page.locator(".flex.h-screen.flex-col");
    const flexBox = await flexContainer.boundingBox();
    console.log("Flex container box:", flexBox);

    // Check flex container's scroll position
    const flexScrollInfo = await page.evaluate(() => {
      const flexEl = document.querySelector('.flex.h-screen.flex-col');
      if (!flexEl) return { exists: false };
      return {
        exists: true,
        scrollLeft: flexEl.scrollLeft,
        scrollWidth: flexEl.scrollWidth,
        clientWidth: flexEl.clientWidth,
      };
    });
    console.log("Flex container scroll info:", flexScrollInfo);

    // Check document scroll state
    const scrollState = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      docWidth: document.documentElement.scrollWidth,
      docHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
    }));
    console.log("Scroll state:", scrollState);

    // Check for page position divs
    const pageDivs = canvasContainer.locator("> div > div");
    const pageDivCount = await pageDivs.count();
    console.log("Page div count in canvas:", pageDivCount);
    for (let i = 0; i < pageDivCount; i++) {
      const div = pageDivs.nth(i);
      const style = await div.getAttribute("style");
      const box = await div.boundingBox();
      console.log(`Page div ${i}: style="${style}" box=`, box);
    }

    // Check what classes exist
    const drawingLayer = page.locator(".touch-none").first();
    const isVisible = await drawingLayer.isVisible().catch(() => false);
    console.log("touch-none visible:", isVisible);

    // If not visible, try to scroll or wait
    if (!isVisible) {
      // Check if it exists at all
      const exists = await drawingLayer.count();
      console.log("touch-none exists count:", exists);

      // Get the outer HTML of all touch-* elements
      const touchElements = page.locator("[class*='touch-']");
      const touchCount = await touchElements.count();
      for (let i = 0; i < touchCount; i++) {
        const el = touchElements.nth(i);
        const classes = await el.getAttribute("class");
        const box = await el.boundingBox();
        console.log(`touch element ${i}: class="${classes}" box=`, box);
      }
    }

    // Check for page surfaces
    const surfaces = await page.locator(".bg-white.shadow-sm").count();
    console.log("Page surfaces found:", surfaces);
    
    // Check for SVGs
    const svgs = await page.locator(".bg-white.shadow-sm svg").count();
    console.log("SVGs found:", svgs);
    
    // Get the HTML of the first page surface
    if (surfaces > 0) {
      const html = await page.locator(".bg-white.shadow-sm").first().innerHTML();
      console.log("First surface HTML:", html.substring(0, 500));
    }
    
    // Check if there's a different element we should target
    const allElements = await page.locator("[class*='touch-']").count();
    console.log("touch-* elements:", allElements);
    
    await page.waitForTimeout(2000);
    
    // Try drawing
    if (isVisible) {
      const box = await drawingLayer.boundingBox();
      if (box) {
        console.log("Drawing layer box:", box);
        await page.mouse.move(box.x + 100, box.y + 100);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
        await page.mouse.up();
        
        await page.waitForTimeout(500);
        
        // Check for paths
        const paths = await page.locator(".bg-white.shadow-sm svg path").count();
        console.log("Paths after drawing:", paths);
      }
    }
  } finally {
    await deleteNotebook(notebookId);
  }
});
