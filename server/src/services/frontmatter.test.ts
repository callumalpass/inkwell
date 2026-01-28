import { describe, it, expect } from "vitest";
import {
  resolveTemplateString,
  generateFrontmatter,
  buildMarkdownWithFrontmatter,
  resolveFilenameTemplate,
  type TemplateContext,
} from "./frontmatter.js";
import type { MarkdownConfig } from "../types/index.js";
import { DEFAULT_MARKDOWN_CONFIG } from "../types/index.js";

function makeContext(overrides?: Partial<TemplateContext>): TemplateContext {
  return {
    page: {
      id: "pg_abc123",
      notebookId: "nb_xyz789",
      pageNumber: 3,
      canvasX: 0,
      canvasY: 0,
      createdAt: "2025-01-28T10:05:00Z",
      updatedAt: "2025-01-28T10:45:00Z",
      tags: ["meeting", "project-x"],
      links: [],
    },
    notebook: {
      id: "nb_xyz789",
      title: "Project Notes",
      createdAt: "2025-01-28T10:00:00Z",
      updatedAt: "2025-01-28T14:30:00Z",
    },
    transcriptionContent: "Meeting notes - Project X kickoff\n\nAttendees: Alice, Bob",
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<MarkdownConfig>): MarkdownConfig {
  return {
    ...DEFAULT_MARKDOWN_CONFIG,
    ...overrides,
    frontmatter: {
      ...DEFAULT_MARKDOWN_CONFIG.frontmatter,
      ...overrides?.frontmatter,
    },
    sync: {
      ...DEFAULT_MARKDOWN_CONFIG.sync,
      ...overrides?.sync,
    },
  };
}

describe("resolveTemplateString", () => {
  const ctx = makeContext();

  it("resolves page.id", () => {
    expect(resolveTemplateString("{{page.id}}", ctx)).toBe("pg_abc123");
  });

  it("resolves page.created", () => {
    expect(resolveTemplateString("{{page.created}}", ctx)).toBe(
      "2025-01-28T10:05:00Z",
    );
  });

  it("resolves page.modified", () => {
    expect(resolveTemplateString("{{page.modified}}", ctx)).toBe(
      "2025-01-28T10:45:00Z",
    );
  });

  it("resolves page.seq", () => {
    expect(resolveTemplateString("{{page.seq}}", ctx)).toBe("3");
  });

  it("resolves page.tags as array", () => {
    const result = resolveTemplateString("{{page.tags}}", ctx);
    expect(result).toEqual(["meeting", "project-x"]);
  });

  it("resolves notebook.id", () => {
    expect(resolveTemplateString("{{notebook.id}}", ctx)).toBe("nb_xyz789");
  });

  it("resolves notebook.name", () => {
    expect(resolveTemplateString("{{notebook.name}}", ctx)).toBe(
      "Project Notes",
    );
  });

  it("resolves transcription.firstLine", () => {
    expect(resolveTemplateString("{{transcription.firstLine}}", ctx)).toBe(
      "Meeting notes - Project X kickoff",
    );
  });

  it("returns empty string for null transcription", () => {
    const ctx2 = makeContext({ transcriptionContent: null });
    expect(resolveTemplateString("{{transcription.firstLine}}", ctx2)).toBe("");
  });

  it("skips blank lines for firstLine", () => {
    const ctx2 = makeContext({
      transcriptionContent: "\n\n  \nActual first line\nSecond line",
    });
    expect(resolveTemplateString("{{transcription.firstLine}}", ctx2)).toBe(
      "Actual first line",
    );
  });

  it("returns empty for unknown variables", () => {
    expect(resolveTemplateString("{{unknown.field}}", ctx)).toBe("");
  });

  it("handles mixed text and variables", () => {
    const result = resolveTemplateString(
      "Page {{page.id}} in {{notebook.name}}",
      ctx,
    );
    expect(result).toBe("Page pg_abc123 in Project Notes");
  });

  it("handles multiple variables in one string", () => {
    const result = resolveTemplateString(
      "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
      ctx,
    );
    expect(result).toBe("Project Notes/3-pg_abc123.md");
  });

  it("handles empty tags array", () => {
    const ctx2 = makeContext({
      page: {
        ...makeContext().page,
        tags: [],
      },
    });
    const result = resolveTemplateString("{{page.tags}}", ctx2);
    expect(result).toEqual([]);
  });

  it("joins arrays in mixed templates", () => {
    const result = resolveTemplateString("Tags: {{page.tags}}", ctx);
    expect(result).toBe("Tags: meeting, project-x");
  });
});

describe("generateFrontmatter", () => {
  it("generates YAML frontmatter with default template", () => {
    const ctx = makeContext();
    const config = makeConfig();
    const result = generateFrontmatter(config, ctx);

    expect(result).toContain("---");
    expect(result).toContain("title: Meeting notes - Project X kickoff");
    // ISO dates start with digits, so they get quoted
    expect(result).toContain('date: "2025-01-28T10:05:00Z"');
    expect(result).toContain('modified: "2025-01-28T10:45:00Z"');
    expect(result).toContain("tags:");
    expect(result).toContain("  - meeting");
    expect(result).toContain("  - project-x");
    expect(result).toContain("notebook: Project Notes");
    expect(result).toContain("page_id: pg_abc123");
  });

  it("returns empty string when frontmatter is disabled", () => {
    const ctx = makeContext();
    const config = makeConfig({
      frontmatter: { enabled: false, template: {} },
    });
    expect(generateFrontmatter(config, ctx)).toBe("");
  });

  it("handles custom template keys", () => {
    const ctx = makeContext();
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: {
          author: "inkwell",
          source: "{{notebook.name}}",
        },
      },
    });
    const result = generateFrontmatter(config, ctx);
    expect(result).toContain("author: inkwell");
    expect(result).toContain("source: Project Notes");
  });

  it("handles empty tags array in frontmatter", () => {
    const ctx = makeContext({
      page: { ...makeContext().page, tags: [] },
    });
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: { tags: "{{page.tags}}" },
      },
    });
    const result = generateFrontmatter(config, ctx);
    expect(result).toContain("tags: []");
  });

  it("properly quotes YAML special characters", () => {
    const ctx = makeContext({
      transcriptionContent: "Title: with colons & special chars",
    });
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: { title: "{{transcription.firstLine}}" },
      },
    });
    const result = generateFrontmatter(config, ctx);
    // Should be quoted because it contains colons
    expect(result).toContain('title: "Title: with colons & special chars"');
  });

  it("quotes empty string values", () => {
    const ctx = makeContext({ transcriptionContent: null });
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: { title: "{{transcription.firstLine}}" },
      },
    });
    const result = generateFrontmatter(config, ctx);
    expect(result).toContain('title: ""');
  });

  it("quotes boolean-like strings", () => {
    const ctx = makeContext({
      transcriptionContent: "true",
    });
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: { title: "{{transcription.firstLine}}" },
      },
    });
    const result = generateFrontmatter(config, ctx);
    expect(result).toContain('title: "true"');
  });
});

describe("buildMarkdownWithFrontmatter", () => {
  it("combines frontmatter and content", () => {
    const ctx = makeContext();
    const config = makeConfig({
      frontmatter: {
        enabled: true,
        template: { title: "{{transcription.firstLine}}" },
      },
    });
    const result = buildMarkdownWithFrontmatter(
      config,
      ctx,
      "Hello world\n\nSome content",
    );

    expect(result).toMatch(/^---\n/);
    expect(result).toContain("Hello world\n\nSome content");
    // Frontmatter and content separated by newline after ---
    expect(result).toMatch(/---\nHello world/);
  });

  it("returns raw content when frontmatter is disabled", () => {
    const ctx = makeContext();
    const config = makeConfig({
      frontmatter: { enabled: false, template: {} },
    });
    const result = buildMarkdownWithFrontmatter(config, ctx, "Just content");
    expect(result).toBe("Just content");
  });
});

describe("resolveFilenameTemplate", () => {
  const ctx = makeContext();

  it("resolves notebook name and page identifiers", () => {
    const result = resolveFilenameTemplate(
      "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
      ctx,
    );
    expect(result).toBe("Project Notes/3-pg_abc123.md");
  });

  it("handles single variable", () => {
    const result = resolveFilenameTemplate("{{page.id}}.md", ctx);
    expect(result).toBe("pg_abc123.md");
  });

  it("handles unknown variables as empty strings", () => {
    const result = resolveFilenameTemplate("{{unknown.var}}/file.md", ctx);
    expect(result).toBe("/file.md");
  });
});
