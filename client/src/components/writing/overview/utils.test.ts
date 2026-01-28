import { reorderById, parseTags, mergeTags, getColumnsForWidth } from "./utils";

describe("reorderById", () => {
  describe("happy path", () => {
    it("moves an item forward in the array", () => {
      const order = ["a", "b", "c", "d"];
      expect(reorderById(order, "a", "c")).toEqual(["b", "c", "a", "d"]);
    });

    it("moves an item backward in the array", () => {
      const order = ["a", "b", "c", "d"];
      expect(reorderById(order, "c", "a")).toEqual(["c", "a", "b", "d"]);
    });

    it("moves item to the end", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "a", "c")).toEqual(["b", "c", "a"]);
    });

    it("moves item to the beginning", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "c", "a")).toEqual(["c", "a", "b"]);
    });

    it("handles adjacent items", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "a", "b")).toEqual(["b", "a", "c"]);
      expect(reorderById(order, "b", "a")).toEqual(["b", "a", "c"]);
    });
  });

  describe("edge cases", () => {
    it("returns original array when fromId not found", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "x", "b")).toBe(order);
    });

    it("returns original array when toId not found", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "a", "x")).toBe(order);
    });

    it("returns original array when both ids not found", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "x", "y")).toBe(order);
    });

    it("returns original array when fromId equals toId", () => {
      const order = ["a", "b", "c"];
      expect(reorderById(order, "b", "b")).toBe(order);
    });

    it("handles empty array", () => {
      const order: string[] = [];
      expect(reorderById(order, "a", "b")).toBe(order);
    });

    it("handles single item array", () => {
      const order = ["a"];
      expect(reorderById(order, "a", "a")).toBe(order);
    });

    it("handles two item array", () => {
      const order = ["a", "b"];
      expect(reorderById(order, "a", "b")).toEqual(["b", "a"]);
      expect(reorderById(order, "b", "a")).toEqual(["b", "a"]);
    });

    it("does not mutate original array", () => {
      const order = ["a", "b", "c"];
      const original = [...order];
      reorderById(order, "a", "c");
      expect(order).toEqual(original);
    });
  });
});

describe("parseTags", () => {
  describe("happy path", () => {
    it("parses space-separated tags", () => {
      expect(parseTags("foo bar baz")).toEqual(["foo", "bar", "baz"]);
    });

    it("parses comma-separated tags", () => {
      expect(parseTags("foo,bar,baz")).toEqual(["foo", "bar", "baz"]);
    });

    it("parses mixed separators", () => {
      expect(parseTags("foo bar,baz")).toEqual(["foo", "bar", "baz"]);
    });

    it("handles multiple consecutive separators", () => {
      expect(parseTags("foo  bar,,baz")).toEqual(["foo", "bar", "baz"]);
    });

    it("trims whitespace around tags", () => {
      expect(parseTags("  foo  ,  bar  ")).toEqual(["foo", "bar"]);
    });

    it("converts tags to lowercase", () => {
      expect(parseTags("FOO Bar BAZ")).toEqual(["foo", "bar", "baz"]);
    });
  });

  describe("deduplication", () => {
    it("removes duplicate tags", () => {
      expect(parseTags("foo bar foo")).toEqual(["foo", "bar"]);
    });

    it("removes case-insensitive duplicates", () => {
      expect(parseTags("FOO foo Foo")).toEqual(["foo"]);
    });

    it("removes duplicates with mixed separators", () => {
      expect(parseTags("foo,foo bar")).toEqual(["foo", "bar"]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty string", () => {
      expect(parseTags("")).toEqual([]);
    });

    it("returns empty array for whitespace only", () => {
      expect(parseTags("   ")).toEqual([]);
    });

    it("returns empty array for separators only", () => {
      expect(parseTags(",, , ,,")).toEqual([]);
    });

    it("handles single tag", () => {
      expect(parseTags("foo")).toEqual(["foo"]);
    });

    it("handles newlines and tabs as separators", () => {
      expect(parseTags("foo\nbar\tbaz")).toEqual(["foo", "bar", "baz"]);
    });

    it("handles tags with numbers", () => {
      expect(parseTags("tag1 tag2 123")).toEqual(["tag1", "tag2", "123"]);
    });

    it("handles tags with hyphens", () => {
      expect(parseTags("foo-bar baz-qux")).toEqual(["foo-bar", "baz-qux"]);
    });
  });
});

describe("mergeTags", () => {
  describe("happy path", () => {
    it("merges two distinct tag arrays", () => {
      expect(mergeTags(["foo", "bar"], ["baz", "qux"])).toEqual([
        "foo",
        "bar",
        "baz",
        "qux",
      ]);
    });

    it("adds incoming tags to existing", () => {
      expect(mergeTags(["existing"], ["new"])).toEqual(["existing", "new"]);
    });
  });

  describe("deduplication", () => {
    it("removes exact duplicates", () => {
      expect(mergeTags(["foo", "bar"], ["bar", "baz"])).toEqual([
        "foo",
        "bar",
        "baz",
      ]);
    });

    it("handles case-insensitive deduplication", () => {
      expect(mergeTags(["Foo", "Bar"], ["foo", "BAR"])).toEqual(["foo", "bar"]);
    });

    it("uses lowercase for all output", () => {
      const result = mergeTags(["FOO"], ["BAR"]);
      expect(result.every((t) => t === t.toLowerCase())).toBe(true);
    });

    it("preserves order of existing tags (lowercased)", () => {
      const result = mergeTags(["C", "B", "A"], []);
      expect(result).toEqual(["c", "b", "a"]);
    });
  });

  describe("edge cases", () => {
    it("handles empty existing array", () => {
      expect(mergeTags([], ["foo", "bar"])).toEqual(["foo", "bar"]);
    });

    it("handles empty incoming array", () => {
      expect(mergeTags(["foo", "bar"], [])).toEqual(["foo", "bar"]);
    });

    it("handles both empty arrays", () => {
      expect(mergeTags([], [])).toEqual([]);
    });

    it("handles single item arrays", () => {
      expect(mergeTags(["a"], ["b"])).toEqual(["a", "b"]);
    });

    it("handles all duplicates", () => {
      expect(mergeTags(["foo", "bar"], ["foo", "bar"])).toEqual(["foo", "bar"]);
    });
  });
});

describe("getColumnsForWidth", () => {
  describe("breakpoints", () => {
    it("returns 4 columns for xl screens (1280px+)", () => {
      expect(getColumnsForWidth(1280)).toBe(4);
      expect(getColumnsForWidth(1440)).toBe(4);
      expect(getColumnsForWidth(1920)).toBe(4);
    });

    it("returns 3 columns for md screens (768px - 1279px)", () => {
      expect(getColumnsForWidth(768)).toBe(3);
      expect(getColumnsForWidth(1024)).toBe(3);
      expect(getColumnsForWidth(1279)).toBe(3);
    });

    it("returns 2 columns for small screens (<768px)", () => {
      expect(getColumnsForWidth(767)).toBe(2);
      expect(getColumnsForWidth(640)).toBe(2);
      expect(getColumnsForWidth(320)).toBe(2);
    });
  });

  describe("boundary values", () => {
    it("handles exact breakpoint at 1280", () => {
      expect(getColumnsForWidth(1279)).toBe(3);
      expect(getColumnsForWidth(1280)).toBe(4);
    });

    it("handles exact breakpoint at 768", () => {
      expect(getColumnsForWidth(767)).toBe(2);
      expect(getColumnsForWidth(768)).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles zero width", () => {
      expect(getColumnsForWidth(0)).toBe(2);
    });

    it("handles negative width", () => {
      expect(getColumnsForWidth(-100)).toBe(2);
    });

    it("handles very large width", () => {
      expect(getColumnsForWidth(10000)).toBe(4);
    });

    it("handles fractional width", () => {
      expect(getColumnsForWidth(768.5)).toBe(3);
      expect(getColumnsForWidth(767.9)).toBe(2);
    });
  });
});
