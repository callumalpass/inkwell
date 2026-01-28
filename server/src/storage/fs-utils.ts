import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import lockfile from "proper-lockfile";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    if (err instanceof SyntaxError) {
      // Corrupted JSON — log and treat as missing rather than crashing
      console.error(`Corrupted JSON in ${filePath}: ${err.message}`);
      return null;
    }
    throw err;
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function withLock<T>(
  dirPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureDir(dirPath);
  const release = await lockfile.lock(dirPath, {
    retries: { retries: 5, minTimeout: 50, maxTimeout: 500 },
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}
