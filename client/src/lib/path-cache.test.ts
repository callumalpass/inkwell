import { PathCache } from "./path-cache";

describe("PathCache", () => {
  describe("get / set", () => {
    it("returns undefined for a cache miss", () => {
      const cache = new PathCache();
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("stores and retrieves a value", () => {
      const cache = new PathCache();
      cache.set("s1", "M 0 0 L 10 10");
      expect(cache.get("s1")).toBe("M 0 0 L 10 10");
    });

    it("stores empty string (valid cached value for null paths)", () => {
      const cache = new PathCache();
      cache.set("s1", "");
      expect(cache.get("s1")).toBe("");
      // Should not be undefined — empty string is a valid cached entry
      expect(cache.get("s1")).not.toBeUndefined();
    });

    it("overwrites existing values", () => {
      const cache = new PathCache();
      cache.set("s1", "M 0 0");
      cache.set("s1", "M 1 1");
      expect(cache.get("s1")).toBe("M 1 1");
    });
  });

  describe("LRU eviction", () => {
    it("evicts the least recently used entry when over capacity", () => {
      const cache = new PathCache(3);
      cache.set("s1", "path1");
      cache.set("s2", "path2");
      cache.set("s3", "path3");

      // All three present
      expect(cache.size).toBe(3);

      // Adding a 4th should evict s1 (oldest)
      cache.set("s4", "path4");
      expect(cache.size).toBe(3);
      expect(cache.get("s1")).toBeUndefined();
      expect(cache.get("s2")).toBe("path2");
      expect(cache.get("s3")).toBe("path3");
      expect(cache.get("s4")).toBe("path4");
    });

    it("accessing an entry makes it most recently used", () => {
      const cache = new PathCache(3);
      cache.set("s1", "path1");
      cache.set("s2", "path2");
      cache.set("s3", "path3");

      // Access s1 to make it most recently used
      cache.get("s1");

      // Add s4 — should evict s2 (now the LRU), not s1
      cache.set("s4", "path4");
      expect(cache.get("s1")).toBe("path1");
      expect(cache.get("s2")).toBeUndefined();
    });

    it("setting an existing key refreshes its position", () => {
      const cache = new PathCache(3);
      cache.set("s1", "path1");
      cache.set("s2", "path2");
      cache.set("s3", "path3");

      // Update s1 — moves it to most recent
      cache.set("s1", "path1-updated");

      // Add s4 — should evict s2
      cache.set("s4", "path4");
      expect(cache.get("s1")).toBe("path1-updated");
      expect(cache.get("s2")).toBeUndefined();
    });
  });

  describe("size", () => {
    it("reports correct size", () => {
      const cache = new PathCache();
      expect(cache.size).toBe(0);
      cache.set("s1", "p1");
      expect(cache.size).toBe(1);
      cache.set("s2", "p2");
      expect(cache.size).toBe(2);
    });

    it("does not double-count overwrites", () => {
      const cache = new PathCache();
      cache.set("s1", "p1");
      cache.set("s1", "p2");
      expect(cache.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      const cache = new PathCache();
      cache.set("s1", "p1");
      cache.set("s2", "p2");
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("s1")).toBeUndefined();
      expect(cache.get("s2")).toBeUndefined();
    });
  });
});
