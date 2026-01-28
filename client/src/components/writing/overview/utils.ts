/** Reorder an array by moving an item from one position to another. */
export function reorderById(
  order: string[],
  fromId: string,
  toId: string,
): string[] {
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

/** Parse a string of tags separated by spaces or commas. */
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/g)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/** Merge existing tags with incoming tags (case-insensitive deduplication). */
export function mergeTags(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing.map((t) => t.toLowerCase()));
  for (const tag of incoming) set.add(tag);
  return Array.from(set);
}

/** Get the number of grid columns based on container width. */
export function getColumnsForWidth(width: number): number {
  if (width >= 1280) return 4; // xl:grid-cols-4
  if (width >= 768) return 3; // md:grid-cols-3
  return 2; // grid-cols-2
}
