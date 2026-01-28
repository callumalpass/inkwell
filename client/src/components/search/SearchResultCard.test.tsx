import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResultCard } from "./SearchResultCard";
import type { SearchResult } from "../../api/search";

const MOCK_RESULT: SearchResult = {
  pageId: "pg_1",
  notebookId: "nb_1",
  notebookName: "Work Notes",
  excerpt: "...meeting about project launch date...",
  modified: "2025-01-28T10:00:00Z",
  thumbnailUrl: "/api/pages/pg_1/thumbnail",
  matchType: "transcription",
};

describe("SearchResultCard", () => {
  it("renders notebook name", () => {
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={() => {}} />,
    );
    expect(screen.getByText("Work Notes")).toBeInTheDocument();
  });

  it("renders excerpt text", () => {
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={() => {}} />,
    );
    expect(screen.getByTestId("search-excerpt")).toBeInTheDocument();
  });

  it("renders date", () => {
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={() => {}} />,
    );
    const dateStr = new Date("2025-01-28T10:00:00Z").toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it("renders thumbnail image", () => {
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={() => {}} />,
    );
    // alt="" gives the img a presentation role, so query by tag
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "/api/pages/pg_1/thumbnail");
  });

  it("highlights matching query text in excerpt", () => {
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={() => {}} />,
    );
    const marks = screen.getByTestId("search-excerpt").querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("project");
  });

  it("highlights case-insensitively", () => {
    render(
      <SearchResultCard
        result={{
          ...MOCK_RESULT,
          excerpt: "Meeting about PROJECT launch",
        }}
        query="project"
        onClick={() => {}}
      />,
    );
    const marks = screen.getByTestId("search-excerpt").querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("PROJECT");
  });

  it("handles regex special characters in query safely", () => {
    render(
      <SearchResultCard
        result={{
          ...MOCK_RESULT,
          excerpt: "Price is $100.00 (total)",
        }}
        query="$100.00"
        onClick={() => {}}
      />,
    );
    // Should not throw and should render
    expect(screen.getByTestId("search-excerpt")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SearchResultCard result={MOCK_RESULT} query="project" onClick={onClick} />,
    );

    await user.click(screen.getByTestId("search-result"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
