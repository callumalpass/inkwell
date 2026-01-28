import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let originalDataDir: string;
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-routes-test-"));
  originalDataDir = config.dataDir;
  config.dataDir = testDir;
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  config.dataDir = originalDataDir;
  await rm(testDir, { recursive: true, force: true });
});

describe("GET /api/notebooks", () => {
  it("returns an empty array initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/notebooks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("POST /api/notebooks", () => {
  it("creates a notebook and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "My Notebook" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("My Notebook");
    expect(body.id).toMatch(/^nb_/);
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it("defaults title to 'Untitled' when empty", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe("Untitled");
  });
});

describe("GET /api/notebooks/:id", () => {
  it("returns a notebook by id", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Fetch Me" },
    });
    const { id } = create.json();

    const res = await app.inject({ method: "GET", url: `/api/notebooks/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Fetch Me");
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({ method: "GET", url: "/api/notebooks/nb_missing" });
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/notebooks/:id", () => {
  it("updates notebook title", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Original" },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/notebooks/${id}`,
      payload: { title: "Updated" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Updated");
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/notebooks/nb_missing",
      payload: { title: "Nope" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/notebooks/:id", () => {
  it("deletes a notebook and returns 204", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/notebooks",
      payload: { title: "Delete Me" },
    });
    const { id } = create.json();

    const res = await app.inject({ method: "DELETE", url: `/api/notebooks/${id}` });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: "GET", url: `/api/notebooks/${id}` });
    expect(check.statusCode).toBe(404);
  });

  it("returns 404 for non-existent notebook", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/notebooks/nb_missing" });
    expect(res.statusCode).toBe(404);
  });
});
