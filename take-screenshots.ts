import { chromium } from "@playwright/test";

const BASE = "http://localhost:5175";
const API = "http://localhost:3001";
const PAGE_WIDTH = 1404;

// ---------------------------------------------------------------------------
// Stroke generation — creates handwriting-like wavy strokes
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  id: string;
  timestamp: number;
  tool: string;
  color: string;
  width: number;
  points: Point[];
  createdAt: string;
}

let counter = 0;

/** Single "word" stroke — a wavy line from startX to endX at baseY. */
function wordStroke(
  startX: number,
  endX: number,
  baseY: number,
  seed: number,
): Stroke {
  const points: Point[] = [];
  const len = endX - startX;
  const steps = Math.max(12, Math.floor(len / 10));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + len * t;
    const y =
      baseY +
      Math.sin(t * Math.PI * (4 + (seed % 3))) * (2.5 + (seed % 2)) +
      Math.sin(t * Math.PI * (9 + (seed % 5)) + seed) * 1.2 +
      Math.sin(t * Math.PI * 0.5) * (seed % 2 === 0 ? 1.5 : -1);
    const pressure = Math.max(
      0.2,
      Math.min(
        0.85,
        0.45 +
          0.3 * Math.sin(t * Math.PI) +
          0.04 * Math.sin(t * Math.PI * 11 + seed),
      ),
    );
    points.push({ x, y, pressure });
  }

  return {
    id: `st_demo_${++counter}`,
    timestamp: Date.now(),
    tool: "pen",
    color: "#000000",
    width: 2,
    points,
    createdAt: new Date().toISOString(),
  };
}

/** One line of handwriting — several word-like strokes with gaps. */
function handwritingLine(baseY: number, lineIdx: number): Stroke[] {
  const strokes: Stroke[] = [];
  const seed = lineIdx * 17 + 42;
  const margin = 100;
  const rightEdge = PAGE_WIDTH - 80;
  const wordCount = 3 + (seed % 4);
  const gap = 25 + (seed % 12);
  const usable = rightEdge - margin - (wordCount - 1) * gap;

  const weights = Array.from(
    { length: wordCount },
    (_, i) => 0.5 + (((seed + i * 13) % 100) / 100),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let x = margin;
  for (let w = 0; w < wordCount; w++) {
    const width = (weights[w] / totalWeight) * usable;
    if (width < 25 || x + width > rightEdge) break;
    strokes.push(wordStroke(x, x + width, baseY, seed + w * 7));
    x += width + gap;
  }

  // Occasionally shorten the last line of a paragraph
  if (lineIdx % 7 === 6 && strokes.length > 2) strokes.pop();
  return strokes;
}

/** Full page of handwriting. */
function fullPage(pageIdx: number): Stroke[] {
  const strokes: Stroke[] = [];
  const topMargin = 140;
  const lineSpacing = 62;
  const lineCount = 14 + ((pageIdx * 7 + 3) % 10);

  for (let i = 0; i < lineCount; i++) {
    const y = topMargin + i * lineSpacing;
    if (y > 1750) break;
    const indent = i % 7 === 0 && i > 0 ? 60 : 0;
    for (const s of handwritingLine(y, i + pageIdx * 100)) {
      if (indent) s.points = s.points.map((p) => ({ ...p, x: p.x + indent }));
      strokes.push(s);
    }
  }
  return strokes;
}

/** Title page — a bold heading plus a few body lines. */
function titlePage(pageIdx: number): Stroke[] {
  const strokes: Stroke[] = [];
  const title = wordStroke(180, 850, 200, pageIdx * 31);
  title.width = 4;
  strokes.push(title);
  const sub = wordStroke(180, 650, 280, pageIdx * 31 + 5);
  sub.width = 3;
  strokes.push(sub);

  const startY = 400;
  const lines = 8 + (pageIdx % 4);
  for (let i = 0; i < lines; i++) {
    const y = startY + i * 62;
    if (y > 1750) break;
    strokes.push(...handwritingLine(y, i + pageIdx * 50));
  }
  return strokes;
}

/** Sparse page — just a handful of lines. */
function sparsePage(pageIdx: number): Stroke[] {
  const strokes: Stroke[] = [];
  const lines = 3 + (pageIdx % 3);
  for (let i = 0; i < lines; i++) {
    strokes.push(...handwritingLine(140 + i * 62, i + pageIdx * 200));
  }
  return strokes;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createNotebook(title: string) {
  const res = await fetch(`${API}/api/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return (await res.json()) as { id: string; title: string };
}

async function addPage(notebookId: string) {
  const res = await fetch(`${API}/api/notebooks/${notebookId}/pages`, {
    method: "POST",
  });
  return (await res.json()) as { id: string };
}

async function addStrokes(pageId: string, strokes: Stroke[]) {
  await fetch(`${API}/api/pages/${pageId}/strokes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strokes }),
  });
}

async function deleteNotebook(id: string) {
  await fetch(`${API}/api/notebooks/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Creating demo data...\n");

  const demoNotebooks: { id: string; title: string }[] = [];
  const titles = [
    "Meeting Notes",
    "Book Notes — Thinking Fast and Slow",
    "Architecture Diagrams",
    "Weekly Review",
    "Research",
    "Project Ideas",
    "Quick Notes",
    "Travel Plans",
  ];

  for (const title of titles) {
    demoNotebooks.push(await createNotebook(title));
  }
  const demoIds = new Set(demoNotebooks.map((nb) => nb.id));

  // Populate the main notebook with varied page content
  const mainNb = demoNotebooks[0]; // "Meeting Notes"
  const generators = [
    titlePage,
    fullPage,
    fullPage,
    sparsePage,
    fullPage,
    fullPage,
    sparsePage,
  ];
  for (let i = 0; i < generators.length; i++) {
    const p = await addPage(mainNb.id);
    const strokes = generators[i](i);
    await addStrokes(p.id, strokes);
    console.log(`  ${mainNb.title} p${i + 1}: ${strokes.length} strokes`);
  }

  // Give other notebooks at least one page so they show thumbnails
  for (const nb of demoNotebooks) {
    if (nb.id === mainNb.id) continue;
    const count = 1 + (demoNotebooks.indexOf(nb) % 3);
    for (let j = 0; j < count; j++) {
      const p = await addPage(nb.id);
      await addStrokes(p.id, fullPage(demoNotebooks.indexOf(nb) * 10 + j));
    }
  }

  // Wait for server-side thumbnail generation
  console.log("\nWaiting for thumbnails...");
  await new Promise((r) => setTimeout(r, 3000));

  // ------------------------------------------------------------------
  // Take screenshots
  // ------------------------------------------------------------------
  console.log("Taking screenshots...\n");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1404, height: 1872 },
  });
  const page = await ctx.newPage();

  // Intercept the notebook-list endpoint so only demo notebooks appear.
  // Uses a regex to match exactly /api/notebooks (not sub-paths like
  // /api/notebooks/:id/pages).
  await page.route(/\/api\/notebooks(\?.*)?$/, async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const all = await response.json();
    const filtered = (all as { id: string }[]).filter((nb) =>
      demoIds.has(nb.id),
    );
    await route.fulfill({ json: filtered });
  });

  try {
    // 1. Notebook list
    await page.goto(BASE);
    await page.waitForSelector("text=Notebooks");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "screenshots/01-notebook-list.png" });
    console.log("✓ Notebook list");

    // 2. Open the main demo notebook
    await page.click(`text=${mainNb.title}`);
    await page.waitForURL(/\/notebook\/nb_.*\/page\//);
    await page.waitForTimeout(800);

    // 3. Single page view (default)
    await page.screenshot({ path: "screenshots/02-page-view.png" });
    console.log("✓ Page view");

    // 4. Canvas view
    await page.click('button:has-text("Canvas")');
    await page.waitForTimeout(800);
    // Dismiss the Quick Tips tooltip if visible
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible()) await gotIt.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/03-canvas-view.png" });
    console.log("✓ Canvas view");

    // 5. Overview view
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: "screenshots/04-overview-view.png" });
    console.log("✓ Overview view");

    // 6. Search dialog
    await page.goto(BASE);
    await page.waitForSelector("text=Notebooks");
    await page.getByTestId("search-button").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/05-search.png" });
    console.log("✓ Search");
  } finally {
    await browser.close();
  }

  // Clean up demo data
  console.log("\nCleaning up...");
  for (const nb of demoNotebooks) {
    await deleteNotebook(nb.id);
  }

  console.log("Done — screenshots saved to ./screenshots/");
}

main().catch(console.error);
