import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveStrokeOverlay } from "./ActiveStrokeOverlay";
import { useDrawingStore } from "../../stores/drawing-store";

describe("ActiveStrokeOverlay", () => {
  beforeEach(() => {
    useDrawingStore.setState({
      activeStroke: null,
      color: "#000000",
      width: 3,
      penStyle: "pressure",
    });
  });

  it("renders nothing when no active stroke", () => {
    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when active stroke belongs to a different page", () => {
    useDrawingStore.setState({
      activeStroke: {
        id: "st_active",
        pageId: "pg_other",
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 30, y: 40, pressure: 0.6 },
        ],
      },
    });

    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when active stroke has fewer than 2 points", () => {
    useDrawingStore.setState({
      activeStroke: {
        id: "st_active",
        pageId: "pg_1",
        points: [{ x: 10, y: 20, pressure: 0.5 }],
      },
    });

    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders an SVG with a path when active stroke has enough points", () => {
    useDrawingStore.setState({
      activeStroke: {
        id: "st_active",
        pageId: "pg_1",
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 30, y: 40, pressure: 0.6 },
          { x: 50, y: 60, pressure: 0.7 },
        ],
      },
    });

    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector("path")).not.toBeNull();
  });

  it("uses the current color from the drawing store", () => {
    useDrawingStore.setState({
      color: "#1e40af",
      penStyle: "pressure",
      activeStroke: {
        id: "st_active",
        pageId: "pg_1",
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 30, y: 40, pressure: 0.6 },
          { x: 50, y: 60, pressure: 0.7 },
        ],
      },
    });

    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    // Pressure style uses fill
    expect(path!.getAttribute("fill")).toBe("#1e40af");
  });

  it("renders uniform style stroke as a stroked path", () => {
    useDrawingStore.setState({
      color: "#dc2626",
      width: 5,
      penStyle: "uniform",
      activeStroke: {
        id: "st_active",
        pageId: "pg_1",
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 30, y: 40, pressure: 0.6 },
          { x: 50, y: 60, pressure: 0.7 },
        ],
      },
    });

    const { container } = render(<ActiveStrokeOverlay pageId="pg_1" />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path!.getAttribute("fill")).toBe("none");
    expect(path!.getAttribute("stroke")).toBe("#dc2626");
  });
});
