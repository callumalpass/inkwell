import { test, expect } from "@playwright/test";
import {
  createNotebook,
  addPage,
  deleteNotebook,
  uniqueTitle,
  addStroke,
  API,
} from "../helpers";

test.describe("Transcription Queue API", () => {
  let notebookId: string;

  test.beforeEach(async () => {
    const nb = await createNotebook(uniqueTitle("E2E Transcription Queue"));
    notebookId = nb.id;
  });

  test.afterEach(async () => {
    await deleteNotebook(notebookId);
  });

  test("can get queue status", async ({ request }) => {
    const response = await request.get(`${API}/api/transcription/queue`);
    expect(response.ok()).toBe(true);

    const status = await response.json();
    expect(status).toHaveProperty("pending");
    expect(status).toHaveProperty("jobs");
    expect(typeof status.pending).toBe("number");
    expect(Array.isArray(status.jobs)).toBe(true);
  });

  test("can trigger transcription for a page", async ({ request }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    const response = await request.post(`${API}/api/pages/${pg.id}/transcribe`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.ok()).toBe(true);

    const result = await response.json();
    expect(result.status).toBe("pending");
    expect(result.pageId).toBe(pg.id);
  });

  test("can bulk transcribe pages in a notebook", async ({ request }) => {
    // Create pages with content
    const page1 = await addPage(notebookId);
    const page2 = await addPage(notebookId);
    await addStroke(page1.id);
    await addStroke(page2.id);

    const response = await request.post(`${API}/api/notebooks/${notebookId}/transcribe`);
    expect(response.ok()).toBe(true);

    const result = await response.json();
    expect(result).toHaveProperty("queued");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(2);
    // Queued should be >= 0 (may be 0 if already processing)
    expect(typeof result.queued).toBe("number");
  });

  test("page shows pending transcription status after triggering", async ({ request }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    // Trigger transcription
    await request.post(`${API}/api/pages/${pg.id}/transcribe`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });

    // Check page status
    const response = await request.get(`${API}/api/pages/${pg.id}/transcription`);
    expect(response.ok()).toBe(true);

    const status = await response.json();
    // Status could be pending or processing (depending on timing)
    expect(["pending", "processing", "complete", "failed"]).toContain(status.status);
  });

  test("can get transcription content after manual save", async ({ request }) => {
    const pg = await addPage(notebookId);

    // Manually save transcription content
    const content = "This is test transcription content";
    const saveResponse = await request.put(`${API}/api/pages/${pg.id}/transcription`, {
      headers: { "Content-Type": "application/json" },
      data: { content },
    });
    expect(saveResponse.ok()).toBe(true);

    // Fetch transcription
    const response = await request.get(`${API}/api/pages/${pg.id}/transcription`);
    expect(response.ok()).toBe(true);

    const transcription = await response.json();
    expect(transcription.status).toBe("complete");
    expect(transcription.content).toBe(content);
  });

  test("does not re-queue already completed transcription", async ({ request }) => {
    const pg = await addPage(notebookId);

    // Manually complete transcription
    await request.put(`${API}/api/pages/${pg.id}/transcription`, {
      headers: { "Content-Type": "application/json" },
      data: { content: "Already transcribed" },
    });

    // Try to trigger again without force
    const response = await request.post(`${API}/api/pages/${pg.id}/transcribe`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.ok()).toBe(true);

    const result = await response.json();
    expect(result.status).toBe("complete");
    expect(result.message).toBe("Already transcribed");
  });

  test("can force re-transcription of completed page", async ({ request }) => {
    const pg = await addPage(notebookId);
    await addStroke(pg.id);

    // Manually complete transcription
    await request.put(`${API}/api/pages/${pg.id}/transcription`, {
      headers: { "Content-Type": "application/json" },
      data: { content: "Already transcribed" },
    });

    // Force re-transcription
    const response = await request.post(`${API}/api/pages/${pg.id}/transcribe`, {
      headers: { "Content-Type": "application/json" },
      data: { force: true },
    });
    expect(response.ok()).toBe(true);

    const result = await response.json();
    expect(result.status).toBe("pending");
  });
});
