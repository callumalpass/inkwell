import { render } from "@testing-library/react";
import { PageBackground, type GridType } from "./PageBackground";

describe("PageBackground", () => {
  it("renders nothing for gridType 'none'", () => {
    const { container } = render(<PageBackground gridType="none" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a pattern with lines and a margin line for 'lined'", () => {
    const { container } = render(<PageBackground gridType="lined" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Should have a <pattern> element for repeating lines
    const pattern = svg!.querySelector("pattern#lined-pattern");
    expect(pattern).not.toBeNull();

    // Pattern should contain a horizontal line
    const patternLine = pattern!.querySelector("line");
    expect(patternLine).not.toBeNull();

    // Should have a rect that fills with the pattern
    const rect = svg!.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute("fill")).toBe("url(#lined-pattern)");

    // Should have a red margin line outside the pattern
    const lines = svg!.querySelectorAll("line");
    const marginLines = Array.from(lines).filter(
      (l) => l.getAttribute("stroke") === "#b91c1c",
    );
    expect(marginLines).toHaveLength(1);

    // Margin line should be vertical (same x1 and x2)
    const margin = marginLines[0];
    expect(margin.getAttribute("x1")).toBe(margin.getAttribute("x2"));
  });

  it("renders a grid pattern with horizontal and vertical lines for 'grid'", () => {
    const { container } = render(<PageBackground gridType="grid" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Should have a <pattern> element for repeating grid cells
    const pattern = svg!.querySelector("pattern#grid-pattern");
    expect(pattern).not.toBeNull();

    // Pattern should contain two lines (horizontal + vertical)
    const patternLines = pattern!.querySelectorAll("line");
    expect(patternLines).toHaveLength(2);

    // Should have a rect that fills with the pattern
    const rect = svg!.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute("fill")).toBe("url(#grid-pattern)");
  });

  it("renders a dot pattern with circles for 'dotgrid'", () => {
    const { container } = render(<PageBackground gridType="dotgrid" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Should have a <pattern> element for repeating dots
    const pattern = svg!.querySelector("pattern#dotgrid-pattern");
    expect(pattern).not.toBeNull();

    // Pattern should contain a circle
    const circle = pattern!.querySelector("circle");
    expect(circle).not.toBeNull();

    // Should have a rect that fills with the pattern
    const rect = svg!.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute("fill")).toBe("url(#dotgrid-pattern)");
  });

  it("uses the correct viewBox dimensions", () => {
    const { container } = render(<PageBackground gridType="grid" />);
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("viewBox")).toBe("0 0 1404 1872");
  });

  it("sets pointer-events to none", () => {
    const { container } = render(<PageBackground gridType="lined" />);
    const svg = container.querySelector("svg");
    expect(svg!.style.pointerEvents).toBe("none");
  });

  it("renders different pattern IDs for each grid type", () => {
    const types: GridType[] = ["lined", "grid", "dotgrid"];
    const patternIds = types.map((gt) => {
      const { container } = render(<PageBackground gridType={gt} />);
      const svg = container.querySelector("svg")!;
      const pattern = svg.querySelector("pattern");
      return pattern?.getAttribute("id");
    });

    expect(patternIds[0]).toBe("lined-pattern");
    expect(patternIds[1]).toBe("grid-pattern");
    expect(patternIds[2]).toBe("dotgrid-pattern");
  });
});
