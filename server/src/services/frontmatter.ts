import type { FrontmatterTemplate, MarkdownConfig } from "../types/index.js";
import type { PageMeta } from "../types/index.js";
import type { NotebookMeta } from "../types/index.js";

/**
 * Resolves a single template variable like {{page.id}} against the context.
 * Returns the raw value (string, array, etc.) for the given variable path.
 */
function resolveVariable(
  variable: string,
  context: TemplateContext,
): string | string[] | undefined {
  const parts = variable.split(".");
  if (parts.length !== 2) return undefined;

  const [namespace, field] = parts;

  switch (namespace) {
    case "page":
      return resolvePageVariable(field, context.page);
    case "notebook":
      return resolveNotebookVariable(field, context.notebook);
    case "transcription":
      return resolveTranscriptionVariable(field, context.transcriptionContent);
    default:
      return undefined;
  }
}

function resolvePageVariable(
  field: string,
  page: PageMeta,
): string | string[] | undefined {
  switch (field) {
    case "id":
      return page.id;
    case "created":
      return page.createdAt;
    case "modified":
      return page.updatedAt;
    case "seq":
      return String(page.pageNumber);
    case "tags":
      return page.tags ?? [];
    default:
      return undefined;
  }
}

function resolveNotebookVariable(
  field: string,
  notebook: NotebookMeta,
): string | string[] | undefined {
  switch (field) {
    case "id":
      return notebook.id;
    case "name":
      return notebook.title;
    default:
      return undefined;
  }
}

function resolveTranscriptionVariable(
  field: string,
  content: string | null,
): string | undefined {
  switch (field) {
    case "firstLine": {
      if (!content) return "";
      const firstLine = content.split("\n").find((line) => line.trim() !== "");
      return firstLine?.trim() ?? "";
    }
    default:
      return undefined;
  }
}

export interface TemplateContext {
  page: PageMeta;
  notebook: NotebookMeta;
  transcriptionContent: string | null;
}

/**
 * Resolves a template string containing {{variable}} placeholders.
 * Returns the resolved string. For non-string values (arrays), returns the raw value.
 */
export function resolveTemplateString(
  template: string,
  context: TemplateContext,
): string | string[] {
  // If the entire template is a single variable reference, return the raw value
  // (preserving arrays for YAML serialization)
  const singleVarMatch = template.match(/^\{\{([^}]+)\}\}$/);
  if (singleVarMatch) {
    const value = resolveVariable(singleVarMatch[1].trim(), context);
    if (value !== undefined) {
      return value;
    }
    return "";
  }

  // Otherwise do string interpolation: replace all {{var}} with string values
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, variable: string) => {
    const value = resolveVariable(variable.trim(), context);
    if (value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    return value;
  });
}

/**
 * Escapes a string for use as a YAML scalar value.
 * Wraps in double quotes if it contains special characters.
 */
function yamlScalar(value: string): string {
  // Empty strings need quoting
  if (value === "") return '""';

  // Check if the value needs quoting
  const needsQuoting =
    /[:{}\[\],&*?|>!%@`#'"\\\n\r\t]/.test(value) ||
    value.startsWith(" ") ||
    value.endsWith(" ") ||
    value === "true" ||
    value === "false" ||
    value === "null" ||
    value === "yes" ||
    value === "no" ||
    /^\d/.test(value);

  if (!needsQuoting) return value;

  // Double-quote and escape internal special chars
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

/**
 * Serializes a resolved template value to YAML format.
 */
function toYamlValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "\n" + value.map((item) => `  - ${yamlScalar(item)}`).join("\n");
  }
  return yamlScalar(value);
}

/**
 * Generates YAML frontmatter from a template and context.
 * Returns the frontmatter block including --- delimiters, or empty string if disabled.
 */
export function generateFrontmatter(
  config: MarkdownConfig,
  context: TemplateContext,
): string {
  if (!config.frontmatter.enabled) return "";

  const template = config.frontmatter.template;
  const lines: string[] = ["---"];

  for (const [key, templateValue] of Object.entries(template)) {
    const resolved = resolveTemplateString(templateValue, context);
    lines.push(`${key}: ${toYamlValue(resolved)}`);
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Combines frontmatter with transcription content into a complete markdown file.
 * Strips any existing frontmatter from the content before prepending new frontmatter.
 */
export function buildMarkdownWithFrontmatter(
  config: MarkdownConfig,
  context: TemplateContext,
  transcriptionContent: string,
): string {
  const frontmatter = generateFrontmatter(config, context);
  const body = stripFrontmatter(transcriptionContent);
  if (!frontmatter) return body;
  return frontmatter + "\n" + body;
}

/**
 * Strip YAML frontmatter from markdown content, returning only the body.
 */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;

  const match = content.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/);
  if (!match) return content;
  return content.slice(match[0].length);
}

/**
 * Resolves a filename template string to a concrete path.
 * All variables resolve to strings (arrays joined with commas).
 */
export function resolveFilenameTemplate(
  template: string,
  context: TemplateContext,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, variable: string) => {
    const value = resolveVariable(variable.trim(), context);
    if (value === undefined) return "";
    if (Array.isArray(value)) return value.join(",");
    // Sanitize for filesystem: remove path separators from individual values
    // but preserve intentional / in templates
    return value;
  });
}
