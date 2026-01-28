import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { vi } from "vitest";
import { ensureDir, readJson, writeJson, withLock } from "./fs-utils.js";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "inkwell-test-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("ensureDir", () => {
  it("creates a directory recursively", async () => {
    const nested = join(testDir, "a", "b", "c");
    await ensureDir(nested);
    expect(existsSync(nested)).toBe(true);
  });

  it("does not throw if directory already exists", async () => {
    await ensureDir(testDir);
    await expect(ensureDir(testDir)).resolves.toBeUndefined();
  });
});

describe("readJson", () => {
  it("reads and parses a JSON file", async () => {
    const file = join(testDir, "data.json");
    await writeJson(file, { name: "test" });
    const result = await readJson<{ name: string }>(file);
    expect(result).toEqual({ name: "test" });
  });

  it("returns null for a non-existent file", async () => {
    const result = await readJson(join(testDir, "missing.json"));
    expect(result).toBeNull();
  });

  it("returns null for corrupted JSON and logs an error", async () => {
    const file = join(testDir, "bad.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "not json", "utf-8");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readJson(file);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Corrupted JSON"),
    );
    spy.mockRestore();
  });
});

describe("writeJson", () => {
  it("writes formatted JSON to a file", async () => {
    const file = join(testDir, "out.json");
    await writeJson(file, { a: 1 });
    const raw = await readFile(file, "utf-8");
    expect(JSON.parse(raw)).toEqual({ a: 1 });
    expect(raw).toContain("\n"); // formatted with indentation
  });
});

describe("withLock", () => {
  it("executes function with lock and returns result", async () => {
    const result = await withLock(testDir, async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("ensures directory exists before locking", async () => {
    const lockDir = join(testDir, "lockdir");
    await withLock(lockDir, async () => {});
    expect(existsSync(lockDir)).toBe(true);
  });

  it("serializes concurrent access", async () => {
    const order: number[] = [];
    const task = (n: number, delay: number) =>
      withLock(testDir, async () => {
        order.push(n);
        await new Promise((r) => setTimeout(r, delay));
        order.push(n);
      });

    await Promise.all([task(1, 50), task(2, 10)]);
    // First task should complete both pushes before second starts
    expect(order[0]).toBe(order[1]);
  });
});
