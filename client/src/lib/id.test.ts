import { generateStrokeId } from "./id";

describe("generateStrokeId", () => {
  it("returns a string starting with 'st_'", () => {
    const id = generateStrokeId();
    expect(id).toMatch(/^st_/);
  });

  it("contains three parts separated by underscores", () => {
    const id = generateStrokeId();
    const parts = id.split("_");
    expect(parts).toHaveLength(3);
  });

  it("generates unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateStrokeId()));
    expect(ids.size).toBe(100);
  });
});
