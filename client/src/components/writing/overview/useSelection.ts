import { useState, useEffect, useMemo, useCallback } from "react";

export interface UseSelectionOptions {
  /** Available page IDs that can be selected. */
  pageIds: string[];
  /** Current notebook ID - selection is cleared on notebook change. */
  notebookId: string | null;
}

export interface UseSelectionResult {
  /** Set of currently selected page IDs. */
  selected: Set<string>;
  /** Array version of selected IDs for convenience. */
  selectedIds: string[];
  /** Number of selected items. */
  selectedCount: number;
  /** Toggle selection state for a single page. */
  toggleSelect: (pageId: string) => void;
  /** Select all available pages. */
  selectAll: () => void;
  /** Clear all selections. */
  clearSelection: () => void;
}

export function useSelection({
  pageIds,
  notebookId,
}: UseSelectionOptions): UseSelectionResult {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Remove selections for pages that no longer exist
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(pageIds);
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [pageIds]);

  // Clear selection when notebook changes
  useEffect(() => {
    setSelected(new Set());
  }, [notebookId]);

  const toggleSelect = useCallback((pageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(pageIds));
  }, [pageIds]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedCount = selectedIds.length;

  return {
    selected,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}
