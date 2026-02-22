import { describe, expect, it } from "vitest";
import { findNearestPageInDirection } from "./page-direction-nav";
import type { PageMeta } from "../api/pages";

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 533;

function makePage(id: string, x: number, y: number): PageMeta {
  const now = new Date().toISOString();
  return {
    id,
    notebookId: "nb_1",
    pageNumber: 1,
    canvasX: x,
    canvasY: y,
    createdAt: now,
    updatedAt: now,
  };
}

describe("findNearestPageInDirection", () => {
  it("returns null when current page is missing", () => {
    const pages = [makePage("a", 0, 0)];
    expect(
      findNearestPageInDirection(pages, "missing", "right", PAGE_WIDTH, PAGE_HEIGHT),
    ).toBeNull();
  });

  it("finds nearest page to the right", () => {
    const pages = [
      makePage("center", 0, 0),
      makePage("right-near", 120, 20),
      makePage("right-far", 400, 0),
      makePage("left", -200, 0),
    ];
    expect(
      findNearestPageInDirection(pages, "center", "right", PAGE_WIDTH, PAGE_HEIGHT),
    ).toBe("right-near");
  });

  it("finds nearest page above", () => {
    const pages = [
      makePage("center", 0, 0),
      makePage("up-near", 30, -130),
      makePage("up-far", 0, -400),
      makePage("down", 0, 200),
    ];
    expect(
      findNearestPageInDirection(pages, "center", "up", PAGE_WIDTH, PAGE_HEIGHT),
    ).toBe("up-near");
  });

  it("returns null when there is no page in that direction", () => {
    const pages = [makePage("center", 0, 0), makePage("left", -300, 0)];
    expect(
      findNearestPageInDirection(pages, "center", "right", PAGE_WIDTH, PAGE_HEIGHT),
    ).toBeNull();
  });

  it("breaks equal-distance ties by smaller perpendicular offset", () => {
    const pages = [
      makePage("center", 0, 0),
      makePage("right-diagonal", 100, 100),
      makePage("right-straight", 100, 0),
    ];
    expect(
      findNearestPageInDirection(pages, "center", "right", PAGE_WIDTH, PAGE_HEIGHT),
    ).toBe("right-straight");
  });
});
